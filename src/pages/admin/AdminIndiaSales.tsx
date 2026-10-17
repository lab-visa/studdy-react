/**
 * /admin/india-sales - every India (Cashfree) order: date filters (Today,
 * Yesterday, This month, Last month, Custom), customer state (Active,
 * Waiting for login, Expiring in 7 days, Expired, Seat released, Refunded,
 * Abandoned, In checkout, Test), partner and search; totals and a
 * per-partner breakdown; full Cashfree details per order; Mark refunded /
 * Release seat / Mark as test; WhatsApp follow-ups; CSV download.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import DateRangeFilter, { rangeFor, type DateRange } from '../../components/admin/DateRangeFilter';
import { useAdminSession, adminFetch } from '../../components/admin/useAdminSession';

type State = 'active' | 'waiting' | 'expiring' | 'expired' | 'released' | 'refunded' | 'abandoned' | 'checkout' | 'retried' | 'test';
interface Row {
  orderId: string; state: State; status: string; plan: string; amount: number; earlierAttempts: number; possibleDouble: boolean;
  customer: { name: string | null; phone: string | null; email: string | null };
  partner: { code: string; name: string } | null; commission: number;
  createdAt: string; paidAt: string | null; accessEnd: string | null; seat: string | null; seatReleasedAt: string | null;
  cashfree: { cfOrderId: string | null; cfPaymentId: string | null; paidAmount: number | null; currency: string | null; method: string | null; detail: string | null; bankReference: string | null; message: string | null; failedAttempts: number };
  campaign: string | null; leadId: string | null; refundedAt: string | null; note: string | null; markedTestAt: string | null;
}
interface Data {
  totals: { sales: number; revenue: number; yearly: number; quarterly: number; viaPartners: number; direct: number; refunded: number; refundedAmount: number; abandoned: number; waitingForSeat: number; possibleDoubles: number };
  counts: Record<State, number>;
  byPartner: { code: string | null; name: string; sales: number; revenue: number; commission: number }[];
  partners: { code: string; name: string }[];
  rows: Row[];
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '-');
const STATE: Record<State, { bg: string; fg: string; label: string; help: string }> = {
  active: { bg: 'rgba(22,163,74,.12)', fg: '#16a34a', label: 'Active', help: 'Paid, has a login' },
  waiting: { bg: 'rgba(239,68,68,.12)', fg: '#dc2626', label: 'Waiting for login', help: 'Paid, no free seat yet' },
  expiring: { bg: 'rgba(245,158,11,.14)', fg: '#b45309', label: 'Expiring in 7 days', help: 'Send a renewal reminder' },
  expired: { bg: 'rgba(107,114,128,.15)', fg: '#6b7280', label: 'Expired', help: 'Access date passed' },
  released: { bg: 'rgba(107,114,128,.15)', fg: '#6b7280', label: 'Seat released', help: 'You freed the seat' },
  refunded: { bg: 'rgba(107,114,128,.15)', fg: '#6b7280', label: 'Refunded', help: 'Money returned' },
  abandoned: { bg: 'rgba(140,121,224,.14)', fg: '#7c3aed', label: 'Abandoned', help: 'Never paid: follow up' },
  checkout: { bg: 'rgba(245,158,11,.14)', fg: '#b45309', label: 'In checkout', help: 'Opened under 1 hour ago' },
  retried: { bg: 'rgba(107,114,128,.15)', fg: '#6b7280', label: 'Earlier attempt', help: 'Paid on a later try' },
  test: { bg: 'rgba(107,114,128,.15)', fg: '#6b7280', label: 'Test order', help: 'Excluded from everything' },
};
const STATE_ORDER: State[] = ['active', 'waiting', 'expiring', 'expired', 'released', 'refunded', 'abandoned', 'checkout', 'test'];

export default function AdminIndiaSales() {
  const location = useLocation();
  const { displayName, logout, loggingOut } = useAdminSession();
  const [range, setRange] = useState<DateRange>(() => rangeFor('today'));
  const [state, setState] = useState<'all' | State>('all');
  const [partner, setPartner] = useState('all');
  const [q, setQ] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState('');

  const load = useCallback(() => {
    const p = new URLSearchParams({ from: range.from, to: range.to, state, partner, q: q.trim() });
    adminFetch(`/api/admin/india-sales?${p}`).then(d => { setData(d); setError(''); }).catch(e => setError(e.message));
  }, [range, state, partner, q]);
  useEffect(() => { if (displayName) { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); } }, [displayName, load, q]);

  const act = async (r: Row, action: 'refund' | 'release_seat' | 'mark_test') => {
    let note = '';
    if (action === 'refund') {
      const n = window.prompt(`Mark ${r.customer.name}'s ${inr(r.amount)} order as REFUNDED?\n\nThis only updates your records - refund the money in your Cashfree dashboard first. It frees their seat and removes any partner commission.\n\nNote (reason + Cashfree refund ID):`, '');
      if (n === null) return;
      note = n;
    } else if (action === 'mark_test') {
      const n = window.prompt(`Mark this ${inr(r.amount)} order as a TEST order?\n\nIt is removed from sales, partner commission, payouts and seats. No money moves.\n\nNote (optional):`, 'Test order');
      if (n === null) return;
      note = n;
    } else if (!window.confirm(`Release the Studdy seat held by ${r.customer.name}? They will no longer see the login on their dashboard. The order stays paid.`)) return;
    try { await adminFetch('/api/admin/india-sales', { method: 'POST', body: { orderId: r.orderId, action, note } }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update'); }
  };

  const copy = (k: string, v: string) => { navigator.clipboard?.writeText(v); setCopied(k); setTimeout(() => setCopied(''), 1500); };

  const download = () => {
    if (!data) return;
    const head = ['Date (IST)', 'Status', 'Plan', 'Amount', 'Customer', 'Phone', 'Email', 'Partner code', 'Partner', 'Commission', 'Seat', 'Payment method', 'Method detail', 'UTR / bank ref', 'Cashfree payment id', 'Cashfree message', 'Order id', 'Access until'];
    const lines = data.rows.map(r => [when(r.paidAt || r.createdAt), STATE[r.state].label, r.plan, r.amount, r.customer.name, r.customer.phone, r.customer.email, r.partner?.code, r.partner?.name, r.commission, r.seat, r.cashfree.method, r.cashfree.detail, r.cashfree.bankReference, r.cashfree.cfPaymentId, r.cashfree.message, r.orderId, r.accessEnd?.slice(0, 10)]);
    const csv = [head, ...lines].map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `india-sales-${range.from}-to-${range.to}.csv`;
    a.click();
  };

  if (!displayName) return null;
  const btn = 'text-[12px] font-bold px-3 py-1.5 rounded-lg';
  const box = { border: '1px solid var(--border)' };
  const t = data?.totals;

  return (
    <AdminLayout currentPath={location.pathname} pageTitle="India Sales" pageSubtitle="Cashfree orders, partners and seats (India time)"
      displayName={displayName} onLogout={logout} loggingOut={loggingOut}>
      <div className="flex flex-col gap-3 mb-4">
        <DateRangeFilter value={range} onChange={setRange} allowAll />
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => setState('all')} className={btn}
            style={{ background: state === 'all' ? 'var(--ink)' : 'transparent', color: state === 'all' ? 'var(--dim)' : 'var(--soft)', ...box }}>All</button>
          {STATE_ORDER.map(s => (
            <button key={s} onClick={() => setState(s)} className={btn} title={STATE[s].help}
              style={{ background: state === s ? 'var(--ink)' : 'transparent', color: state === s ? 'var(--dim)' : STATE[s].fg, ...box }}>
              {STATE[s].label} ({data?.counts?.[s] ?? 0})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={partner} onChange={e => setPartner(e.target.value)} className="text-[12.5px] px-3 py-1.5 rounded-lg" style={{ ...box, background: 'transparent', color: 'var(--ink)' }}>
            <option value="all">All partners</option>
            <option value="direct">Direct (no partner)</option>
            {data?.partners.map(p => <option key={p.code} value={p.code}>{p.name} ({p.code})</option>)}
          </select>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, phone, email, UTR, order id"
            className="text-[13px] px-3 py-1.5 rounded-lg min-w-[240px] flex-1" style={{ ...box, background: 'transparent', color: 'var(--ink)' }} />
          <button className={btn} style={{ background: 'var(--ink)', color: 'var(--dim)' }} onClick={download} disabled={!data?.rows.length}>Download CSV</button>
        </div>
      </div>

      {error && <div className="rounded-xl p-3 mb-4 text-[13px]" style={{ color: '#dc2626', border: '1px solid rgba(239,68,68,.3)' }}>{error}</div>}
      {t && t.possibleDoubles > 0 && (
        <div className="rounded-xl p-3 mb-4 text-[13px] font-bold" style={{ color: '#b45309', border: '1px solid rgba(245,158,11,.45)' }}>
          {t.possibleDoubles} orders look like a double payment (same number paid twice within 24 hours). Check with the customer; refund one if it was a mistake.
        </div>
      )}
      {t && t.waitingForSeat > 0 && (
        <div className="rounded-xl p-3 mb-4 text-[13px] font-bold" style={{ color: '#dc2626', border: '1px solid rgba(239,68,68,.35)', background: 'rgba(239,68,68,.05)' }}>
          {t.waitingForSeat} paid customer(s) are waiting for a Studdy login. Add a login or raise seats in Studdy Logins, then they get it automatically.
        </div>
      )}

      {t && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5 text-[13px]">
          {[
            ['Sales', String(t.sales), `${t.yearly} yearly · ${t.quarterly} quarterly`],
            ['Collected', inr(t.revenue), 'paid orders, GST incl.'],
            ['Via partners', String(t.viaPartners), `${t.direct} direct`],
            ['Refunded', String(t.refunded), inr(t.refundedAmount)],
            ['Abandoned', String(t.abandoned), 'opened checkout, never paid'],
          ].map(([l, v, s]) => (
            <div key={l} className="rounded-xl p-3" style={box}>
              <div style={{ color: 'var(--soft)' }}>{l}</div>
              <div className="font-black text-[20px]">{v}</div>
              <div className="text-[11.5px]" style={{ color: 'var(--soft)' }}>{s}</div>
            </div>
          ))}
        </div>
      )}

      {data && data.byPartner.length > 0 && (
        <div className="rounded-2xl p-4 mb-5" style={box}>
          <div className="font-black text-[14px] mb-2">Sales by partner</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr style={{ color: 'var(--soft)' }} className="text-left">
                <th className="py-1.5 pr-3 font-bold">Partner</th><th className="py-1.5 pr-3 font-bold">Sales</th><th className="py-1.5 pr-3 font-bold">Revenue</th><th className="py-1.5 font-bold">Commission</th>
              </tr></thead>
              <tbody>
                {data.byPartner.map(p => (
                  <tr key={p.code || 'direct'} style={{ borderTop: '1px solid var(--border)' }} className="cursor-pointer" onClick={() => setPartner(p.code || 'direct')}>
                    <td className="py-1.5 pr-3 font-bold">{p.name}{p.code && <span className="font-normal" style={{ color: 'var(--soft)' }}> · {p.code}</span>}</td>
                    <td className="py-1.5 pr-3">{p.sales}</td><td className="py-1.5 pr-3">{inr(p.revenue)}</td><td className="py-1.5">{p.code ? inr(p.commission) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!data ? <p style={{ color: 'var(--soft)' }}>Loading…</p> : data.rows.length === 0 ? (
        <p className="text-[14px]" style={{ color: 'var(--soft)' }}>No orders for these filters.</p>
      ) : (
        <div className="space-y-2.5">
          {data.rows.map(r => {
            const st = STATE[r.state];
            const first = r.customer.name?.split(' ')[0] || '';
            const followUp = r.state === 'abandoned' || r.state === 'checkout'
              ? `Hi ${first}, you were about to start Studdy, the AI tutor that explains any doubt step by step. Did something go wrong at payment? Happy to help, or here's the link again: https://studdylab.com/checkout?plan=${r.plan}`
              : r.state === 'expiring' || r.state === 'expired'
                ? `Hi ${first}, your Studdy plan ${r.state === 'expired' ? 'has ended' : `ends on ${r.accessEnd ? new Date(r.accessEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'soon'}`}. Renew here to keep learning without a break: https://studdylab.com/checkout?plan=${r.plan}`
                : '';
            const isOpen = open === r.orderId;
            const dash = `https://studdylab.com/dashboard?order_id=${r.orderId}`;
            return (
              <div key={r.orderId} className="rounded-2xl" style={box}>
                <button className="w-full text-left p-4 flex flex-wrap items-center gap-x-4 gap-y-1" onClick={() => setOpen(isOpen ? null : r.orderId)}>
                  <span className="text-[11.5px] font-black px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                  <span className="font-black text-[14.5px]">{r.customer.name || '-'}</span>
                  <span className="text-[13px]" style={{ color: 'var(--soft)' }}>{r.customer.phone} · {r.plan === 'yearly' ? 'Yearly' : 'Quarterly'} {inr(r.amount)}</span>
                  <span className="text-[13px]" style={{ color: 'var(--soft)' }}>{when(r.paidAt || r.createdAt)}</span>
                  {r.partner ? <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(140,121,224,.12)', color: '#7c3aed' }}>{r.partner.name} · {r.partner.code}</span>
                    : <span className="text-[12px]" style={{ color: 'var(--soft)' }}>Direct</span>}
                  {r.seat && <span className="text-[12px]" style={{ color: 'var(--soft)' }}>Seat: {r.seat}</span>}
                  {r.earlierAttempts > 0 && <span className="text-[12px]" style={{ color: 'var(--soft)' }}>{r.earlierAttempts} earlier unpaid attempt{r.earlierAttempts > 1 ? 's' : ''}</span>}
                  {r.possibleDouble && <span className="text-[11.5px] font-black" style={{ color: '#b45309' }}>Possible double payment</span>}
                  <span className="ml-auto" style={{ color: 'var(--soft)' }}>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-[12.5px]" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 mt-3">
                      {[
                        ['Email', r.customer.email], ['Order created', when(r.createdAt)], ['Paid at', when(r.paidAt)],
                        ['Amount Cashfree received', r.cashfree.paidAmount != null ? `${inr(r.cashfree.paidAmount)} ${r.cashfree.currency || ''}` : '-'],
                        ['Payment method', [r.cashfree.method, r.cashfree.detail].filter(Boolean).join(' · ') || '-'],
                        ['UTR / bank reference', r.cashfree.bankReference], ['Cashfree payment id', r.cashfree.cfPaymentId], ['Cashfree order id', r.cashfree.cfOrderId],
                        ['Cashfree message', r.cashfree.message], ['Failed attempts', String(r.cashfree.failedAttempts)],
                        ['Partner commission', r.partner ? inr(r.commission) : 'No partner'], ['Access until', r.accessEnd ? new Date(r.accessEnd).toLocaleDateString('en-IN') : '-'],
                        ['Campaign', r.campaign], ['Our order id', r.orderId],
                        ...(r.refundedAt ? [['Refunded', when(r.refundedAt)]] : []),
                        ...(r.markedTestAt ? [['Marked as test', when(r.markedTestAt)]] : []),
                        ...(r.note ? [['Note', r.note]] : []),
                      ].map(([k, v]) => (
                        <div key={k}><span style={{ color: 'var(--soft)' }}>{k}: </span><b className="break-all">{v || '-'}</b></div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <button className={btn} style={box} onClick={() => copy(r.orderId, dash)}>{copied === r.orderId ? 'Copied ✓' : 'Copy customer dashboard link'}</button>
                      {r.customer.phone && followUp && <a className={btn} style={{ background: '#25D366', color: '#fff' }} target="_blank" rel="noopener noreferrer"
                        href={`https://wa.me/91${r.customer.phone}?text=${encodeURIComponent(followUp)}`}>{r.state === 'abandoned' || r.state === 'checkout' ? 'Follow up on WhatsApp' : 'Send renewal reminder'}</a>}
                      {r.customer.phone && (r.status === 'paid') && <a className={btn} style={{ background: '#25D366', color: '#fff' }} target="_blank" rel="noopener noreferrer"
                        href={`https://wa.me/91${r.customer.phone}?text=${encodeURIComponent(`Hi ${first}, here is your Studdy Lab page with your login: ${dash}`)}`}>Send dashboard link</a>}
                      {r.status === 'paid' && <button className={btn} style={{ border: '1px solid rgba(239,68,68,.35)', color: '#dc2626' }} onClick={() => act(r, 'refund')}>Mark refunded</button>}
                      {r.seat && <button className={btn} style={box} onClick={() => act(r, 'release_seat')}>Release seat</button>}
                      {(r.status === 'paid' || r.status === 'refunded') && <button className={btn} style={{ ...box, color: 'var(--soft)' }} onClick={() => act(r, 'mark_test')}>Mark as test order</button>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}

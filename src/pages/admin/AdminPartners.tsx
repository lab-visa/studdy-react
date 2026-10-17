/**
 * /admin/partners - sales partners. Three views:
 *   Partners    - onboarding tracking: joined today / this month / total,
 *                 KYC status (not started / incomplete / waiting for your
 *                 check / checked) with filters by join date, KYC, status,
 *                 search; per partner: bank + KYC, PIN reset, pause, delete.
 *   Leaderboard - sales per partner for any date range (Today … Custom).
 *   Payouts     - monthly payouts with TDS and UTR.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import PartnerPayouts from '../../components/admin/PartnerPayouts';
import DateRangeFilter, { rangeFor, inRange, type DateRange } from '../../components/admin/DateRangeFilter';

type Kyc = 'none' | 'incomplete' | 'to_check' | 'checked';
interface Partner {
  id: string; name: string; phone: string; email: string; city: string | null; occupation: string | null;
  experience: string | null; why_join: string | null; status: string; code: string | null;
  has_pin: boolean; pin_must_change: boolean; locked: boolean; last_login_at: string | null; sales_ever: number;
  bank_holder: string | null; bank_account: string | null; bank_ifsc: string | null; bank_name: string | null; bank_branch: string | null;
  has_pan_photo: boolean; aadhaar_last4: string | null; has_aadhaar_front: boolean; has_aadhaar_back: boolean; aadhaar_consent_at: string | null;
  details_complete: boolean; details_updated_at: string | null; details_checked_at: string | null; kyc_status: Kyc;
  orders: { paid_at: string | null; plan: string; amount: number; status: string }[];
  pan: string | null; payout_upi: string | null; notes: string | null; applied_at: string; approved_at: string | null;
  totals: { sales: number; earned: number; payable: number; pending: number; bonus: number };
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const STATUS_COLORS: Record<string, string> = { applied: '#d97706', approved: '#16a34a', rejected: '#6b7280', paused: '#6b7280' };
const KYC: Record<Kyc, { label: string; color: string }> = {
  none: { label: 'KYC not started', color: '#6b7280' },
  incomplete: { label: 'KYC incomplete', color: '#d97706' },
  to_check: { label: 'Needs your check', color: '#dc2626' },
  checked: { label: 'KYC checked', color: '#16a34a' },
};
const COMMISSION: Record<string, number> = { yearly: 2500, quarterly: 700 };

function Leaderboard({ partners }: { partners: Partner[] }) {
  const [range, setRange] = useState<DateRange>(() => rangeFor('this_month'));
  const [showZero, setShowZero] = useState(false);
  const rows = useMemo(() => partners.filter(p => p.code).map(p => {
    const inR = p.orders.filter(o => inRange(o.paid_at, range));
    const paid = inR.filter(o => o.status === 'paid');
    return {
      p, sales: paid.length, yearly: paid.filter(o => o.plan === 'yearly').length, quarterly: paid.filter(o => o.plan === 'quarterly').length,
      refunded: inR.filter(o => o.status === 'refunded').length, revenue: paid.reduce((s, o) => s + o.amount, 0),
      commission: paid.reduce((s, o) => s + (COMMISSION[o.plan] || 0), 0),
    };
  }).sort((a, b) => b.sales - a.sales || b.revenue - a.revenue), [partners, range]);
  const shown = showZero ? rows : rows.filter(r => r.sales || r.refunded);
  const total = rows.reduce((t, r) => ({ sales: t.sales + r.sales, revenue: t.revenue + r.revenue, commission: t.commission + r.commission }), { sales: 0, revenue: 0, commission: 0 });
  const box = { border: '1px solid var(--border)' };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <DateRangeFilter value={range} onChange={setRange} allowAll />
        <label className="text-[12.5px] flex items-center gap-1.5 ml-auto" style={{ color: 'var(--soft)' }}>
          <input type="checkbox" checked={showZero} onChange={e => setShowZero(e.target.checked)} /> Show partners with no sales
        </label>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 text-[13px]">
        {[['Partner sales', String(total.sales)], ['Revenue via partners', inr(total.revenue)], ['Commission earned', inr(total.commission)], ['Partners with a sale', `${rows.filter(r => r.sales).length} of ${rows.length}`]].map(([l, v]) => (
          <div key={l} className="rounded-xl p-3" style={box}><div style={{ color: 'var(--soft)' }}>{l}</div><div className="font-black text-[20px]">{v}</div></div>
        ))}
      </div>
      {shown.length === 0 ? <p className="text-[14px]" style={{ color: 'var(--soft)' }}>No partner sales in this period.</p> : (
        <div className="rounded-2xl overflow-x-auto" style={box}>
          <table className="w-full text-[13px]">
            <thead><tr className="text-left" style={{ color: 'var(--soft)' }}>
              {['#', 'Partner', 'City', 'Sales', 'Yearly / Quarterly', 'Refunded', 'Revenue', 'Commission', 'KYC'].map(h => <th key={h} className="py-2.5 px-3 font-bold whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-2 px-3 font-black">{i + 1}</td>
                  <td className="py-2 px-3"><b>{r.p.name}</b> <span style={{ color: 'var(--soft)' }}>· {r.p.code}</span></td>
                  <td className="py-2 px-3">{r.p.city || '-'}</td>
                  <td className="py-2 px-3 font-black">{r.sales}</td>
                  <td className="py-2 px-3">{r.yearly} / {r.quarterly}</td>
                  <td className="py-2 px-3">{r.refunded || '-'}</td>
                  <td className="py-2 px-3">{inr(r.revenue)}</td>
                  <td className="py-2 px-3">{inr(r.commission)}</td>
                  <td className="py-2 px-3 whitespace-nowrap" style={{ color: KYC[r.p.kyc_status].color }}>{KYC[r.p.kyc_status].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[12px] mt-3" style={{ color: 'var(--soft)' }}>Commission before the monthly bonus and TDS. Sales are counted on payment date (India time).</p>
    </div>
  );
}

export default function AdminPartners() {
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [view, setView] = useState<'partners' | 'leaderboard' | 'payouts'>('partners');
  const [statusF, setStatusF] = useState<'active' | 'applied' | 'all'>('active');
  const [kycF, setKycF] = useState<'all' | Kyc>('all');
  const [joined, setJoined] = useState<DateRange>(() => rangeFor('all'));
  const [sort, setSort] = useState<'newest' | 'sales'>('newest');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [tempPin, setTempPin] = useState<{ id: string; name: string; phone: string; pin: string } | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    fetch('/api/admin/partners', { credentials: 'same-origin' })
      .then(r => { if (r.status === 401) { navigate('/admin/login'); throw new Error('unauthorized'); } return r.json(); })
      .then(d => (d.error ? setError(d.error) : setPartners(d.partners)))
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    fetch('/api/admin/whoami', { credentials: 'same-origin' })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setDisplayName(d.displayName); load(); })
      .catch(() => navigate('/admin/login'));
  }, [navigate, load]);

  const act = async (id: string, body: Record<string, unknown>) => {
    setError('');
    const r = await fetch('/api/admin/partners', {
      method: 'PATCH', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setError(d.error || 'Could not update');
    load();
    return r.ok ? d : null;
  };

  const resetPin = async (p: Partner) => {
    if (!window.confirm(`Reset the PIN for ${p.name}? They will be logged out and must choose a new PIN after logging in with the temporary one.`)) return;
    const d = await act(p.id, { action: 'reset_pin' });
    if (d?.tempPin) setTempPin({ id: p.id, name: p.name, phone: p.phone, pin: d.tempPin });
  };

  const copy = (key: string, text: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); };

  const logout = async () => { setLoggingOut(true); try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); } finally { navigate('/admin/login'); } };

  if (!displayName) return null;
  const all = partners || [];
  const live = all.filter(p => p.status === 'approved' || p.status === 'paused');
  const needle = q.trim().toLowerCase();
  const shown = all
    .filter(p => statusF === 'all' || (statusF === 'active' ? p.status === 'approved' || p.status === 'paused' : p.status === 'applied'))
    .filter(p => kycF === 'all' || p.kyc_status === kycF)
    .filter(p => joined.preset === 'all' || inRange(p.applied_at, joined))
    .filter(p => !needle || [p.name, p.phone, p.email, p.code, p.city].some(v => (v || '').toLowerCase().includes(needle)))
    .sort((a, b) => (sort === 'sales' ? b.totals.sales - a.totals.sales : 0) || (b.applied_at < a.applied_at ? -1 : 1));
  const btn = 'text-[12px] font-bold px-3 py-1.5 rounded-lg';
  const box = { border: '1px solid var(--border)' };
  const chip = (on: boolean) => ({ background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--dim)' : 'var(--soft)', border: '1px solid var(--border)' });
  const count = (k: Kyc) => live.filter(p => p.kyc_status === k).length;
  const sellingThisMonth = live.filter(p => p.orders.some(o => o.status === 'paid' && inRange(o.paid_at, rangeFor('this_month')))).length;

  return (
    <AdminLayout currentPath={location.pathname} pageTitle="Sales Partners"
      pageSubtitle="Onboarding, KYC, sales and payouts (India)"
      displayName={displayName} onLogout={logout} loggingOut={loggingOut}>
      <div className="flex gap-1 p-1 rounded-xl mb-5 w-fit" style={box}>
        {([['partners', `Partners (${live.length})`], ['leaderboard', 'Leaderboard'], ['payouts', 'Payouts']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className="text-[13px] font-bold px-4 py-2 rounded-lg" style={view === k ? { background: 'var(--ink)', color: 'var(--dim)' } : { color: 'var(--soft)' }}>
            {l}{k === 'partners' && count('to_check') > 0 ? <span className="ml-1.5 text-[11px] px-1.5 rounded-full" style={{ background: '#dc2626', color: '#fff' }}>{count('to_check')}</span> : null}
          </button>
        ))}
        <a href="/partners" target="_blank" rel="noopener noreferrer" className="text-[12px] font-bold px-3 py-2" style={{ color: 'var(--soft)' }}>Public page ↗</a>
      </div>
      {tempPin && (
        <div className="rounded-2xl p-5 mb-4" style={{ border: '2px solid #16a34a', background: 'rgba(22,163,74,.06)' }}>
          <div className="font-black text-[15px] mb-1">Temporary PIN for {tempPin.name}: <span className="font-mono text-[22px] tracking-[.25em] ml-1">{tempPin.pin}</span></div>
          <div className="text-[13px] mb-3" style={{ color: 'var(--soft)' }}>Shown only now. Send it on WhatsApp; they'll choose their own PIN after logging in.</div>
          <div className="flex gap-2 flex-wrap">
            <a className={btn} style={{ background: '#25D366', color: '#fff' }} target="_blank" rel="noopener noreferrer"
              href={`https://wa.me/91${tempPin.phone}?text=${encodeURIComponent(`Hi ${tempPin.name.split(' ')[0]}, your temporary Studdy Lab partner PIN is ${tempPin.pin}. Log in at https://studdylab.com/partner/login with your WhatsApp number and this PIN, then choose your own PIN.`)}`}>Send on WhatsApp</a>
            <button className={btn} style={{ border: '1px solid var(--border)' }} onClick={() => setTempPin(null)}>Done</button>
          </div>
        </div>
      )}
      {error && <div className="rounded-xl p-3 mb-4 text-[13px]" style={{ color: '#dc2626', border: '1px solid rgba(239,68,68,.3)' }}>{error}</div>}

      {view === 'payouts' ? <PartnerPayouts /> : view === 'leaderboard' ? (partners ? <Leaderboard partners={all} /> : <p style={{ color: 'var(--soft)' }}>Loading…</p>) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3 text-[13px]">
            {[
              ['Joined today', live.filter(p => inRange(p.applied_at, rangeFor('today'))).length, () => { setJoined(rangeFor('today')); setKycF('all'); }],
              ['Joined this month', live.filter(p => inRange(p.applied_at, rangeFor('this_month'))).length, () => { setJoined(rangeFor('this_month')); setKycF('all'); }],
              ['Total partners', live.length, () => { setJoined(rangeFor('all')); setKycF('all'); }],
              ['Selling this month', sellingThisMonth, () => setView('leaderboard')],
            ].map(([l, v, on]) => (
              <button key={l as string} onClick={on as () => void} className="rounded-xl p-3 text-left" style={box}>
                <div style={{ color: 'var(--soft)' }}>{l as string}</div><div className="font-black text-[22px]">{v as number}</div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 text-[13px]">
            {(['to_check', 'incomplete', 'none', 'checked'] as Kyc[]).map(k => (
              <button key={k} onClick={() => setKycF(kycF === k ? 'all' : k)} className="rounded-xl p-3 text-left"
                style={{ border: `1.5px solid ${kycF === k ? KYC[k].color : 'var(--border)'}` }}>
                <div style={{ color: KYC[k].color }} className="font-bold">{KYC[k].label}</div>
                <div className="font-black text-[22px]">{count(k)}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-bold mr-1" style={{ color: 'var(--soft)' }}>Joined:</span>
              <DateRangeFilter value={joined} onChange={setJoined} allowAll />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['active', 'applied', 'all'] as const).map(f => (
                <button key={f} onClick={() => setStatusF(f)} className={btn} style={chip(statusF === f)}>
                  {f === 'active' ? 'Active & paused' : f === 'applied' ? 'Awaiting approval' : 'All incl. rejected'}
                </button>
              ))}
              {kycF !== 'all' && <button className={btn} style={chip(true)} onClick={() => setKycF('all')}>{KYC[kycF].label} ✕</button>}
              <select value={sort} onChange={e => setSort(e.target.value as 'newest' | 'sales')} className="text-[12.5px] px-3 py-1.5 rounded-lg" style={{ ...box, background: 'transparent', color: 'var(--ink)' }}>
                <option value="newest">Newest first</option><option value="sales">Most sales first</option>
              </select>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, phone, email, code, city"
                className="ml-auto text-[13px] px-3 py-1.5 rounded-lg min-w-[240px]" style={{ ...box, background: 'transparent', color: 'var(--ink)' }} />
            </div>
            <div className="text-[12px]" style={{ color: 'var(--soft)' }}>Showing {shown.length} partner(s)</div>
          </div>
      {!partners ? <p style={{ color: 'var(--soft)' }}>Loading…</p> : shown.length === 0 ? (
        <p className="text-[14px]" style={{ color: 'var(--soft)' }}>No partners match these filters.</p>
      ) : (
        <div className="space-y-3">
          {shown.map(p => {
            const link = p.code ? `https://studdylab.com/?ref=${p.code}` : '';
            return (
              <div key={p.id} className="rounded-2xl p-5" style={{ border: '1px solid var(--border)', background: 'var(--card, transparent)' }}>
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div>
                    <div className="font-black text-[16px]">{p.name} <span className="text-[11px] font-black uppercase ml-1" style={{ color: STATUS_COLORS[p.status] }}>{p.status}</span>
                      <span className="text-[11px] font-black ml-2 px-2 py-0.5 rounded-full" style={{ color: KYC[p.kyc_status].color, border: `1px solid ${KYC[p.kyc_status].color}` }}>{KYC[p.kyc_status].label}</span></div>
                    <div className="text-[13px]" style={{ color: 'var(--soft)' }}>
                      <a className="underline" href={`https://wa.me/91${p.phone}`} target="_blank" rel="noopener noreferrer">+91 {p.phone}</a> · {p.email}{p.city ? ` · ${p.city}` : ''}{p.occupation ? ` · ${p.occupation}` : ''}
                    </div>
                    <div className="text-[12px]" style={{ color: 'var(--soft)' }}>
                      Joined {new Date(p.applied_at).toLocaleDateString('en-IN')}
                      {' · '}{p.last_login_at ? `last login ${new Date(p.last_login_at).toLocaleDateString('en-IN')}` : 'never logged in'}
                      {!p.has_pin && <b style={{ color: '#d97706' }}> · no PIN yet</b>}
                      {p.pin_must_change && <b style={{ color: '#d97706' }}> · temporary PIN</b>}
                      {p.locked && <b style={{ color: '#dc2626' }}> · locked (wrong PINs)</b>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {p.status === 'applied' && <>
                      <button className={btn} style={{ background: '#16a34a', color: '#fff' }} onClick={() => act(p.id, { action: 'approve' })}>Approve</button>
                      <button className={btn} style={{ border: '1px solid var(--border)', color: 'var(--soft)' }} onClick={() => act(p.id, { action: 'reject' })}>Reject</button>
                    </>}
                    {p.status === 'approved' && <button className={btn} style={{ border: '1px solid var(--border)', color: 'var(--soft)' }} onClick={() => act(p.id, { action: 'pause' })}>Pause</button>}
                    {(p.status === 'paused' || p.status === 'rejected') && <button className={btn} style={{ border: '1px solid var(--border)', color: 'var(--soft)' }} onClick={() => act(p.id, { action: 'resume' })}>{p.status === 'rejected' ? 'Approve' : 'Resume'}</button>}
                  </div>
                </div>
                {(p.experience || p.why_join) && (
                  <div className="text-[13px] mt-2" style={{ color: 'var(--soft)' }}>
                    {p.experience && <div><b>Experience:</b> {p.experience}</div>}
                    {p.why_join && <div><b>Could share with:</b> {p.why_join}</div>}
                  </div>
                )}
                {p.code && (
                  <div className="mt-3 grid sm:grid-cols-4 gap-2 text-[13px]">
                    <div><div style={{ color: 'var(--soft)' }}>Sales</div><b>{p.totals.sales}</b></div>
                    <div><div style={{ color: 'var(--soft)' }}>Earned</div><b>{inr(p.totals.earned)}</b></div>
                    <div><div style={{ color: 'var(--soft)' }}>Payable now</div><b>{inr(p.totals.payable)}</b></div>
                    <div><div style={{ color: 'var(--soft)' }}>In 7-day window</div><b>{inr(p.totals.pending)}</b></div>
                  </div>
                )}
                {p.code && (
                  <div className="mt-3 rounded-xl p-3 text-[12.5px]" style={{ background: 'var(--surface-soft, rgba(0,0,0,.03))', border: '1px solid var(--border)' }}>
                    {p.bank_account ? (
                      <div className="font-mono" style={{ color: 'var(--ink)' }}>
                        {p.bank_holder} · A/c {p.bank_account} · {p.bank_ifsc}{p.bank_name ? ` · ${p.bank_name}` : ''}{p.payout_upi ? ` · UPI ${p.payout_upi}` : ''} · PAN {p.pan || '-'}
                      </div>
                    ) : <div style={{ color: '#b45309' }}><b>No bank details yet.</b> Payouts are held until they add them.</div>}
                    <div className="mt-1" style={{ color: 'var(--soft)' }}>
                      Aadhaar {p.aadhaar_last4 ? `XXXX XXXX ${p.aadhaar_last4}` : <b style={{ color: '#b45309' }}>not added</b>}
                      {p.aadhaar_consent_at && ` (consent ${new Date(p.aadhaar_consent_at).toLocaleDateString('en-IN')})`}
                      {' · '}photos: PAN {p.has_pan_photo ? '✓' : <b style={{ color: '#b45309' }}>missing</b>}
                      , Aadhaar front {p.has_aadhaar_front ? '✓' : <b style={{ color: '#b45309' }}>missing</b>}
                      , back {p.has_aadhaar_back ? '✓' : <b style={{ color: '#b45309' }}>missing</b>}
                      {p.details_updated_at && <> · details {p.details_checked_at ? <b style={{ color: '#16a34a' }}>checked ✓</b> : <b style={{ color: '#b45309' }}>changed, not checked yet</b>}</>}
                    </div>
                  </div>
                )}
                {p.code && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button className={btn} style={{ border: '1px solid var(--border)' }} onClick={() => copy(p.id + 'l', link)}>{copied === p.id + 'l' ? 'Copied ✓' : `Copy sales link (${p.code})`}</button>
                    <button className={btn} style={{ border: '1px solid var(--border)' }} onClick={() => resetPin(p)}>Reset PIN</button>
{([['pan', 'PAN', p.has_pan_photo], ['aadhaar_front', 'Aadhaar front', p.has_aadhaar_front], ['aadhaar_back', 'Aadhaar back', p.has_aadhaar_back]] as const)
                      .filter(([, , has]) => has).map(([kind, label]) => (
                      <button key={kind} className={btn} style={{ border: '1px solid var(--border)' }} onClick={async () => {
                        const w = window.open('', '_blank');
                        const d = await act(p.id, { action: 'doc_url', kind });
                        if (d?.url && w) w.location.href = d.url; else w?.close();
                      }}>View {label}</button>
                    ))}
                    {p.details_complete && !p.details_checked_at && (
                      <button className={btn} style={{ background: '#16a34a', color: '#fff' }} onClick={() => {
                        if (window.confirm(`Have you checked ${p.name}'s PAN and Aadhaar photos: the name matches the bank account holder "${p.bank_holder}"?`)) act(p.id, { action: 'details_checked' });
                      }}>Mark details checked</button>
                    )}
                    {p.sales_ever === 0 && (
                      <button className={btn} style={{ border: '1px solid rgba(239,68,68,.35)', color: '#dc2626' }} onClick={() => {
                        if (window.confirm(`Delete ${p.name} permanently? This cannot be undone.`)) act(p.id, { action: 'delete' });
                      }}>Delete</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </AdminLayout>
  );
}

/**
 * /partner - a logged-in sales partner's earnings page (login: /partner/login): their
 * link, the next payout (10th of each month for last month's sales), and
 * earnings for This month / Last month / All time / a custom date range,
 * with sales listed (customer details masked).
 */
import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, LogOut, KeyRound, MessageCircle, PartyPopper } from 'lucide-react';
import Confetti from '../components/Confetti';

/* Choose a new PIN - forced after an admin reset (no current PIN needed), or voluntary. */
function SetPin({ forced, onDone, onCancel }: { forced: boolean; onDone: () => void; onCancel?: () => void }) {
  const [cur, setCur] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (p1.length !== 6) return setErr('Your new PIN must be 6 digits.');
    if (p1 !== p2) return setErr('The two PINs don’t match.');
    setBusy(true);
    const r = await fetch('/api/partners/auth', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change_pin', currentPin: cur, newPin: p1 }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error || 'Could not save your PIN.');
    onDone();
  };
  const f = 'w-full rounded-xl px-4 py-3 text-[18px] tracking-[.4em] font-bold outline-none bg-white';
  const fs = { border: '1.5px solid var(--border)', color: 'var(--ink)' };
  return (
    <form onSubmit={save} className="bg-white rounded-3xl p-7 w-full max-w-[420px]" style={{ border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.08)' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--grad)' }}><KeyRound size={20} color="#fff" /></div>
      <h1 className="font-black text-[22px] mb-1">{forced ? 'Choose your own PIN' : 'Change your PIN'}</h1>
      <p className="text-[13.5px] mb-5" style={{ color: 'var(--soft)' }}>{forced ? 'You logged in with a temporary PIN. Set a 6-digit PIN only you know.' : 'Enter your current PIN, then your new one twice.'}</p>
      {!forced && <input className={`${f} mb-3`} style={fs} type="password" inputMode="numeric" placeholder="Current PIN" value={cur} onChange={e => setCur(digits(e.target.value))} autoComplete="current-password" />}
      <input className={`${f} mb-3`} style={fs} type="password" inputMode="numeric" placeholder="New PIN" value={p1} onChange={e => setP1(digits(e.target.value))} autoComplete="new-password" />
      <input className={f} style={fs} type="password" inputMode="numeric" placeholder="New PIN again" value={p2} onChange={e => setP2(digits(e.target.value))} autoComplete="new-password" />
      {err && <div role="alert" className="rounded-xl p-3 mt-4 text-[13px]" style={{ background: 'rgba(239,68,68,.06)', color: '#dc2626' }}>{err}</div>}
      <button className="gbtn w-full py-3.5 mt-5 text-[15px]" disabled={busy}>{busy ? 'Saving…' : 'Save PIN'}</button>
      {onCancel && <button type="button" onClick={onCancel} className="w-full text-[13px] font-bold mt-3" style={{ color: 'var(--soft)' }}>Cancel</button>}
    </form>
  );
}

interface Sale { order_id: string; paid_at: string; plan: string; amount: number; customer: string; commission: number; state: 'payable' | 'in_refund_window' | 'refunded'; clears_at: string; payout_on: string }
interface Month { month: string; sales: number; refunded: number; commission: number; bonus: number; total: number; payable: number; pending: number }
interface Data { name: string; phone: string; email: string; mustChangePin: boolean; code: string; status: string; sales: Sale[]; months: Month[]; totals: { sales: number; earned: number; payable: number; pending: number; bonus: number } }

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
/** YYYY-MM-DD in India time - matches how the server assigns sales to months. */
const istDate = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const longDay = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
type RangeKey = 'this' | 'last' | 'all' | 'custom';

function monthBounds(offset: number) {
  const [y, m] = istDate(new Date()).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return { ym, from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}

const monthName = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export default function PartnerDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [range, setRange] = useState<RangeKey>('this');
  const [from, setFrom] = useState(() => monthBounds(0).from);
  const [to, setTo] = useState(() => istDate(new Date()));
  const [changingPin, setChangingPin] = useState(false);
  const [welcome] = useState(() => new URLSearchParams(window.location.search).get('welcome') === '1');

  const view = useMemo(() => {
    if (!data) return null;
    let f = '0000-00-00', t = '9999-12-31';
    if (range === 'this') ({ from: f, to: t } = monthBounds(0));
    if (range === 'last') ({ from: f, to: t } = monthBounds(-1));
    if (range === 'custom') { f = from || f; t = to || t; }
    const sales = data.sales.filter(s => { const d = istDate(s.paid_at); return d >= f && d <= t; });
    const counted = sales.filter(s => s.state !== 'refunded');
    const commission = counted.reduce((a, s) => a + s.commission, 0);
    /* A month's bonus belongs to the range when the month overlaps it. */
    const bonus = data.months
      .filter(m => `${m.month}-31` >= f && `${m.month}-01` <= t)
      .reduce((a, m) => a + m.bonus, 0);
    return { sales, count: counted.length, refunded: sales.length - counted.length, commission, bonus, total: commission + bonus };
  }, [data, range, from, to]);

  /* Next payout: on/before the 10th → this month's 10th pays last month;
     after the 10th → next month's 10th pays this month. */
  const next = useMemo(() => {
    if (!data) return null;
    const today = istDate(new Date());
    const beforeTenth = Number(today.slice(8, 10)) <= 10;
    const forMonth = monthBounds(beforeTenth ? -1 : 0).ym;
    const payMonth = monthBounds(beforeTenth ? 0 : 1).ym;
    const m = data.months.find(x => x.month === forMonth);
    return { on: `${payMonth}-10`, forMonth, amount: m ? m.total : 0 };
  }, [data]);

  const load = () => fetch('/api/partners/me', { credentials: 'same-origin' })
    .then(r => { if (r.status === 401) { window.location.replace('/partner/login'); throw new Error('login'); } return r.json(); })
    .then(d => (d.error ? setError(d.error) : setData(d)))
    .catch(e => { if (e.message !== 'login') setError('Could not load your page. Please refresh.'); });

  useEffect(() => {
    document.title = 'Partner dashboard · Studdy Lab';
    /* Old private links (/partner?t=...) no longer open the page - log in instead. */
    if (new URLSearchParams(window.location.search).get('t')) { window.location.replace('/partner/login?moved=1'); return; }
    load();
    if (welcome) window.history.replaceState(null, '', '/partner');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    await fetch('/api/partners/auth', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }).catch(() => {});
    window.location.href = '/partner/login';
  };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--dim)' }}>
      <div className="bg-white rounded-3xl p-8 max-w-[420px] text-center" style={{ border: '1.5px solid var(--border)' }}>
        <div className="font-black text-[22px] mb-3"><span className="grad-text">studdy</span></div>
        <p className="text-[14px] mb-5" style={{ color: 'var(--soft)' }}>{error}</p>
        <a href="/partner/login" className="gbtn w-full py-3 flex justify-center">Log in</a>
      </div>
    </div>
  );
  if (!data) return <div className="min-h-screen" style={{ background: 'var(--dim)' }} />;
  if (data.mustChangePin || changingPin) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--dim)' }}>
      <SetPin forced={data.mustChangePin} onCancel={data.mustChangePin ? undefined : () => setChangingPin(false)}
        onDone={() => { setChangingPin(false); setData({ ...data, mustChangePin: false }); }} />
    </div>
  );

  const link = `https://studdylab.com/?ref=${data.code}`;
  const shareText = `I use and recommend Studdy, an AI tutor that explains any doubt step by step on a whiteboard, for school, exams, college and work skills. Have a look: ${link}`;
  const card = 'bg-white rounded-2xl p-5';
  const cardStyle = { border: '1.5px solid var(--border)' };

  return (
    <div className="min-h-screen" style={{ background: 'var(--dim)' }}>
      {welcome && <Confetti />}
      <header className="bg-white h-16 flex items-center justify-between gap-3 px-4 sm:px-6 sticky top-0 z-40" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="font-black text-[20px] whitespace-nowrap"><span className="grad-text">studdy</span> <span className="text-[13px] font-bold" style={{ color: 'var(--soft)' }}>Partner</span></div>
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <span className="hidden sm:block text-[13px] font-semibold truncate mr-2" style={{ color: 'var(--soft)' }}>{data.name}</span>
          <button onClick={() => setChangingPin(true)} className="text-[12.5px] font-bold px-3 py-2 rounded-lg flex items-center gap-1.5" style={{ color: 'var(--soft)' }}><KeyRound size={14} /> <span className="hidden sm:inline">Change PIN</span></button>
          <button onClick={logout} className="text-[12.5px] font-bold px-3 py-2 rounded-lg flex items-center gap-1.5" style={{ color: 'var(--soft)', border: '1px solid var(--border)' }}><LogOut size={14} /> Log out</button>
        </div>
      </header>

      <div className="max-w-[760px] mx-auto px-4 py-8">
        {welcome && (
          <div className="rounded-3xl p-6 mb-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(120deg,#EF55B6,#8C79E0 55%,#25A8F4)' }}>
            <PartyPopper size={28} className="mb-2" />
            <div className="font-black text-[22px] leading-tight mb-1">Welcome aboard, {data.name.split(' ')[0]}!</div>
            <div className="text-[14px] opacity-90">Your partner account is live. Copy your link below and share it today. From now on, log in at studdylab.com/partner/login with your WhatsApp number and PIN.</div>
          </div>
        )}
        {data.status === 'paused' && (
          <div className="rounded-xl p-4 mb-4 text-[13px]" style={{ background: 'rgba(245,158,11,.08)', color: '#92400e', border: '1px solid rgba(245,158,11,.3)' }}>
            Your partner account is paused. Earlier sales are still shown and paid. Message us to reactivate.
          </div>
        )}

        <div className={`${card} mb-4`} style={cardStyle}>
          <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--soft)' }}>Your personal link</div>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[15px] font-bold break-all flex-1" style={{ color: 'var(--ink)' }}>{link}</code>
            <button className="gbtn text-[13px] px-4 py-2 flex items-center gap-1"
              onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"
              className="text-[13px] font-bold px-4 py-2 rounded-full flex items-center gap-1.5 text-white" style={{ background: '#25D366' }}>
              <MessageCircle size={14} /> Share
            </a>
          </div>
          <p className="text-[12.5px] mt-2" style={{ color: 'var(--soft)' }}>Every purchase made through this link is credited to you (code <b>{data.code}</b>).</p>
        </div>

        {next && (
          <div className="rounded-2xl p-5 mb-4 text-white" style={{ background: 'var(--grad)' }}>
            <div className="text-[11px] font-black uppercase tracking-wide opacity-90">Next payout · {longDay(next.on)}</div>
            <div className="font-black text-[30px] leading-tight">{inr(next.amount)}</div>
            <div className="text-[12.5px] opacity-90">For your {monthName(next.forMonth)} sales, before TDS.</div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap mb-3" role="tablist" aria-label="Time range">
          {([['this', 'This month'], ['last', 'Last month'], ['all', 'All time'], ['custom', 'Custom']] as [RangeKey, string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)}
              className="text-[13px] font-bold px-4 py-2 rounded-full"
              style={range === k ? { background: 'var(--ink)', color: '#fff' } : { background: '#fff', color: 'var(--ink)', border: '1px solid var(--border)' }}>
              {l}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex gap-3 flex-wrap items-end mb-3">
            <label className="text-[12px] font-bold" style={{ color: 'var(--soft)' }}>From
              <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="block mt-1 rounded-lg px-3 py-2 bg-white" style={{ border: '1px solid var(--border)', color: 'var(--ink)' }} /></label>
            <label className="text-[12px] font-bold" style={{ color: 'var(--soft)' }}>To
              <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="block mt-1 rounded-lg px-3 py-2 bg-white" style={{ border: '1px solid var(--border)', color: 'var(--ink)' }} /></label>
          </div>
        )}

        {view && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              ['Sales', String(view.count) + (view.refunded ? ` (+${view.refunded} refunded)` : '')],
              ['Commission', inr(view.commission)],
              ['Bonus', inr(view.bonus)],
              ['Total earned', inr(view.total)],
            ].map(([l, v]) => (
              <div key={l} className={card} style={cardStyle}>
                <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--soft)' }}>{l}</div>
                <div className="font-black text-[20px]" style={{ color: 'var(--ink)' }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        <h2 className="font-black text-[17px] mb-3">By month</h2>
        <div className={`${card} mb-6`} style={cardStyle}>
          {data.months.length === 0 ? (
            <p className="text-[14px]" style={{ color: 'var(--soft)' }}>No sales yet. Share your link to get your first one!</p>
          ) : data.months.map(m => (
            <div key={m.month} className="flex justify-between items-center py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <div className="font-bold text-[14px]">{monthName(m.month)}</div>
                <div className="text-[12px]" style={{ color: 'var(--soft)' }}>
                  {m.sales} sale{m.sales === 1 ? '' : 's'}{m.refunded ? ` · ${m.refunded} refunded` : ''}{m.bonus ? ` · bonus ${inr(m.bonus)}` : m.sales < 10 ? ` · ${10 - m.sales} more for ₹5,000 bonus` : ''}
                </div>
              </div>
              <div className="font-black text-[15px]">{inr(m.total)}</div>
            </div>
          ))}
        </div>

        <h2 className="font-black text-[17px] mb-3">Sales</h2>
        <div className={card} style={cardStyle}>
          {!view || view.sales.length === 0 ? (
            <p className="text-[14px]" style={{ color: 'var(--soft)' }}>{data.sales.length ? 'No sales in this period.' : 'Your sales will appear here.'}</p>
          ) : view.sales.map(s => (
            <div key={s.order_id} className="flex justify-between items-center py-2.5 gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="min-w-0">
                <div className="font-bold text-[14px] truncate">{s.customer}</div>
                <div className="text-[12px]" style={{ color: 'var(--soft)' }}>
                  {day(s.paid_at)} · {s.plan === 'yearly' ? 'Yearly' : 'Quarterly'} {inr(s.amount)} ·{' '}
                  {s.state === 'refunded' ? 'refunded' : `paid on ${day(s.payout_on)}`}
                </div>
              </div>
              <div className="font-black text-[14px]" style={{ color: s.state === 'refunded' ? 'var(--soft)' : 'var(--ink)' }}>{inr(s.commission)}</div>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-center mt-6" style={{ color: 'var(--soft)' }}>
          Payouts on the 10th of every month for the previous month’s sales. Refunded sales earn no commission. TDS is deducted as per law. Never share your PIN. See the <a className="underline" href="/partner-terms">Partner Terms</a>.
        </p>
      </div>
    </div>
  );
}

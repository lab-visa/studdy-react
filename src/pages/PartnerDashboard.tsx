/**
 * /partner - a logged-in sales partner's dashboard (login: /partner/login).
 * Earnings (this month, bonus progress, next payout, sales with date filters),
 * Get paid (bank details, UPI, PAN + PAN photo, payout history) and a Share kit.
 * No Aadhaar is ever asked for.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy, Check, LogOut, KeyRound, MessageCircle, PartyPopper, Wallet, Landmark, Upload, AlertTriangle,
  TrendingUp, CalendarClock, BadgeIndianRupee, Pencil, ShieldCheck, Megaphone, BarChart3,
} from 'lucide-react';
import Confetti from '../components/Confetti';

interface Sale { order_id: string; paid_at: string; plan: string; amount: number; customer: string; commission: number; state: 'payable' | 'in_refund_window' | 'refunded'; clears_at: string; payout_on: string }
interface Month { month: string; sales: number; refunded: number; commission: number; bonus: number; total: number; payable: number; pending: number }
interface Details { complete: boolean; holder: string | null; account: string | null; ifsc: string | null; bankName: string | null; branch: string | null; upi: string | null; pan: string | null; hasPanPhoto: boolean; updatedAt: string | null }
interface Payout { month: string; sales: number; commission: number; bonus: number; gross: number; tds_rate: number; tds: number; net: number; utr: string; paid_on: string }
interface Data {
  name: string; phone: string; email: string; mustChangePin: boolean; code: string; status: string;
  sales: Sale[]; months: Month[]; totals: { sales: number; earned: number; payable: number; pending: number; bonus: number };
  payoutDetails: Details; payouts: Payout[]; tdsRate: number;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const istDate = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const longDay = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const monthName = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
type RangeKey = 'this' | 'last' | 'all' | 'custom';
type Tab = 'earnings' | 'paid' | 'share';

function monthBounds(offset: number) {
  const [y, m] = istDate(new Date()).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return { ym, from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}

function useCountUp(target: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 1100);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

function CopyBtn({ text, label = 'Copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1800); }}
      className={`text-[13px] font-bold px-4 py-2 rounded-full inline-flex items-center gap-1.5 ${className}`}
      style={{ background: ok ? 'rgba(34,197,94,.12)' : 'var(--dim)', color: ok ? '#16a34a' : 'var(--ink)', border: '1px solid var(--border)' }}>
      {ok ? <Check size={14} /> : <Copy size={14} />} {ok ? 'Copied' : label}
    </button>
  );
}

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
    <form onSubmit={save} className="bg-white rounded-3xl p-7 w-full max-w-[420px]" style={{ boxShadow: '0 30px 80px rgba(0,0,0,.35)' }}>
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

/* Shrinks a phone photo to max 1600px JPEG so uploads stay small and fast. */
async function toJpegDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PayoutDetailsForm({ details, onSaved }: { details: Details; onSaved: (d: Details) => void }) {
  const [editing, setEditing] = useState(!details.holder);
  const [f, setF] = useState({ holder: details.holder || '', account: '', account2: '', ifsc: details.ifsc || '', bankName: details.bankName || '', branch: details.branch || '', upi: details.upi || '', pan: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  /* IFSC → bank and branch (free public lookup; manual entry still works if it fails). */
  useEffect(() => {
    const code = f.ifsc.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) return;
    let live = true;
    fetch(`https://ifsc.razorpay.com/${code}`).then(r => (r.ok ? r.json() : null)).then(d => {
      if (live && d?.BANK) setF(x => ({ ...x, bankName: d.BANK, branch: [d.BRANCH, d.CITY].filter(Boolean).join(', ') }));
    }).catch(() => {});
    return () => { live = false; };
  }, [f.ifsc]);

  const post = async (body: Record<string, unknown>) => {
    const r = await fetch('/api/partners/payout-details', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Could not save. Please try again.');
    return d.details as Details;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try { onSaved(await post({ action: 'save', ...f })); setEditing(false); }
    catch (x) { setErr(x instanceof Error ? x.message : 'Could not save.'); }
    finally { setBusy(false); }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setErr('');
    setPhotoBusy(true);
    try {
      const dataUrl = await toJpegDataUrl(file);
      setPreview(dataUrl);
      onSaved(await post({ action: 'pan_photo', photo: dataUrl }));
    } catch (x) {
      setErr(x instanceof Error && x.message ? x.message : 'Could not read that photo. Please try another one.');
      setPreview('');
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const input = 'w-full rounded-xl px-4 py-3 text-[15px] outline-none bg-white';
  const st = { border: '1.5px solid var(--border)', color: 'var(--ink)' };
  const lab = 'block text-[11px] font-black uppercase tracking-wide mb-1.5';
  const set = (k: keyof typeof f, fmt?: (v: string) => string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(x => ({ ...x, [k]: fmt ? fmt(e.target.value) : e.target.value }));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl p-6 sm:p-7" style={{ border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'var(--grad)' }}><Landmark size={20} color="#fff" /></span>
            <div>
              <div className="font-black text-[17px]">Bank details</div>
              <div className="text-[12.5px]" style={{ color: 'var(--soft)' }}>Where we send your payout on the 10th</div>
            </div>
          </div>
          {!editing && <button onClick={() => setEditing(true)} className="text-[12.5px] font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1" style={{ border: '1px solid var(--border)' }}><Pencil size={12} /> Edit</button>}
        </div>

        {!editing ? (
          <div className="grid sm:grid-cols-2 gap-3 text-[14px]">
            {[
              ['Account holder', details.holder], ['Account number', details.account], ['IFSC', details.ifsc],
              ['Bank', [details.bankName, details.branch].filter(Boolean).join(' · ') || '-'], ['UPI ID', details.upi || 'Not added'], ['PAN', details.pan],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl p-3.5" style={{ background: 'var(--dim)' }}>
                <div className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: 'var(--soft)' }}>{k}</div>
                <div className="font-bold break-all">{v}</div>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={save} noValidate>
            <div className="grid sm:grid-cols-2 gap-3.5">
              <label className="sm:col-span-2"><span className={lab} style={{ color: 'var(--soft)' }}>Account holder name (as in bank)</span>
                <input className={input} style={st} value={f.holder} onChange={set('holder')} autoComplete="name" /></label>
              <label><span className={lab} style={{ color: 'var(--soft)' }}>Account number</span>
                <input className={input} style={st} value={f.account} onChange={set('account', v => v.replace(/\D/g, '').slice(0, 18))} inputMode="numeric" autoComplete="off" placeholder={details.account ? `Saved ${details.account}` : ''} /></label>
              <label><span className={lab} style={{ color: 'var(--soft)' }}>Type account number again</span>
                <input className={input} style={st} value={f.account2} onChange={set('account2', v => v.replace(/\D/g, '').slice(0, 18))} inputMode="numeric" autoComplete="off" onPaste={e => e.preventDefault()} /></label>
              <label><span className={lab} style={{ color: 'var(--soft)' }}>IFSC</span>
                <input className={`${input} uppercase`} style={st} value={f.ifsc} onChange={set('ifsc', v => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))} placeholder="SBIN0001234" /></label>
              <label><span className={lab} style={{ color: 'var(--soft)' }}>Bank</span>
                <input className={input} style={{ ...st, background: 'var(--dim)' }} value={[f.bankName, f.branch].filter(Boolean).join(' · ')} onChange={e => setF(x => ({ ...x, bankName: e.target.value, branch: '' }))} placeholder="Fills in from IFSC" /></label>
              <label><span className={lab} style={{ color: 'var(--soft)' }}>UPI ID (optional)</span>
                <input className={input} style={st} value={f.upi} onChange={set('upi', v => v.trim())} placeholder="name@okaxis" autoComplete="off" /></label>
              <label><span className={lab} style={{ color: 'var(--soft)' }}>PAN</span>
                <input className={`${input} uppercase tracking-wider`} style={st} value={f.pan} onChange={set('pan', v => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder={details.pan ? `Saved ${details.pan}` : 'ABCDE1234F'} autoComplete="off" /></label>
            </div>
            <p className="text-[12px] mt-3" style={{ color: 'var(--soft)' }}>
              PAN is required by law for TDS (without it, TDS is 20%). We never ask for Aadhaar.
              {details.holder && ' To change anything, re-enter your account number and PAN.'}
            </p>
            {err && <div role="alert" className="rounded-xl p-3 mt-3 text-[13px]" style={{ background: 'rgba(239,68,68,.06)', color: '#dc2626' }}>{err}</div>}
            <div className="flex gap-2 mt-5">
              <button className="gbtn px-6 py-3 text-[14.5px]" disabled={busy}>{busy ? 'Saving…' : 'Save bank details'}</button>
              {details.holder && <button type="button" onClick={() => setEditing(false)} className="px-4 text-[13.5px] font-bold" style={{ color: 'var(--soft)' }}>Cancel</button>}
            </div>
          </form>
        )}
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-7" style={{ border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(140,121,224,.12)' }}><ShieldCheck size={20} style={{ color: 'var(--g3)' }} /></span>
          <div>
            <div className="font-black text-[17px]">PAN card photo</div>
            <div className="text-[12.5px]" style={{ color: 'var(--soft)' }}>So we can match your PAN name with your bank account. Kept private.</div>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {preview ? <img src={preview} alt="PAN card preview" className="w-28 h-[72px] object-cover rounded-xl" style={{ border: '1px solid var(--border)' }} /> : (
            <div className="w-28 h-[72px] rounded-xl flex items-center justify-center text-[12px] font-bold"
              style={{ background: details.hasPanPhoto ? 'rgba(34,197,94,.1)' : 'var(--dim)', color: details.hasPanPhoto ? '#16a34a' : 'var(--soft)', border: '1px dashed var(--border)' }}>
              {details.hasPanPhoto ? <><Check size={14} className="mr-1" /> Uploaded</> : 'No photo'}
            </div>
          )}
          <div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => upload(e.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy}
              className="gost text-[13.5px] px-5 py-2.5 inline-flex items-center gap-2"><Upload size={15} /> {photoBusy ? 'Uploading…' : details.hasPanPhoto ? 'Replace photo' : 'Upload photo'}</button>
            <div className="text-[11.5px] mt-1.5" style={{ color: 'var(--soft)' }}>Front side, clear and readable. JPG or PNG.</div>
          </div>
        </div>
        {!editing && err && <div role="alert" className="rounded-xl p-3 mt-3 text-[13px]" style={{ background: 'rgba(239,68,68,.06)', color: '#dc2626' }}>{err}</div>}
      </div>
    </div>
  );
}

export default function PartnerDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [range, setRange] = useState<RangeKey>('this');
  const [from, setFrom] = useState(() => monthBounds(0).from);
  const [to, setTo] = useState(() => istDate(new Date()));
  const [tab, setTab] = useState<Tab>('earnings');
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
    const bonus = data.months.filter(m => `${m.month}-31` >= f && `${m.month}-01` <= t).reduce((a, m) => a + m.bonus, 0);
    return { sales, count: counted.length, refunded: sales.length - counted.length, commission, bonus, total: commission + bonus };
  }, [data, range, from, to]);

  const next = useMemo(() => {
    if (!data) return null;
    const beforeTenth = Number(istDate(new Date()).slice(8, 10)) <= 10;
    const forMonth = monthBounds(beforeTenth ? -1 : 0).ym;
    const payMonth = monthBounds(beforeTenth ? 0 : 1).ym;
    const m = data.months.find(x => x.month === forMonth);
    const paid = data.payouts.find(p => p.month === forMonth);
    return { on: `${payMonth}-10`, forMonth, amount: m ? m.total : 0, paid };
  }, [data]);

  const thisMonth = data?.months.find(m => m.month === monthBounds(0).ym);
  const monthTotal = useCountUp(thisMonth?.total ?? 0);
  const monthSales = thisMonth?.sales ?? 0;
  const goal = monthSales < 10 ? 10 : 20;
  const ring = Math.min(1, monthSales / goal);
  const paidOut = (data?.payouts ?? []).reduce((a, p) => a + p.net, 0);

  const load = () => fetch('/api/partners/me', { credentials: 'same-origin' })
    .then(r => { if (r.status === 401) { window.location.replace('/partner/login'); throw new Error('login'); } return r.json(); })
    .then(d => (d.error ? setError(d.error) : setData(d)))
    .catch(e => { if (e.message !== 'login') setError('Could not load your page. Please refresh.'); });

  useEffect(() => {
    document.title = 'Partner dashboard · Studdy Lab';
    if (new URLSearchParams(window.location.search).get('t')) { window.location.replace('/partner/login?moved=1'); return; }
    load();
    if (welcome) window.history.replaceState(null, '', '/partner');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    await fetch('/api/partners/auth', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }).catch(() => {});
    window.location.href = '/partner/login';
  };

  const darkBg = 'radial-gradient(900px 420px at 0% 0%, #3b2a78 0%, transparent 60%), radial-gradient(800px 420px at 100% 0%, #1c4a7a 0%, transparent 55%), #110D20';

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: darkBg }}>
      <div className="bg-white rounded-3xl p-8 max-w-[420px] text-center">
        <div className="font-black text-[22px] mb-3"><span className="grad-text">studdy</span></div>
        <p className="text-[14px] mb-5" style={{ color: 'var(--soft)' }}>{error}</p>
        <a href="/partner/login" className="gbtn w-full py-3 flex justify-center">Log in</a>
      </div>
    </div>
  );
  if (!data) return <div className="min-h-screen" style={{ background: darkBg }} />;
  if (data.mustChangePin || changingPin) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: darkBg }}>
      <SetPin forced={data.mustChangePin} onCancel={data.mustChangePin ? undefined : () => setChangingPin(false)}
        onDone={() => { setChangingPin(false); setData({ ...data, mustChangePin: false }); }} />
    </div>
  );

  const link = `https://studdylab.com/?ref=${data.code}`;
  const first = data.name.split(' ')[0];
  const MESSAGES = [
    { who: 'For parents', text: `Hi! If your child gets stuck on homework or doubts, have a look at Studdy. It's an AI tutor that explains any question step by step on a whiteboard, any subject, any time. Plans from ₹1,250 a month, with a 7-day full refund. ${link}` },
    { who: 'For students & exams', text: `Preparing for boards, JEE, NEET or CUET? Studdy explains any doubt step by step on a whiteboard, as many times as you need, even at 11 pm. ${link}` },
    { who: 'For college & work', text: `Learning something new for college or work, like Excel, coding or accounts? Studdy is an AI tutor that teaches you step by step on a whiteboard. ${link}` },
    { who: 'Short group post', text: `Found a really useful AI tutor for any subject: Studdy. Explains step by step on a whiteboard, with a 7-day full refund. ${link}` },
  ];
  const card = 'bg-white rounded-3xl';
  const cardStyle = { border: '1px solid var(--border)' };
  const R = 52, C = 2 * Math.PI * R;

  return (
    <div className="min-h-screen" style={{ background: 'var(--dim)' }}>
      {welcome && <Confetti />}
      <header className="sticky top-0 z-40 h-16 flex items-center justify-between gap-3 px-4 sm:px-8" style={{ background: 'rgba(17,13,32,.85)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div className="font-black text-[20px] whitespace-nowrap"><span className="grad-text">studdy</span> <span className="text-[12px] font-bold text-white/70">Partner</span></div>
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <span className="hidden sm:block text-[13px] font-semibold truncate mr-2 text-white/75">{data.name}</span>
          <button onClick={() => setChangingPin(true)} className="text-[12.5px] font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 text-white/80 hover:text-white"><KeyRound size={14} /> <span className="hidden sm:inline">Change PIN</span></button>
          <button onClick={logout} className="text-[12.5px] font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 text-white/90" style={{ border: '1px solid rgba(255,255,255,.2)' }}><LogOut size={14} /> Log out</button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative text-white px-4 sm:px-8 pt-8 pb-28" style={{ background: darkBg }}>
        <div aria-hidden className="absolute inset-0 opacity-[.06]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative max-w-[1040px] mx-auto">
          {welcome && (
            <div className="rounded-2xl p-4 mb-6 flex items-start gap-3" style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)' }}>
              <PartyPopper size={22} className="flex-shrink-0 mt-0.5" style={{ color: '#FF9AD8' }} />
              <div className="text-[14px]"><b>Welcome aboard, {first}!</b> Your account is live. Copy your link below and share it today. Next time, log in at studdylab.com/partner/login with your WhatsApp number and PIN.</div>
            </div>
          )}
          {data.status === 'paused' && (
            <div className="rounded-2xl p-4 mb-6 text-[13.5px]" style={{ background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.4)' }}>
              Your partner account is paused. Earlier sales are still shown and paid. Message us to reactivate.
            </div>
          )}
          <div className="grid md:grid-cols-[1fr_auto] gap-8 items-center">
            <div>
              <div className="text-[15px] font-semibold text-white/75 mb-1">Hi {first} 👋 · This month you've earned</div>
              <div className="font-black leading-none tabular-nums mb-3" style={{ fontSize: 'clamp(46px,8vw,76px)', letterSpacing: '-2px', background: 'linear-gradient(90deg,#FF9AD8,#B8A8FF 50%,#7CCBFF)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                {inr(monthTotal)}
              </div>
              <div className="flex items-center gap-2 text-[14px] text-white/80">
                <TrendingUp size={16} style={{ color: '#6EE7A8' }} />
                {monthSales} sale{monthSales === 1 ? '' : 's'} this month
                {monthSales < 20 && <> · <b className="text-white">{goal - monthSales} more</b> for {goal === 10 ? '₹5,000' : '₹10,000 more'} bonus</>}
              </div>
            </div>
            <div className="relative w-[136px] h-[136px] mx-auto md:mx-0" aria-label={`${monthSales} of ${goal} sales towards the bonus`}>
              <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
                <defs><linearGradient id="pd-ring" x1="0" x2="1"><stop offset="0" stopColor="#EF55B6" /><stop offset=".5" stopColor="#8C79E0" /><stop offset="1" stopColor="#25A8F4" /></linearGradient></defs>
                <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="12" />
                <circle cx="64" cy="64" r={R} fill="none" stroke="url(#pd-ring)" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - ring)} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-black text-[30px] leading-none">{monthSales}<span className="text-[15px] text-white/60">/{goal}</span></div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-white/60 mt-1">to bonus</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
            {[
              { Icon: CalendarClock, label: next?.paid ? `Paid · ${monthName(next.forMonth)}` : `Next payout · ${next ? longDay(next.on) : ''}`, value: inr(next?.paid ? next.paid.net : next?.amount ?? 0), sub: next?.paid ? `UTR ${next.paid.utr}` : `For ${next ? monthName(next.forMonth) : ''} sales, before TDS` },
              { Icon: BadgeIndianRupee, label: 'Earned all time', value: inr(data.totals.earned), sub: `${data.totals.sales} sale${data.totals.sales === 1 ? '' : 's'} in total` },
              { Icon: Wallet, label: 'Paid to your bank', value: inr(paidOut), sub: `${data.payouts.length} payout${data.payouts.length === 1 ? '' : 's'}` },
            ].map(({ Icon, label, value, sub }) => (
              <div key={label} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)' }}>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-white/60 mb-1"><Icon size={13} /> {label}</div>
                <div className="font-black text-[24px] tabular-nums">{value}</div>
                <div className="text-[12px] text-white/60 truncate">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-[1040px] mx-auto px-4 sm:px-8 -mt-20 relative pb-14">
        {/* Link */}
        <div className={`${card} p-5 sm:p-6 mb-4`} style={{ ...cardStyle, boxShadow: '0 20px 50px rgba(20,10,60,.15)' }}>
          <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--soft)' }}>Your personal link · code {data.code}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[15px] sm:text-[17px] font-bold break-all flex-1 min-w-[200px]">{link}</code>
            <CopyBtn text={link} />
            <a href={`https://wa.me/?text=${encodeURIComponent(MESSAGES[0].text)}`} target="_blank" rel="noopener noreferrer"
              className="text-[13px] font-bold px-4 py-2 rounded-full inline-flex items-center gap-1.5 text-white" style={{ background: '#25D366' }}>
              <MessageCircle size={14} /> Share on WhatsApp
            </a>
          </div>
          <p className="text-[12.5px] mt-2" style={{ color: 'var(--soft)' }}>Every purchase through this link, or with code <b>{data.code}</b> at checkout, is credited to you.</p>
        </div>

        {!data.payoutDetails.complete && (
          <button onClick={() => setTab('paid')} className="w-full text-left rounded-3xl p-5 mb-4 flex items-center gap-4"
            style={{ background: 'linear-gradient(120deg,#fff7ed,#fff1f2)', border: '1px solid rgba(245,158,11,.35)' }}>
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,.15)' }}><AlertTriangle size={20} style={{ color: '#d97706' }} /></span>
            <span className="flex-1">
              <span className="block font-black text-[15px]" style={{ color: '#92400e' }}>Add your bank details and PAN to get paid</span>
              <span className="block text-[13px]" style={{ color: '#9a6b2f' }}>Without them, your payout is held until the next 10th. Takes 2 minutes.</span>
            </span>
            <span className="hidden sm:block"><span className="gbtn text-[13px] px-4 py-2 inline-flex">Add now</span></span>
          </button>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-5 bg-white overflow-x-auto" style={cardStyle} role="tablist">
          {([['earnings', 'Earnings', BarChart3], ['paid', 'Get paid', Wallet], ['share', 'Share kit', Megaphone]] as const).map(([k, l, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className="flex-1 min-w-[110px] py-2.5 rounded-xl text-[13.5px] font-bold inline-flex items-center justify-center gap-1.5 transition-all"
              style={tab === k ? { background: 'var(--ink)', color: '#fff' } : { color: 'var(--soft)' }}>
              <Icon size={15} /> {l}
              {k === 'paid' && !data.payoutDetails.complete && <span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />}
            </button>
          ))}
        </div>

        {tab === 'earnings' && view && (
          <>
            <div className="flex gap-2 flex-wrap mb-3" role="tablist" aria-label="Time range">
              {([['this', 'This month'], ['last', 'Last month'], ['all', 'All time'], ['custom', 'Custom']] as [RangeKey, string][]).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)}
                  className="text-[13px] font-bold px-4 py-2 rounded-full"
                  style={range === k ? { background: 'var(--grad)', color: '#fff' } : { background: '#fff', color: 'var(--ink)', border: '1px solid var(--border)' }}>{l}</button>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                ['Sales', String(view.count) + (view.refunded ? ` (+${view.refunded} refunded)` : '')],
                ['Commission', inr(view.commission)], ['Bonus', inr(view.bonus)], ['Total earned', inr(view.total)],
              ].map(([l, v], i) => (
                <div key={l} className={`${card} p-5`} style={i === 3 ? { border: '2px solid transparent', background: 'linear-gradient(#fff,#fff) padding-box, var(--grad) border-box' } : cardStyle}>
                  <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--soft)' }}>{l}</div>
                  <div className="font-black text-[22px]">{v}</div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-[1fr_1.3fr] gap-5">
              <div>
                <h2 className="font-black text-[17px] mb-3">By month</h2>
                <div className={`${card} px-5 py-2`} style={cardStyle}>
                  {data.months.length === 0 ? (
                    <p className="text-[14px] py-3" style={{ color: 'var(--soft)' }}>No sales yet. Share your link to get your first one!</p>
                  ) : data.months.map((m, i) => (
                    <div key={m.month} className="flex justify-between items-center py-3" style={{ borderTop: i ? '1px solid var(--border)' : undefined }}>
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
              </div>
              <div>
                <h2 className="font-black text-[17px] mb-3">Sales</h2>
                <div className={`${card} px-5 py-2`} style={cardStyle}>
                  {view.sales.length === 0 ? (
                    <p className="text-[14px] py-3" style={{ color: 'var(--soft)' }}>{data.sales.length ? 'No sales in this period.' : 'Your sales will appear here.'}</p>
                  ) : view.sales.map((s, i) => (
                    <div key={s.order_id} className="flex justify-between items-center py-3 gap-3" style={{ borderTop: i ? '1px solid var(--border)' : undefined }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-black text-white flex-shrink-0" style={{ background: s.state === 'refunded' ? '#9ca3af' : s.plan === 'yearly' ? '#8C79E0' : '#25A8F4' }}>{s.plan === 'yearly' ? 'Y' : 'Q'}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-[14px] truncate">{s.customer}</div>
                          <div className="text-[12px]" style={{ color: 'var(--soft)' }}>
                            {day(s.paid_at)} · {s.plan === 'yearly' ? 'Yearly' : 'Quarterly'} {inr(s.amount)} · {s.state === 'refunded' ? 'refunded' : `paid on ${day(s.payout_on)}`}
                          </div>
                        </div>
                      </div>
                      <div className="font-black text-[14px] whitespace-nowrap" style={{ color: s.state === 'refunded' ? 'var(--soft)' : '#16a34a' }}>{s.state === 'refunded' ? '₹0' : `+${inr(s.commission)}`}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'paid' && (
          <div className="grid lg:grid-cols-[1.25fr_1fr] gap-5 items-start">
            <PayoutDetailsForm details={data.payoutDetails} onSaved={d => setData({ ...data, payoutDetails: d })} />
            <div>
              <h2 className="font-black text-[17px] mb-3">Payout history</h2>
              <div className={`${card} px-5 py-2`} style={cardStyle}>
                {data.payouts.length === 0 ? (
                  <p className="text-[14px] py-3" style={{ color: 'var(--soft)' }}>Your payouts will appear here after the 10th, with TDS and the bank reference.</p>
                ) : data.payouts.map((p, i) => (
                  <div key={p.month} className="py-3.5" style={{ borderTop: i ? '1px solid var(--border)' : undefined }}>
                    <div className="flex justify-between items-baseline">
                      <div className="font-bold text-[14px]">{monthName(p.month)} sales</div>
                      <div className="font-black text-[16px]" style={{ color: '#16a34a' }}>{inr(p.net)}</div>
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: 'var(--soft)' }}>
                      Paid {longDay(p.paid_on)} · {inr(p.gross)} − TDS {inr(p.tds)} ({Number(p.tds_rate)}%) · UTR {p.utr}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[12px] mt-3 px-1" style={{ color: 'var(--soft)' }}>
                Payouts are made on the 10th of every month for the previous month’s sales. TDS ({data.tdsRate}%) is deducted as per law.
              </p>
            </div>
          </div>
        )}

        {tab === 'share' && (
          <div>
            <p className="text-[14px] mb-4" style={{ color: 'var(--soft)' }}>Ready messages with your link already in them. Copy, or send straight on WhatsApp. Please keep it honest: no promises of marks or results.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {MESSAGES.map(m => (
                <div key={m.who} className={`${card} p-5 flex flex-col`} style={cardStyle}>
                  <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--g2)' }}>{m.who}</div>
                  <p className="text-[14px] leading-relaxed flex-1 mb-4 break-words">{m.text}</p>
                  <div className="flex gap-2">
                    <CopyBtn text={m.text} />
                    <a href={`https://wa.me/?text=${encodeURIComponent(m.text)}`} target="_blank" rel="noopener noreferrer"
                      className="text-[13px] font-bold px-4 py-2 rounded-full inline-flex items-center gap-1.5 text-white" style={{ background: '#25D366' }}>
                      <MessageCircle size={14} /> Send
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[12px] text-center mt-10" style={{ color: 'var(--soft)' }}>
          Refunded sales earn no commission. Never share your PIN. <a className="underline" href="/partner-terms">Partner Terms</a>
        </p>
      </main>
    </div>
  );
}

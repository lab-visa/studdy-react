/**
 * /partner/login - sales partners log in with their WhatsApp number + 6-digit
 * PIN. Forgot PIN → WhatsApp us; the admin resets it from Admin → Partners.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, MessageCircle } from 'lucide-react';
import { SUPPORT_WHATSAPP_NUMBER } from '../data/config';

const FORGOT = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi, I'm a Studdy Lab partner and I forgot my PIN. Please reset it. My registered WhatsApp number is: ")}`;

export default function PartnerLogin() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const oldLink = new URLSearchParams(window.location.search).get('moved') === '1';

  useEffect(() => {
    document.title = 'Partner login · Studdy Lab';
    /* Already logged in? Go straight to the dashboard. */
    fetch('/api/partners/me', { credentials: 'same-origin' }).then(r => { if (r.ok) window.location.replace('/partner'); }).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await fetch('/api/partners/auth', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', phone, pin }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not log in. Please try again.');
      window.location.href = '/partner';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in.');
      setBusy(false);
    }
  };

  const field = { border: '1.5px solid var(--border)', color: 'var(--ink)' };
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'radial-gradient(900px 500px at 0% 0%, #3b2a78 0%, transparent 60%), radial-gradient(800px 500px at 100% 100%, #1c4a7a 0%, transparent 55%), #110D20' }}>
      <div className="w-full max-w-[420px]">
        <Link to="/partners" className="block text-center font-black text-[26px] mb-6"><span className="grad-text">studdy</span> <span className="text-[13px] text-white/70">Partners</span></Link>
        <div className="bg-white rounded-[28px] p-7 sm:p-8" style={{ boxShadow: '0 30px 80px rgba(0,0,0,.4)' }}>
          <h1 className="font-black text-[24px] mb-1" style={{ color: 'var(--ink)' }}>Welcome back</h1>
          <p className="text-[13.5px] mb-6" style={{ color: 'var(--soft)' }}>Log in with your WhatsApp number and 6-digit PIN.</p>
          {oldLink && (
            <div className="rounded-xl p-3 mb-4 text-[13px]" style={{ background: 'rgba(140,121,224,.08)', color: 'var(--ink)', border: '1px solid rgba(140,121,224,.25)' }}>
              Partner pages now have a login. Don't have a PIN yet? Tap “Forgot PIN?” below and we'll send you one.
            </div>
          )}
          <form onSubmit={submit}>
            <label className="block mb-4"><span className="block text-[11px] font-black uppercase tracking-wide mb-1.5" style={{ color: 'var(--soft)' }}>WhatsApp number</span>
              <div className="flex rounded-xl" style={field}>
                <span className="pl-4 pr-1 flex items-center text-[15px] font-semibold" style={{ color: 'var(--soft)' }}>+91</span>
                <input className="w-full px-2 py-3 text-[15px] outline-none bg-transparent rounded-xl" value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" required autoFocus />
              </div></label>
            <label className="block"><span className="block text-[11px] font-black uppercase tracking-wide mb-1.5" style={{ color: 'var(--soft)' }}>PIN</span>
              <div className="relative">
                <input className="w-full rounded-xl px-4 py-3 pr-11 text-[18px] tracking-[.4em] font-bold outline-none" style={field} value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} type={show ? 'text' : 'password'} inputMode="numeric" autoComplete="current-password" placeholder="••••••" required />
                <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide PIN' : 'Show PIN'} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--soft)' }}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div></label>
            {error && <div role="alert" className="rounded-xl p-3 mt-4 text-[13px]" style={{ background: 'rgba(239,68,68,.06)', color: '#dc2626', border: '1px solid rgba(239,68,68,.2)' }}>{error}</div>}
            <button className="gbtn w-full text-[15.5px] py-4 mt-5 flex items-center justify-center gap-2" disabled={busy || pin.length !== 6} style={{ opacity: busy || pin.length !== 6 ? 0.6 : 1 }}>
              {busy ? 'Logging in…' : <>Log in <ArrowRight size={17} /></>}
            </button>
          </form>
          <a href={FORGOT} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-1.5 text-[13.5px] font-bold" style={{ color: 'var(--g3)' }}>
            <MessageCircle size={15} /> Forgot PIN? WhatsApp us
          </a>
        </div>
        <p className="text-center text-[13.5px] mt-6 text-white/75">New here? <Link to="/partners" className="font-bold underline text-white">Become a partner, it’s free</Link></p>
      </div>
    </div>
  );
}

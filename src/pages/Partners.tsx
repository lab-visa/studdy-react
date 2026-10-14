/**
 * /partners — public page for the India sales partner programme:
 * what the role is, how much you earn, and instant registration (name,
 * WhatsApp, email → personal link straight away).
 * Commission numbers must match api/_lib/partners.js.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IndianRupee, Clock, Users, Smartphone, Copy, Check, type LucideIcon } from 'lucide-react';
import { SUPPORT_WHATSAPP, HR_EMAIL } from '../data/config';

const PERKS: { Icon: LucideIcon; title: string; line: string }[] = [
  { Icon: IndianRupee, title: '₹2,500 per yearly sale', line: '₹700 per quarterly sale. Paid on every sale, from your very first.' },
  { Icon: Users, title: 'Monthly bonus', line: '+₹5,000 when you make 10 sales in a month, +₹10,000 more at 20.' },
  { Icon: Clock, title: 'Paid on the 10th', line: 'On the 10th of every month we pay you for all of last month’s sales.' },
  { Icon: Smartphone, title: 'Work from your phone', line: 'Part-time, any city. You get your own link, and a page to track every sale and rupee.' },
];

const STEPS = [
  'Register below with your name, WhatsApp number and email.',
  'You instantly get your personal link and your private earnings page.',
  'Share your link with parents and students. Every purchase through it is credited to you automatically.',
  'On the 10th of every month, we pay you for last month’s sales.',
];

const FAQ = [
  { q: 'Is there any fee to join?', a: 'No. Joining is completely free, and we will never ask you for money.' },
  { q: 'Who do I sell to?', a: 'Parents of school students, and students preparing for board exams, JEE, NEET or college. Tutors and teachers do especially well.' },
  { q: 'How do you know a sale is mine?', a: 'Every parent who buys through your personal link is credited to you automatically. You can see each sale on your earnings page.' },
  { q: 'What if a customer asks for a refund?', a: 'Customers can ask for a full refund within 7 days. Commission is not paid on a refunded sale. Because payouts happen on the 10th of the next month, every sale is already past its refund window by then.' },
  { q: 'Is TDS deducted?', a: 'Yes, as required by Indian tax law. We will ask for your PAN and UPI ID before your first payout, and send you a statement.' },
  { q: 'Do I have to meet a target?', a: 'No. Earn as much as you like, at your own pace.' },
  { q: 'I lost my links. What do I do?', a: 'Message us on WhatsApp from your registered number and we will resend them.' },
];

export default function Partners() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', consent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ code: string; salesLink: string; earningsLink: string } | null>(null);
  const [copied, setCopied] = useState('');
  const copy = (k: string, v: string) => { navigator.clipboard.writeText(v); setCopied(k); setTimeout(() => setCopied(''), 2000); };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/partners/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not register. Please try again.');
      setDone(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-xl px-4 py-3 text-[15px] outline-none bg-white';
  const inputStyle = { border: '1.5px solid var(--border)', color: 'var(--ink)' };
  const label = 'block text-[11px] font-black uppercase tracking-wide mb-1.5';

  return (
    <div style={{ background: 'var(--dim)' }} className="min-h-screen">
      <header className="bg-white h-16 flex items-center justify-between px-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link to="/" className="font-black text-[20px]"><span className="grad-text">studdy</span></Link>
        <a href="#apply" className="gbtn text-[13.5px] px-5 py-2.5">Join now</a>
      </header>

      <section className="px-6 pt-14 pb-10 text-center" style={{ background: 'linear-gradient(135deg,#fdf4fb,#f0ecff,#eaf6ff)' }}>
        <div className="max-w-[760px] mx-auto">
          <div className="eyebrow mb-4" style={{ display: 'inline-flex' }}>Studdy Lab Sales Partner · India</div>
          <h1 className="font-black mb-4" style={{ fontSize: 'clamp(30px,5vw,50px)', letterSpacing: '-1.5px', lineHeight: 1.08 }}>
            Earn <span className="grad-text">₹2,500 per sale</span>, part-time, from your phone.
          </h1>
          <p className="text-[16px] leading-relaxed mx-auto max-w-[600px]" style={{ color: 'var(--soft)' }}>
            Help Indian families discover Studdy Lab, the AI tutor that explains every doubt from Class 1 to college.
            Share your personal link, and earn on every purchase made through it.
          </p>
        </div>
      </section>

      <div className="max-w-[1000px] mx-auto px-6 py-12">
        <div className="grid sm:grid-cols-2 gap-5 mb-14">
          {PERKS.map(({ Icon, title, line }) => (
            <div key={title} className="bg-white rounded-2xl p-6" style={{ border: '1.5px solid var(--border)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--grad)' }}>
                  <Icon size={18} color="#fff" />
                </div>
                <h3 className="font-black text-[17px]">{title}</h3>
              </div>
              <p className="text-[14px]" style={{ color: 'var(--soft)' }}>{line}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-7 mb-14" style={{ border: '1.5px solid var(--border)' }}>
          <h2 className="font-black text-[22px] mb-1">What you can earn</h2>
          <p className="text-[13.5px] mb-5" style={{ color: 'var(--soft)' }}>Example, yearly plan sales in one month. Before TDS.</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[['5 sales', '₹12,500'], ['10 sales', '₹30,000'], ['20 sales', '₹65,000']].map(([s, amt]) => (
              <div key={s} className="rounded-xl p-4" style={{ background: 'var(--dim)' }}>
                <div className="text-[13px] font-bold" style={{ color: 'var(--soft)' }}>{s}</div>
                <div className="font-black text-[22px] grad-text">{amt}</div>
              </div>
            ))}
          </div>
          <p className="text-[12px] mt-3" style={{ color: 'var(--soft)' }}>10 sales = 10 × ₹2,500 + ₹5,000 bonus. 20 sales = 20 × ₹2,500 + ₹15,000 bonus.</p>
        </div>

        <h2 className="font-black text-[22px] mb-4">How it works</h2>
        <ol className="mb-14 space-y-3">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3 items-start bg-white rounded-xl p-4" style={{ border: '1px solid var(--border)' }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-[12px] flex-shrink-0" style={{ background: 'var(--grad)' }}>{i + 1}</span>
              <span className="text-[14.5px]" style={{ color: 'var(--ink)' }}>{s}</span>
            </li>
          ))}
        </ol>

        <div id="apply" className="bg-white rounded-3xl p-7 sm:p-9 mb-14" style={{ border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.06)' }}>
          {done ? (
            <div className="py-2">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-[24px] mx-auto mb-4" style={{ background: 'var(--grad)' }}>✓</div>
              <h2 className="font-black text-[22px] mb-1 text-center">You’re in, {form.name.split(' ')[0]}!</h2>
              <p className="text-[14px] mb-6 text-center" style={{ color: 'var(--soft)' }}>Save both links now. Take a screenshot or bookmark this page.</p>
              {[
                ['sales', 'Your personal link: share this', done.salesLink],
                ['earn', 'Your earnings page: keep this private', done.earningsLink],
              ].map(([k, l, v]) => (
                <div key={k} className="rounded-xl p-4 mb-3" style={{ background: 'var(--dim)', border: '1px solid var(--border)' }}>
                  <div className="text-[11px] font-black uppercase tracking-wide mb-1.5" style={{ color: 'var(--soft)' }}>{l}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-[14px] font-bold break-all flex-1">{v}</code>
                    <button type="button" className="gbtn text-[13px] px-4 py-2 flex items-center gap-1" onClick={() => copy(k, v)}>
                      {copied === k ? <Check size={13} /> : <Copy size={13} />} {copied === k ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              ))}
              <a href={done.earningsLink} className="gbtn w-full text-[15px] py-4 mt-2 flex justify-center">Open my earnings page</a>
              <p className="text-[12.5px] mt-3 text-center" style={{ color: 'var(--soft)' }}>Lost them later? <a className="underline" href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">WhatsApp us</a> from this number.</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h2 className="font-black text-[22px] mb-1">Become a partner</h2>
              <p className="text-[13.5px] mb-6" style={{ color: 'var(--soft)' }}>Takes 30 seconds. Free to join. Your link appears straight away.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="sm:col-span-2"><span className={label} style={{ color: 'var(--soft)' }}>Full name *</span>
                  <input className={input} style={inputStyle} value={form.name} onChange={set('name')} autoComplete="name" required /></label>
                <label><span className={label} style={{ color: 'var(--soft)' }}>WhatsApp number *</span>
                  <input className={input} style={inputStyle} value={form.phone} onChange={set('phone')} type="tel" inputMode="numeric" autoComplete="tel" placeholder="98765 43210" required /></label>
                <label><span className={label} style={{ color: 'var(--soft)' }}>Email *</span>
                  <input className={input} style={inputStyle} value={form.email} onChange={set('email')} type="email" autoComplete="email" required /></label>
              </div>
              <label className="flex gap-2 items-start mt-4 text-[13px]" style={{ color: 'var(--soft)' }}>
                <input type="checkbox" checked={form.consent} onChange={set('consent')} className="mt-1" />
                <span>I agree to the partner terms on this page and to be contacted by Studdy Lab on WhatsApp, phone and email.</span>
              </label>
              {error && <div className="rounded-xl p-3 mt-4 text-[13px]" style={{ background: 'rgba(239,68,68,.06)', color: '#dc2626', border: '1px solid rgba(239,68,68,.2)' }}>{error}</div>}
              <button className="gbtn w-full text-[15px] py-4 mt-5" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Creating your link…' : 'Get my partner link'}
              </button>
            </form>
          )}
        </div>

        <h2 className="font-black text-[22px] mb-4">Questions</h2>
        <div className="space-y-3 mb-10">
          {FAQ.map(f => (
            <div key={f.q} className="bg-white rounded-xl p-5" style={{ border: '1px solid var(--border)' }}>
              <div className="font-black text-[15px] mb-1">{f.q}</div>
              <div className="text-[14px]" style={{ color: 'var(--soft)' }}>{f.a}</div>
            </div>
          ))}
        </div>
        <p className="text-center text-[13px]" style={{ color: 'var(--soft)' }}>
          This is an independent, commission-based partner role, not employment. Questions: <a className="underline" href={`mailto:${HR_EMAIL}`}>{HR_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}

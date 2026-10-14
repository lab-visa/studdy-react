/**
 * /partners — public page for the India sales partner programme:
 * what the role is, how much you earn, and instant registration (name,
 * WhatsApp, email → personal link straight away).
 * Commission numbers must match api/_lib/partners.js.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IndianRupee, Clock, Users, Home, Copy, Check, type LucideIcon } from 'lucide-react';
import { SUPPORT_WHATSAPP, HR_EMAIL } from '../data/config';

const PERKS: { Icon: LucideIcon; title: string; line: string }[] = [
  { Icon: IndianRupee, title: '₹2,500 per yearly sale', line: '₹700 per quarterly sale. Paid on every sale, from your very first.' },
  { Icon: Users, title: 'Monthly bonus', line: 'Make 10 sales in a month: extra ₹5,000. Make 20: extra ₹15,000 in total.' },
  { Icon: Clock, title: 'Paid on the 10th', line: 'On the 10th of every month we pay you for all of last month’s sales.' },
  { Icon: Home, title: 'Work from home', line: 'Flexible hours, from any city in India. Your own link, and an earnings page that tracks every sale and rupee.' },
];

const STEPS = [
  'Register below with your name, WhatsApp number and email.',
  'You instantly get your personal link and your private earnings page.',
  'Share your link with anyone who wants to learn. Every purchase through it is credited to you automatically.',
  'On the 10th of every month, we pay you for last month’s sales.',
];

const FAQ = [
  { q: 'Is there any fee to join?', a: 'No. Joining is completely free, and we will never ask you for money.' },
  { q: 'Who do I sell to?', a: 'Anyone who wants to learn: parents of school students, students preparing for boards, JEE, NEET or CUET, college and PG students, and working professionals learning new skills. Tutors, teachers and people with a big network do especially well.' },
  { q: 'How do you know a sale is mine?', a: 'Every parent who buys through your personal link is credited to you automatically. You can see each sale on your earnings page.' },
  { q: 'What if a customer asks for a refund?', a: 'Customers can ask for a full refund within 7 days. Commission is not paid on a refunded sale. Because payouts happen on the 10th of the next month, every sale is already past its refund window by then.' },
  { q: 'Is TDS deducted?', a: 'Yes, as required by Indian tax law. We will ask for your PAN and UPI ID before your first payout, and send you a statement.' },
  { q: 'Do I have to meet a target?', a: 'No. Earn as much as you like, at your own pace.' },
  { q: 'I lost my links. What do I do?', a: 'Message us on WhatsApp from your registered number and we will resend them.' },
];

const EARN_ROWS = [
  { sales: 1, bonus: 0 },
  { sales: 5, bonus: 0 },
  { sales: 10, bonus: 5000 },
  { sales: 20, bonus: 15000 },
];
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

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
    <div style={{ background: 'var(--dim)' }} className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md h-16 flex items-center justify-between px-5 sm:px-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link to="/" className="font-black text-[20px]"><span className="grad-text">studdy</span></Link>
        <a href="#apply" className="gbtn text-[13.5px] px-5 py-2.5">Join now</a>
      </header>

      <section className="px-6 pt-14 pb-10 text-center" style={{ background: 'linear-gradient(135deg,#fdf4fb,#f0ecff,#eaf6ff)' }}>
        <div className="max-w-[760px] mx-auto">
          <div className="eyebrow mb-4" style={{ display: 'inline-flex' }}>Studdy Lab Sales Partner · India</div>
          <h1 className="font-black mb-4" style={{ fontSize: 'clamp(30px,5vw,50px)', letterSpacing: '-1.5px', lineHeight: 1.08 }}>
            Earn <span className="grad-text">₹2,500</span> for every yearly plan you sell.
          </h1>
          <p className="text-[16px] leading-relaxed mx-auto max-w-[620px]" style={{ color: 'var(--soft)' }}>
            Recommend Studdy Lab, the AI tutor that explains every doubt for every learner: school students, JEE and NEET
            aspirants, college students and working professionals. Work from home on your own schedule, and earn on every
            purchase made through your personal link.
          </p>
        </div>
      </section>

      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-12">
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

        <div className="bg-white rounded-2xl p-5 sm:p-7 mb-14" style={{ border: '1.5px solid var(--border)' }}>
          <h2 className="font-black text-[22px] mb-1">What you can earn in a month</h2>
          <p className="text-[13.5px] mb-5" style={{ color: 'var(--soft)' }}>Example with yearly plans only. Amounts before TDS.</p>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-2.5 text-[11px] font-black uppercase tracking-wide" style={{ background: 'var(--dim)', color: 'var(--soft)' }}>
              <span>Sales in the month</span><span className="text-right">You earn</span>
            </div>
            {EARN_ROWS.map(r => (
              <div key={r.sales} className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="min-w-0">
                  <div className="font-black text-[15px]">{r.sales} sale{r.sales === 1 ? '' : 's'}</div>
                  <div className="text-[12.5px]" style={{ color: 'var(--soft)' }}>
                    {r.sales} × ₹2,500 = {inr(r.sales * 2500)}{r.bonus ? <> <b style={{ color: '#16a34a' }}>+ {inr(r.bonus)} bonus</b></> : null}
                  </div>
                </div>
                <div className="font-black text-[20px] sm:text-[22px] grad-text whitespace-nowrap">{inr(r.sales * 2500 + r.bonus)}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl p-4 mt-4 text-[13.5px] leading-relaxed" style={{ background: 'rgba(22,163,74,.06)', border: '1px solid rgba(22,163,74,.2)' }}>
            <b>How the bonus works:</b> reach <b>10 sales</b> in a calendar month and you get an extra <b>₹5,000</b>.
            Reach <b>20 sales</b> and you get another <b>₹10,000</b>, so <b>₹15,000</b> bonus in total.
            Quarterly plans earn <b>₹700</b> each and also count towards the bonus. The count starts again on the 1st of every month.
          </div>
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

        <div id="apply" className="bg-white rounded-3xl p-5 sm:p-9 mb-14" style={{ scrollMarginTop: 80, border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.06)' }}>
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
      {!done && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pt-3 bg-white/95 backdrop-blur-md"
          style={{ borderTop: '1px solid var(--border)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
          <a href="#apply" className="gbtn w-full text-[15px] py-4 flex justify-center">Become a partner, it’s free</a>
        </div>
      )}
    </div>
  );
}

/**
 * /partners - landing page for the India sales partner programme.
 * Hero: pitch + animated example dashboard on the left, join form on the
 * right (on phones: pitch → form → phone). Joining picks a 6-digit PIN and
 * logs the partner straight into /partner. Commission numbers must match
 * api/_lib/partners.js.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IndianRupee, CalendarCheck, Target, ShieldCheck, Eye, EyeOff, GraduationCap, School, BookOpen, Briefcase,
  Users, Megaphone, Link2, LayoutDashboard, MessageSquareText, FileCheck2, ArrowRight, Check, ChevronDown, type LucideIcon,
} from 'lucide-react';
import EarningsPhone from '../components/partner/EarningsPhone';
import { ArtBoard } from '../components/StepArt';
import { INDIA_PLANS } from '../data/india';
import { HR_EMAIL } from '../data/config';

const YEARLY = 2500;
const QUARTERLY = 700;
const bonusFor = (sales: number) => (sales >= 20 ? 15000 : sales >= 10 ? 5000 : 0);
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const TRUST: { Icon: LucideIcon; title: string; line: string }[] = [
  { Icon: IndianRupee, title: 'Free to join', line: 'No fee, no deposit, ever.' },
  { Icon: CalendarCheck, title: 'Paid on the 10th', line: 'Every month, straight to your bank.' },
  { Icon: LayoutDashboard, title: 'Every sale tracked', line: 'See each sale and rupee live.' },
  { Icon: Target, title: 'No targets', line: 'Earn at your own pace.' },
];

const WHO: { Icon: LucideIcon; title: string; line: string }[] = [
  { Icon: School, title: 'Teachers & tutors', line: 'Your students and their parents already trust your advice.' },
  { Icon: BookOpen, title: 'Coaching centres', line: 'Give every student a 24×7 doubt solver and earn on each plan.' },
  { Icon: GraduationCap, title: 'College students', line: 'Share with juniors, classmates and exam groups.' },
  { Icon: Briefcase, title: 'Working professionals', line: 'Recommend it to colleagues upskilling for their careers.' },
  { Icon: Users, title: 'Parents & group admins', line: 'Society, school and community WhatsApp groups.' },
  { Icon: Megaphone, title: 'Creators & influencers', line: 'Education pages, YouTube, Instagram and Telegram.' },
];

const HOW = [
  { title: 'Join free', line: 'Fill the form in 30 seconds. Your account is live instantly.' },
  { title: 'Get your link', line: 'Your personal link and ready-to-send messages appear in your dashboard.' },
  { title: 'Share it', line: 'Every purchase through your link is credited to you automatically.' },
  { title: 'Get paid', line: 'On the 10th of every month, for all of last month’s sales.' },
];

const KIT: { Icon: LucideIcon; title: string; line: string }[] = [
  { Icon: Link2, title: 'Your personal link', line: 'One tap to copy or share on WhatsApp.' },
  { Icon: LayoutDashboard, title: 'Live earnings dashboard', line: 'Every sale, commission and bonus, by month or any dates.' },
  { Icon: MessageSquareText, title: 'Ready messages', line: 'Short, honest messages to send to parents, students and groups.' },
  { Icon: FileCheck2, title: 'Clear payout statement', line: 'Amount, TDS and bank reference for every payout.' },
];

const FAQ = [
  { q: 'Is there any fee to join?', a: 'No. Joining is completely free and we will never ask you for money.' },
  { q: 'Who can I sell to?', a: 'Anyone who wants to learn: school students and their parents, students preparing for boards, JEE, NEET or CUET, college and PG students, and working professionals learning new skills.' },
  { q: 'How do you know a sale is mine?', a: 'Every purchase made through your personal link is credited to you automatically, and shows up on your dashboard. A customer can also type your partner code at checkout.' },
  { q: 'When and how am I paid?', a: 'On the 10th of every month, for all of the previous month’s sales, by bank transfer. Add your bank details, PAN and masked Aadhaar (for KYC) in your dashboard before your first payout.' },
  { q: 'What if a customer asks for a refund?', a: 'Customers can ask for a full refund within 7 days. No commission is paid on a refunded sale. Payouts happen after that window, so what you see as payable is final.' },
  { q: 'Is TDS deducted?', a: 'Yes, as required by Indian tax law. Every payout statement shows the amount, the TDS and the net amount paid.' },
  { q: 'Can I do this alongside my job or studies?', a: 'Yes. There are no fixed hours and no targets. Many partners share their link in the evenings or on weekends.' },
  { q: 'I forgot my PIN. What do I do?', a: 'Tap “Forgot PIN?” on the login page to message us on WhatsApp from your registered number. We will send you a new one.' },
];

function Calculator() {
  const [y, setY] = useState(8);
  const [q, setQ] = useState(4);
  const sales = y + q;
  const commission = y * YEARLY + q * QUARTERLY;
  const bonus = bonusFor(sales);
  const next = sales < 10 ? { left: 10 - sales, amt: 5000 } : sales < 20 ? { left: 20 - sales, amt: 10000 } : null;
  const slider = (label: string, val: number, set: (n: number) => void, each: number) => (
    <label className="block">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-[14px] font-bold">{label}</span>
        <span className="text-[13px] opacity-75"><b className="text-[20px] text-white">{val}</b> × {inr(each)}</span>
      </div>
      <input type="range" min={0} max={30} value={val} onChange={e => set(Number(e.target.value))}
        className="pt-range w-full" style={{ ['--p' as string]: `${(val / 30) * 100}%` }} aria-label={label} />
    </label>
  );
  return (
    <div className="rounded-[32px] p-6 sm:p-10 text-white relative overflow-hidden" style={{ background: 'linear-gradient(140deg,#1B1530,#2E2456 55%,#1d3a63)' }}>
      <div aria-hidden className="absolute -top-20 -right-16 w-72 h-72 rounded-full blur-3xl opacity-40" style={{ background: '#EF55B6' }} />
      <div aria-hidden className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full blur-3xl opacity-30" style={{ background: '#25A8F4' }} />
      <div className="relative grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
        <div>
          <div className="text-[12px] font-black uppercase tracking-[.16em] mb-2" style={{ color: '#FF9AD8' }}>Earnings calculator</div>
          <h2 className="font-black text-[28px] sm:text-[38px] leading-tight mb-2">How much could you earn in a month?</h2>
          <p className="text-[14.5px] opacity-75 mb-8">Move the sliders. Sell 10 plans in a month and you get a ₹5,000 bonus; sell 20 and it becomes ₹15,000.</p>
          <div className="space-y-7">
            {slider('Yearly plans sold', y, setY, YEARLY)}
            {slider('Quarterly plans sold', q, setQ, QUARTERLY)}
          </div>
        </div>
        <div className="rounded-3xl p-6 sm:p-8" style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)', backdropFilter: 'blur(8px)' }}>
          <div className="text-[12px] font-bold uppercase tracking-wider opacity-70">You would earn</div>
          <div className="font-black leading-none my-2 tabular-nums" style={{ fontSize: 'clamp(44px,7vw,64px)', background: 'linear-gradient(90deg,#FF9AD8,#B8A8FF,#7CCBFF)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            {inr(commission + bonus)}
          </div>
          <div className="text-[13px] opacity-70 mb-6">in one month, before TDS</div>
          <div className="space-y-2.5 text-[14px]">
            <div className="flex justify-between"><span className="opacity-75">Commission ({sales} sales)</span><b>{inr(commission)}</b></div>
            <div className="flex justify-between"><span className="opacity-75">Monthly bonus</span><b style={{ color: bonus ? '#6EE7A8' : undefined }}>{bonus ? `+ ${inr(bonus)}` : '₹0'}</b></div>
          </div>
          <div className="mt-6">
            <div className="h-2.5 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,.12)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (sales / 20) * 100)}%`, background: 'linear-gradient(90deg,#EF55B6,#8C79E0,#25A8F4)' }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-white/60" style={{ left: '50%' }} />
            </div>
            <div className="flex justify-between text-[11px] mt-1.5 opacity-70"><span>0</span><span>10 sales · ₹5k bonus</span><span>20 · ₹15k</span></div>
            <div className="mt-4 text-[13px] rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(110,231,168,.12)', color: '#B7F5D3' }}>
              {next ? <>Just <b>{next.left} more sale{next.left === 1 ? '' : 's'}</b> for an extra <b>{inr(next.amt)}</b> bonus.</> : <>Top bonus unlocked. Every extra sale still earns commission.</>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Partners() {
  const pre = useMemo(() => new URLSearchParams(window.location.search), []);
  const [form, setForm] = useState({
    name: pre.get('name') || '', phone: pre.get('phone') || '', email: pre.get('email') || '', city: '', pin: '', pin2: '', consent: false,
  });
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [formVisible, setFormVisible] = useState(true);
  const formRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Become a Studdy Lab partner · Earn ₹2,500 per yearly plan';
    const el = formRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setFormVisible(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('.pt-reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, []);

  const goToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 500);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : k === 'pin' || k === 'pin2' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.pin.length !== 6) return setError('Please choose a 6-digit PIN.');
    if (form.pin !== form.pin2) return setError('The two PINs don’t match. Please type the same PIN twice.');
    if (!form.consent) return setError('Please agree to the Partner Terms to continue.');
    setBusy(true);
    try {
      const res = await fetch('/api/partners/apply', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, phone: form.phone, email: form.email, city: form.city, pin: form.pin, consent: form.consent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not create your account. Please try again.');
      window.location.href = '/partner?welcome=1';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account. Please try again.');
      setBusy(false);
    }
  };

  const input = 'w-full rounded-xl px-4 py-3 text-[15px] outline-none bg-white transition-shadow focus:shadow-[0_0_0_3px_rgba(140,121,224,.25)]';
  const inputStyle = { border: '1.5px solid var(--border)', color: 'var(--ink)' };
  const label = 'block text-[11px] font-black uppercase tracking-wide mb-1.5';

  const joinForm = (
    <div ref={formRef} id="join" className="bg-white rounded-[28px] p-6 sm:p-8 scroll-mt-24 relative"
      style={{ boxShadow: '0 30px 80px rgba(10,5,40,.35)', color: 'var(--ink)' }}>
      <div className="absolute -top-3 left-6 sm:left-8 text-[11px] font-black uppercase tracking-wider text-white px-3 py-1 rounded-full" style={{ background: 'var(--grad)' }}>Free · 30 seconds</div>
      <h2 className="font-black text-[22px] sm:text-[24px] mb-1 mt-1">Become a partner</h2>
      <p className="text-[13.5px] mb-5" style={{ color: 'var(--soft)' }}>Your account and personal link are ready the moment you join.</p>
      <form onSubmit={submit} noValidate>
        <div className="grid grid-cols-2 gap-3.5">
          <label className="col-span-2"><span className={label} style={{ color: 'var(--soft)' }}>Full name</span>
            <input ref={nameRef} className={input} style={inputStyle} value={form.name} onChange={set('name')} autoComplete="name" required /></label>
          <label className="col-span-2 sm:col-span-1"><span className={label} style={{ color: 'var(--soft)' }}>WhatsApp number</span>
            <div className="flex rounded-xl bg-white" style={inputStyle}>
              <span className="pl-4 pr-1 flex items-center text-[15px] font-semibold" style={{ color: 'var(--soft)' }}>+91</span>
              <input className="w-full rounded-xl px-2 py-3 text-[15px] outline-none bg-transparent" value={form.phone} onChange={set('phone')} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" required />
            </div></label>
          <label className="col-span-2 sm:col-span-1"><span className={label} style={{ color: 'var(--soft)' }}>City</span>
            <input className={input} style={inputStyle} value={form.city} onChange={set('city')} autoComplete="address-level2" placeholder="e.g. Pune" /></label>
          <label className="col-span-2"><span className={label} style={{ color: 'var(--soft)' }}>Email</span>
            <input className={input} style={inputStyle} value={form.email} onChange={set('email')} type="email" autoComplete="email" required /></label>
          <label><span className={label} style={{ color: 'var(--soft)' }}>Create 6-digit PIN</span>
            <input className={`${input} tracking-[.3em] font-bold`} style={inputStyle} value={form.pin} onChange={set('pin')} type={showPin ? 'text' : 'password'} inputMode="numeric" autoComplete="new-password" placeholder="••••••" required /></label>
          <label><span className={label} style={{ color: 'var(--soft)' }}>Confirm PIN</span>
            <div className="relative">
              <input className={`${input} tracking-[.3em] font-bold pr-11`} style={inputStyle} value={form.pin2} onChange={set('pin2')} type={showPin ? 'text' : 'password'} inputMode="numeric" autoComplete="new-password" placeholder="••••••" required />
              <button type="button" onClick={() => setShowPin(v => !v)} aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--soft)' }}>{showPin ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div></label>
        </div>
        <p className="text-[12px] mt-2" style={{ color: 'var(--soft)' }}>You'll log in with your WhatsApp number and this PIN.</p>
        <label className="flex gap-2.5 items-start mt-4 text-[12.5px] leading-snug" style={{ color: 'var(--soft)' }}>
          <input type="checkbox" checked={form.consent} onChange={set('consent')} className="mt-0.5 w-4 h-4 accent-[#8C79E0] flex-shrink-0" />
          <span>I agree to the <Link to="/partner-terms" target="_blank" className="underline font-semibold" style={{ color: 'var(--ink)' }}>Partner Terms</Link> and to be contacted by Studdy Lab on WhatsApp, phone and email.</span>
        </label>
        {error && <div role="alert" className="rounded-xl p-3 mt-4 text-[13px]" style={{ background: 'rgba(239,68,68,.06)', color: '#dc2626', border: '1px solid rgba(239,68,68,.2)' }}>{error}</div>}
        <button className="gbtn w-full text-[15.5px] py-4 mt-5 flex items-center justify-center gap-2" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Creating your account…' : <>Create my partner account <ArrowRight size={17} /></>}
        </button>
        <p className="text-center text-[13px] mt-4" style={{ color: 'var(--soft)' }}>
          Already a partner? <Link to="/partner/login" className="font-bold underline" style={{ color: 'var(--ink)' }}>Log in</Link>
        </p>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-0">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-5 sm:px-8" style={{ background: 'rgba(17,13,32,.72)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <Link to="/" className="font-black text-[21px] flex items-center gap-2"><span className="grad-text">studdy</span><span className="text-[12px] font-bold text-white/70 mt-0.5">Partners</span></Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/partner/login" className="text-[13.5px] font-bold text-white/85 hover:text-white px-3 py-2">Log in</Link>
          <button onClick={goToForm} className="gbtn text-[13.5px] px-4 sm:px-5 py-2.5">Join free</button>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden text-white pt-28 pb-16 sm:pb-24" style={{ background: 'radial-gradient(1200px 600px at 10% -10%, #3b2a78 0%, transparent 60%), radial-gradient(900px 500px at 100% 20%, #1c4a7a 0%, transparent 55%), #110D20' }}>
        <div aria-hidden className="absolute inset-0 opacity-[.07]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative max-w-[1180px] mx-auto px-5 sm:px-8 grid lg:grid-cols-[1.08fr_.92fr] gap-10 lg:gap-14 items-start">
          <div className="lg:pt-6">
            <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6 text-[12px] font-bold" style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#6EE7A8', boxShadow: '0 0 0 4px rgba(110,231,168,.2)' }} /> Studdy Lab Partner Programme · India
            </div>
            <h1 className="font-black mb-5" style={{ fontSize: 'clamp(36px,4.6vw,58px)', letterSpacing: '-2px', lineHeight: 1.04 }}>
              Earn <span style={{ background: 'linear-gradient(90deg,#FF7AC8,#B8A8FF 50%,#5CC3FF)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>₹2,500</span> for every yearly plan you recommend.
            </h1>
            <p className="text-[16px] sm:text-[18px] leading-relaxed max-w-[560px] mb-7 text-white/75">
              Recommend Studdy, the AI tutor that explains any doubt step by step on a whiteboard, to students, parents and working professionals. Get paid on the 10th of every month.
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 max-w-[520px] mb-10">
              {['Free to join, no targets', '₹700 on every quarterly plan', 'Up to ₹15,000 monthly bonus', 'Track every sale live'].map(t => (
                <li key={t} className="flex items-center gap-2.5 text-[14.5px] font-semibold text-white/90">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(110,231,168,.18)' }}><Check size={12} color="#6EE7A8" strokeWidth={3} /></span>{t}
                </li>
              ))}
            </ul>
            <div className="hidden lg:block"><EarningsPhone /></div>
          </div>
          <div className="lg:sticky lg:top-24">{joinForm}</div>
          <div className="lg:hidden pt-4"><EarningsPhone /></div>
        </div>
      </section>

      {/* TRUST */}
      <section className="relative -mt-8 z-10 px-5 sm:px-8">
        <div className="max-w-[1100px] mx-auto bg-white rounded-3xl grid grid-cols-2 lg:grid-cols-4" style={{ boxShadow: '0 20px 60px rgba(20,10,60,.12)', border: '1px solid var(--border)' }}>
          {TRUST.map(({ Icon, title, line }, i) => (
            <div key={title} className={`p-5 sm:p-6 flex items-start gap-3 ${i % 2 ? 'border-l' : ''} ${i === 2 ? 'lg:border-l' : ''} ${i > 1 ? 'border-t lg:border-t-0' : ''}`} style={{ borderColor: 'var(--border)' }}>
              <span className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--grad)' }}><Icon size={18} color="#fff" /></span>
              <div><div className="font-black text-[14.5px]">{title}</div><div className="text-[12.5px]" style={{ color: 'var(--soft)' }}>{line}</div></div>
            </div>
          ))}
        </div>
      </section>

      <main className="max-w-[1100px] mx-auto px-5 sm:px-8">
        {/* WHO */}
        <section className="pt-20 sm:pt-28">
          <div className="text-center max-w-[640px] mx-auto mb-10">
            <div className="text-[12px] font-black uppercase tracking-[.16em] mb-2" style={{ color: 'var(--g2)' }}>Who it's for</div>
            <h2 className="font-black text-[30px] sm:text-[40px] leading-tight mb-3">Anyone who knows people who want to learn</h2>
            <p className="text-[15.5px]" style={{ color: 'var(--soft)' }}>No sales experience needed. If people come to you for advice, you can do this.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WHO.map(({ Icon, title, line }) => (
              <div key={title} className="pt-reveal group rounded-3xl p-6 transition-all hover:-translate-y-1" style={{ background: 'linear-gradient(160deg,#fff,#faf8ff)', border: '1px solid var(--border)' }}>
                <span className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: 'rgba(140,121,224,.1)' }}><Icon size={22} style={{ color: 'var(--g3)' }} /></span>
                <div className="font-black text-[17px] mb-1">{title}</div>
                <div className="text-[14px]" style={{ color: 'var(--soft)' }}>{line}</div>
              </div>
            ))}
          </div>
        </section>

        {/* PRODUCT */}
        <section className="pt-20 sm:pt-28 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="pt-reveal rounded-[32px] p-4 sm:p-8" style={{ background: 'linear-gradient(135deg,#fbf7ff,#eef6ff)' }}><ArtBoard /></div>
          <div className="pt-reveal">
            <div className="text-[12px] font-black uppercase tracking-[.16em] mb-2" style={{ color: 'var(--g2)' }}>What you'll recommend</div>
            <h2 className="font-black text-[30px] sm:text-[38px] leading-tight mb-4">A personal AI tutor people actually love using</h2>
            <p className="text-[15.5px] leading-relaxed mb-6" style={{ color: 'var(--soft)' }}>
              Studdy explains any doubt step by step on an interactive whiteboard, like a patient personal tutor, at any hour. Any subject, any level:
              school, board and entrance exams, college, and new skills for work. Much less than a home tutor charges in a month.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {([['quarterly', QUARTERLY], ['yearly', YEARLY]] as const).map(([k, earn]) => (
                <div key={k} className="rounded-2xl p-4" style={{ border: k === 'yearly' ? '2px solid transparent' : '1px solid var(--border)', background: k === 'yearly' ? 'linear-gradient(#fff,#fff) padding-box, var(--grad) border-box' : '#fff' }}>
                  <div className="text-[12px] font-black uppercase tracking-wide" style={{ color: 'var(--soft)' }}>{INDIA_PLANS[k].label}</div>
                  <div className="font-black text-[24px]">{INDIA_PLANS[k].display}</div>
                  <div className="text-[12px] mb-3" style={{ color: 'var(--soft)' }}>{INDIA_PLANS[k].period}</div>
                  <div className="inline-flex text-[12.5px] font-black rounded-full px-2.5 py-1" style={{ background: 'rgba(22,163,74,.1)', color: '#15803d' }}>You earn {inr(earn)}</div>
                </div>
              ))}
            </div>
            <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-bold underline" style={{ color: 'var(--ink)' }}>See Studdy in action <ArrowRight size={14} /></a>
          </div>
        </section>

        {/* HOW */}
        <section className="pt-20 sm:pt-28">
          <div className="text-center mb-12">
            <div className="text-[12px] font-black uppercase tracking-[.16em] mb-2" style={{ color: 'var(--g2)' }}>How it works</div>
            <h2 className="font-black text-[30px] sm:text-[40px] leading-tight">Four simple steps</h2>
          </div>
          <ol className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div aria-hidden className="hidden lg:block absolute top-7 left-[12%] right-[12%] h-0.5" style={{ background: 'repeating-linear-gradient(90deg,#C9BFF0 0 8px,transparent 8px 16px)' }} />
            {HOW.map((h, i) => (
              <li key={h.title} className="pt-reveal relative text-center lg:px-2" style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="relative w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white font-black text-[20px]" style={{ background: 'var(--grad)', boxShadow: '0 12px 30px rgba(199,101,199,.35)' }}>{i + 1}</span>
                <div className="font-black text-[18px] mb-1">{h.title}</div>
                <div className="text-[14px] max-w-[240px] mx-auto" style={{ color: 'var(--soft)' }}>{h.line}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* CALCULATOR */}
        <section className="pt-20 sm:pt-28 pt-reveal"><Calculator /></section>

        {/* KIT */}
        <section className="pt-20 sm:pt-28">
          <div className="text-center max-w-[620px] mx-auto mb-10">
            <div className="text-[12px] font-black uppercase tracking-[.16em] mb-2" style={{ color: 'var(--g2)' }}>Everything you need</div>
            <h2 className="font-black text-[30px] sm:text-[40px] leading-tight">Your own partner dashboard</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {KIT.map(({ Icon, title, line }) => (
              <div key={title} className="pt-reveal rounded-3xl p-6" style={{ border: '1px solid var(--border)' }}>
                <Icon size={24} style={{ color: 'var(--g1)' }} className="mb-4" />
                <div className="font-black text-[16px] mb-1">{title}</div>
                <div className="text-[13.5px]" style={{ color: 'var(--soft)' }}>{line}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="pt-20 sm:pt-28 max-w-[780px] mx-auto">
          <h2 className="font-black text-[30px] sm:text-[38px] leading-tight text-center mb-8">Questions</h2>
          <div className="space-y-3">
            {FAQ.map(f => (
              <details key={f.q} className="pt-faq group rounded-2xl px-5 sm:px-6" style={{ border: '1px solid var(--border)', background: '#fff' }}>
                <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer list-none font-black text-[15.5px]">
                  {f.q}<ChevronDown size={18} className="flex-shrink-0 transition-transform group-open:rotate-180" style={{ color: 'var(--soft)' }} />
                </summary>
                <p className="pb-5 text-[14.5px] leading-relaxed" style={{ color: 'var(--soft)' }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="pt-20 sm:pt-28 pb-16">
          <div className="pt-reveal rounded-[32px] p-8 sm:p-14 text-center text-white relative overflow-hidden" style={{ background: 'linear-gradient(120deg,#EF55B6,#8C79E0 50%,#25A8F4)' }}>
            <div aria-hidden className="absolute inset-0 opacity-[.12]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <h2 className="relative font-black text-[30px] sm:text-[44px] leading-tight mb-3">Start earning this month</h2>
            <p className="relative text-[16px] opacity-90 mb-7 max-w-[520px] mx-auto">Join free in 30 seconds and share your link today. Your first payout comes on the 10th.</p>
            <button onClick={goToForm} className="relative bg-white rounded-full px-8 py-4 text-[16px] font-black inline-flex items-center gap-2 transition-transform hover:scale-[1.03]" style={{ color: 'var(--ink)', boxShadow: '0 14px 40px rgba(0,0,0,.2)' }}>
              Become a partner <ArrowRight size={18} />
            </button>
          </div>
          <p className="text-center text-[12.5px] mt-8 leading-relaxed" style={{ color: 'var(--soft)' }}>
            <ShieldCheck size={13} className="inline -mt-0.5 mr-1" />
            This is an independent, commission-based partner programme, not a job or employment. Studdy Lab never asks partners for money.
            <br /><Link to="/partner-terms" className="underline">Partner Terms</Link> · <Link to="/contact" className="underline">Contact</Link> · <a className="underline" href={`mailto:${HR_EMAIL}`}>{HR_EMAIL}</a>
          </p>
        </section>
      </main>

      <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pt-3 bg-white/95 backdrop-blur-md transition-transform duration-300 ${formVisible ? 'translate-y-full' : 'translate-y-0'}`}
        style={{ borderTop: '1px solid var(--border)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <button onClick={goToForm} className="gbtn w-full text-[15px] py-4 flex justify-center items-center gap-2">Become a partner, it’s free <ArrowRight size={16} /></button>
      </div>

      <style>{`
        .pt-reveal { opacity: 0; transform: translateY(26px); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.8,.2,1) }
        .pt-reveal.in { opacity: 1; transform: none }
        .pt-faq summary::-webkit-details-marker { display: none }
        .pt-range { -webkit-appearance: none; appearance: none; height: 8px; border-radius: 99px; outline: none;
          background: linear-gradient(90deg,#EF55B6,#8C79E0 var(--p),rgba(255,255,255,.15) var(--p)); }
        .pt-range::-webkit-slider-thumb { -webkit-appearance: none; width: 26px; height: 26px; border-radius: 50%; background: #fff; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.35), 0 0 0 5px rgba(255,255,255,.18) }
        .pt-range::-moz-range-thumb { width: 26px; height: 26px; border: 0; border-radius: 50%; background: #fff; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.35) }
        @media (prefers-reduced-motion: reduce) { .pt-reveal { opacity: 1; transform: none; transition: none } }
      `}</style>
    </div>
  );
}

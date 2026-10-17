/**
 * /thank-you?plan=quarterly|yearly - where Cashfree Payment Forms send the
 * customer after paying (set as the form's Redirect URL in the Cashfree
 * dashboard). Interim flow until studdylab.com is whitelisted for the
 * built-in checkout (#16): the Studdy login is sent manually on WhatsApp.
 *
 * Deliberately shows NO login details - this URL is public and guessable,
 * so it only confirms, reassures and explains what happens next.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Check, MessageCircle, ShieldCheck, RotateCcw, Mail, Sparkles, Clock, KeyRound, type LucideIcon } from 'lucide-react';
import { INDIA_PLANS, INDIA_REFUND_DAYS } from '../data/india';
import { SUPPORT_WHATSAPP_NUMBER, SUPPORT_EMAIL } from '../data/config';
import { track } from '../utils/analytics';

const TRY_FIRST = [
  { who: 'School', ask: '“Explain photosynthesis like I’m in Class 7, with an example.”' },
  { who: 'Entrance exams', ask: '“Solve this JEE integration step by step and tell me where students go wrong.”' },
  { who: 'College', ask: '“Help me revise depreciation methods for my B.Com exam.”' },
  { who: 'Work & skills', ask: '“Teach me Excel pivot tables using a sales report example.”' },
];

function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
    resize();
    window.addEventListener('resize', resize);
    const colors = ['#EF55B6', '#C765C7', '#8C79E0', '#25A8F4', '#FFC94D'];
    const n = innerWidth < 640 ? 90 : 160;
    const parts = Array.from({ length: n }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 80 * dpr,
      y: canvas.height * 0.32,
      vx: (Math.random() - 0.5) * 16 * dpr,
      vy: (-Math.random() * 15 - 5) * dpr,
      r: (Math.random() * 5 + 3) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = Math.max(0, 1 - frame / 170);
      for (const p of parts) {
        p.vy += 0.35 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
      }
      if (frame < 170) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="fixed inset-0 w-full h-full pointer-events-none z-50" />;
}

export default function ThankYou() {
  const planKey = useMemo(() => {
    const p = new URLSearchParams(window.location.search).get('plan');
    return p === 'yearly' || p === 'quarterly' ? p : null;
  }, []);
  const plan = planKey ? INDIA_PLANS[planKey] : null;
  const planName = plan ? `Studdy Pro ${plan.label}` : 'Studdy Pro';

  useEffect(() => {
    document.title = 'Payment successful · Studdy Lab';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    track('payment_form_thank_you', { plan: planKey || 'unknown' });
    return () => { meta.remove(); };
  }, [planKey]);

  const waText = `Hi Studdy Lab! I've just paid for ${planName}. Please send my login details.\n\nName: \nEmail used for payment: `;
  const waLink = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(waText)}`;

  const card = 'rounded-3xl p-6 sm:p-8';
  const cardStyle = { background: '#fff', border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(60,40,120,.08)' };

  const steps: { Icon: LucideIcon; title: string; line: string; state: 'done' | 'now' | 'next' }[] = [
    { Icon: Check, title: 'Payment received', line: 'Your payment is confirmed. Cashfree has emailed you a receipt.', state: 'done' },
    { Icon: Clock, title: 'Your login arrives on WhatsApp', line: 'Within 2 hours, 9 am to 9 pm. Paid late at night? First thing next morning.', state: 'now' },
    { Icon: KeyRound, title: 'Start learning', line: 'Log in to Studdy with the details we send, and ask your first doubt.', state: 'next' },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--dim)' }}>
      <Confetti />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{ background: 'radial-gradient(60% 70% at 50% 0%, rgba(199,101,199,.22), rgba(37,168,244,.10) 55%, transparent 80%)' }} />

      <header className="relative h-16 flex items-center justify-center px-4">
        <Link to="/" className="font-black text-[22px]"><span className="grad-text">studdy</span></Link>
      </header>

      <main className="relative max-w-[1040px] mx-auto px-4 sm:px-6 pb-16">
        {/* Hero */}
        <section className="text-center pt-6 sm:pt-10 pb-8 sm:pb-12">
          <div className="ty-pop mx-auto mb-6 w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center"
            style={{ background: 'var(--grad)', boxShadow: '0 18px 50px rgba(199,101,199,.45)' }}>
            <div className="w-[84%] h-[84%] rounded-full flex items-center justify-center" style={{ background: '#fff' }}>
              <svg viewBox="0 0 52 52" className="w-1/2 h-1/2" aria-hidden="true">
                <defs><linearGradient id="tyg" x1="0" x2="1"><stop offset="0" stopColor="#EF55B6" /><stop offset="1" stopColor="#25A8F4" /></linearGradient></defs>
                <path className="ty-tick" d="M14 27 l8 8 l16 -18" fill="none" stroke="url(#tyg)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wide px-3 py-1 rounded-full mb-4"
            style={{ background: 'rgba(22,163,74,.10)', color: '#16a34a' }}>
            <ShieldCheck size={14} /> Payment successful
          </div>
          <h1 className="font-black mx-auto max-w-[720px]" style={{ fontSize: 'clamp(32px,6vw,56px)', letterSpacing: '-1.5px', lineHeight: 1.05, color: 'var(--ink)' }}>
            Welcome to <span className="grad-text">Studdy Lab</span>. You’re in!
          </h1>
          <p className="mt-4 text-[16px] sm:text-[18px] leading-relaxed mx-auto max-w-[600px]" style={{ color: 'var(--soft)' }}>
            Your {planName} plan is confirmed. We’re setting up your personal AI tutor now: any subject, any doubt, any time.
          </p>
        </section>

        <div className="grid md:grid-cols-2 lg:grid-cols-[1.15fr_1fr] gap-5 sm:gap-6 items-stretch">
          {/* What happens next */}
          <section className={card} style={cardStyle} aria-labelledby="next-h">
            <h2 id="next-h" className="font-black text-[20px] sm:text-[22px] mb-5" style={{ color: 'var(--ink)' }}>What happens next</h2>
            <ol className="relative">
              {steps.map(({ Icon, title, line, state }, i) => (
                <li key={title} className="flex gap-4 pb-6 last:pb-0 relative">
                  {i < steps.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[19px] top-11 bottom-1 w-[2px]"
                      style={{ background: state === 'done' ? 'var(--grad)' : 'var(--border)' }} />
                  )}
                  <span className={`relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${state === 'now' ? 'ty-pulse' : ''}`}
                    style={state === 'next'
                      ? { background: 'var(--dim)', border: '1.5px solid var(--border)', color: 'var(--soft)' }
                      : { background: 'var(--grad)', color: '#fff' }}>
                    <Icon size={18} strokeWidth={2.5} />
                  </span>
                  <div className="pt-1.5 min-w-0">
                    {state === 'now' && (
                      <span className="inline-block whitespace-nowrap text-[10.5px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full mb-1" style={{ background: 'rgba(199,101,199,.12)', color: '#c4278c' }}>In progress</span>
                    )}
                    <div className="font-black text-[15.5px]" style={{ color: 'var(--ink)' }}>{title}</div>
                    <p className="text-[14px] mt-0.5 leading-relaxed" style={{ color: 'var(--soft)' }}>{line}</p>
                  </div>
                </li>
              ))}
            </ol>

            <a href={waLink} target="_blank" rel="noopener noreferrer" onClick={() => track('thank_you_whatsapp_click')}
              className="mt-7 w-full flex items-center justify-center gap-2 rounded-2xl py-4 px-5 font-black text-[16px] text-white transition-transform hover:-translate-y-0.5"
              style={{ background: '#25D366', boxShadow: '0 12px 30px rgba(37,211,102,.35)' }}>
              <MessageCircle size={20} /> Get my login faster on WhatsApp
            </a>
            <p className="text-[12.5px] text-center mt-2.5" style={{ color: 'var(--soft)' }}>
              Opens WhatsApp with a ready-made message. Just add your name and send.
            </p>
          </section>

          {/* Order summary + trust */}
          <div className="flex flex-col">
            <section className={`${card} h-full`} style={cardStyle} aria-labelledby="order-h">
              <h2 id="order-h" className="font-black text-[18px] mb-4" style={{ color: 'var(--ink)' }}>Your order</h2>
              <dl className="text-[14.5px]">
                {[
                  ['Plan', planName],
                  ...(plan ? [['Amount paid', plan.display], ['Access', plan.months === 12 ? '12 months' : '3 months']] : []),
                  ['Status', 'Paid ✓'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5" style={{ borderBottom: '1px dashed var(--border)' }}>
                    <dt style={{ color: 'var(--soft)' }}>{k}</dt>
                    <dd className="font-bold text-right" style={{ color: k === 'Status' ? '#16a34a' : 'var(--ink)' }}>{v}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-5 space-y-3 text-[13.5px]" style={{ color: 'var(--soft)' }}>
                <li className="flex gap-2.5 items-start"><ShieldCheck size={17} className="flex-shrink-0 mt-0.5" style={{ color: '#16a34a' }} /><span>Payment secured by Cashfree Payments, an RBI-authorised payment gateway.</span></li>
                <li className="flex gap-2.5 items-start"><RotateCcw size={17} className="flex-shrink-0 mt-0.5" style={{ color: '#8C79E0' }} /><span>Not happy in the first {INDIA_REFUND_DAYS} days? Full refund. <Link to="/refund" className="underline">Refund policy</Link></span></li>
                <li className="flex gap-2.5 items-start"><Mail size={17} className="flex-shrink-0 mt-0.5" style={{ color: '#25A8F4' }} /><span>Questions? <a href={`mailto:${SUPPORT_EMAIL}`} className="underline break-all">{SUPPORT_EMAIL}</a></span></li>
              </ul>
            </section>

          </div>
        </div>

        <div className="mt-5 sm:mt-6">
        <section className={card} style={{ ...cardStyle, background: 'linear-gradient(135deg, rgba(239,85,182,.08), rgba(37,168,244,.08)), #fff' }} aria-labelledby="try-h">
          <h2 id="try-h" className="font-black text-[18px] mb-1 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
            <Sparkles size={18} style={{ color: '#C765C7' }} /> Questions to try first
          </h2>
          <p className="text-[13px] mb-4" style={{ color: 'var(--soft)' }}>Studdy works for every learner. Keep these handy for your first login.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TRY_FIRST.map(t => (
              <div key={t.who} className="rounded-2xl p-3.5" style={{ background: '#fff', border: '1px solid var(--border)' }}>
                <div className="text-[11px] font-black uppercase tracking-wide mb-1" style={{ color: 'var(--soft)' }}>{t.who}</div>
                <div className="text-[14px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>{t.ask}</div>
              </div>
            ))}
          </div>
        </section>
        </div>

        <p className="text-center text-[12px] mt-10" style={{ color: 'var(--soft)' }}>
          Built with ❤️ for learners everywhere. · <Link to="/terms" className="underline">Terms</Link> · <Link to="/contact" className="underline">Contact</Link>
        </p>
      </main>

      <style>{`
        @keyframes ty-pop { 0% { transform: scale(.3); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1) } }
        @keyframes ty-draw { from { stroke-dashoffset: 48 } to { stroke-dashoffset: 0 } }
        @keyframes ty-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(199,101,199,.45) } 50% { box-shadow: 0 0 0 10px rgba(199,101,199,0) } }
        .ty-pop { animation: ty-pop .7s cubic-bezier(.2,.9,.3,1.2) both }
        .ty-tick { stroke-dasharray: 48; stroke-dashoffset: 48; animation: ty-draw .5s .45s ease-out forwards }
        .ty-pulse { animation: ty-pulse 1.8s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .ty-pop, .ty-pulse { animation: none } .ty-tick { animation: none; stroke-dashoffset: 0 } }
      `}</style>
    </div>
  );
}

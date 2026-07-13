import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { Play, Zap, Eye, Clock } from 'lucide-react';
import Modal from '../components/Modal';
import LazyVideo from '../components/LazyVideo';
import { track } from '../utils/analytics';

const USE_CASES = [
  { label: 'Biology diagram', hint: 'Draw the process of photosynthesis step by step...' },
  { label: 'Python debugging', hint: 'Here is the error in your code. Let me trace through it...' },
  { label: 'English answer', hint: 'Your argument is clear. Let me show how to strengthen it...' },
  { label: 'Excel formula', hint: 'To build a commission formula, start with IF and VLOOKUP...' },
];

const FLOAT_LABELS = [
  { icon: Zap,  text: 'Learn anything' },
  { icon: Eye,  text: 'Visual explanations' },
  { icon: Clock,text: 'Available 24/7' },
];

export default function Hero() {
  const navigate = useNavigate();
  const headlineRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [caseIdx, setCaseIdx] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rotate use cases
  useEffect(() => {
    intervalRef.current = setInterval(() => setCaseIdx(i => (i + 1) % USE_CASES.length), 3200);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Entrance animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(headlineRef.current, { opacity: 0, y: 40, duration: 1, ease: 'power3.out', delay: 0.15 });
      gsap.from(ctaRef.current, { opacity: 0, y: 24, duration: 0.8, ease: 'power3.out', delay: 0.45 });
      gsap.from(stageRef.current, { opacity: 0, scale: 0.97, duration: 1, ease: 'power3.out', delay: 0.2 });
    });
    return () => ctx.revert();
  }, []);

  const handleTrial = useCallback(() => {
    track('checkout_started');
    navigate('/checkout');
  }, [navigate]);

  const handleDemo = useCallback(() => {
    track('full_demo_open');
    setDemoOpen(true);
  }, []);

  return (
    <>
      <section
        className="relative w-full overflow-hidden"
        style={{ minHeight: '100svh', background: '#fff' }}
      >
        {/* Whiteboard grid — full viewport */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage: 'linear-gradient(rgba(140,121,224,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(140,121,224,.06) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        {/* Gradient wash */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 70% 10%, rgba(140,121,224,.08), transparent 65%), radial-gradient(ellipse 50% 40% at 5% 85%, rgba(239,85,182,.06), transparent 60%)',
          }}
        />

        <div className="relative z-10 max-w-[1280px] mx-auto px-6 h-full flex flex-col lg:flex-row items-center gap-12 pt-32 pb-20">

          {/* ── LEFT: headline + CTAs ── */}
          <div ref={headlineRef} className="flex-none w-full lg:w-[420px] xl:w-[480px]">
            <div className="eyebrow mb-6">Your personal AI tutor · available 24/7</div>

            <h1
              className="font-black leading-[1.04] mb-6"
              style={{ fontSize: 'clamp(36px, 5vw, 58px)', letterSpacing: '-2px', color: 'var(--ink)' }}
            >
              The tutor that explains it{' '}
              <span className="grad-text">until it finally makes sense.</span>
            </h1>

            <p className="mb-8 leading-relaxed" style={{ fontSize: 'clamp(16px, 1.6vw, 18px)', color: 'var(--soft)', maxWidth: '420px' }}>
              Ask by voice, text or image. Learn through live visual explanations and unlimited follow-up questions.
            </p>

            <div ref={ctaRef} className="flex flex-col sm:flex-row gap-3 mb-8">
              <button className="gbtn text-[15px] px-7 py-4" onClick={handleTrial}>
                Start Free Trial
              </button>
              <button
                className="gost text-[15px] px-6 py-4 flex items-center gap-2"
                onClick={handleDemo}
                aria-label="Watch full product demo"
              >
                <Play size={16} />
                Watch Full Demo
              </button>
            </div>

            {/* Float labels */}
            <div className="flex flex-col gap-2">
              {FLOAT_LABELS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--soft)' }}>
                  <Icon size={14} style={{ color: 'var(--g3)' }} aria-hidden="true" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Living Whiteboard stage ── */}
          <div ref={stageRef} className="flex-1 w-full relative">
            {/* Glow behind stage */}
            <div
              className="absolute -inset-8 pointer-events-none rounded-full"
              aria-hidden="true"
              style={{ background: 'radial-gradient(ellipse, rgba(239,85,182,.12), rgba(140,121,224,.08) 45%, transparent 70%)', filter: 'blur(28px)' }}
            />

            <div
              className="relative z-10 rounded-[28px] overflow-hidden"
              style={{
                background: '#fff',
                border: '1.5px solid var(--border)',
                boxShadow: '0 40px 80px -20px rgba(140,121,224,.25)',
                minHeight: '480px',
              }}
            >
              {/* Top accent bar */}
              <div className="h-[3px] w-full" style={{ background: 'var(--grad)' }} />

              {/* Whiteboard lines inside */}
              <div
                className="absolute inset-0 pointer-events-none"
                aria-hidden="true"
                style={{
                  backgroundImage: 'linear-gradient(rgba(140,121,224,.05) 1px, transparent 1px)',
                  backgroundSize: '100% 40px',
                  backgroundPosition: '0 24px',
                }}
              />

              {/* Video area — hero muted montage */}
              <div className="relative" style={{ aspectRatio: '16/9' }}>
                <LazyVideo
                  label="Hero Video — 12–15 sec muted montage"
                  meta="Replace with final muted hero reel"
                  className="w-full h-full"
                  aspectRatio="16/9"
                />
                <div
                  className="absolute bottom-0 inset-x-0 h-1/3 pointer-events-none"
                  style={{ background: 'linear-gradient(transparent, rgba(255,255,255,.9))' }}
                />
              </div>

              {/* Rotating use-case hint */}
              <div className="px-6 py-5">
                <div
                  className="text-[11px] font-black uppercase tracking-widest mb-3"
                  style={{ color: 'var(--soft)', letterSpacing: '.12em' }}
                >
                  Now explaining
                </div>
                <div className="transition-all duration-500">
                  <div className="font-bold text-[15px] mb-1" style={{ color: 'var(--ink)' }}>
                    {USE_CASES[caseIdx].label}
                  </div>
                  <div className="text-[13px] italic" style={{ color: 'var(--soft)' }}>
                    "{USE_CASES[caseIdx].hint}"
                  </div>
                </div>
              </div>

              {/* Use-case dots */}
              <div className="px-6 pb-5 flex gap-2">
                {USE_CASES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCaseIdx(i)}
                    aria-label={`Show ${USE_CASES[i].label} example`}
                    className="w-2 h-2 rounded-full transition-all duration-300"
                    style={{ background: i === caseIdx ? 'var(--g1)' : 'var(--border)', transform: i === caseIdx ? 'scale(1.4)' : 'scale(1)' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom trust strip */}
        <div
          className="relative z-10 border-t px-6 py-3 flex flex-wrap justify-center gap-6 text-[12.5px] font-semibold"
          style={{ borderColor: 'var(--border)', color: 'var(--soft)' }}
        >
          {['$0 due today', 'WhatsApp reminder before billing', 'Cancel anytime'].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <span style={{ color: 'var(--g4)' }}>✓</span> {t}
            </span>
          ))}
        </div>
      </section>

      {/* Full demo modal */}
      <Modal open={demoOpen} onClose={() => setDemoOpen(false)} title="Full Product Demo">
        <div className="p-6 md:p-8">
          <h3 className="font-black text-[20px] mb-2">See Studdy explain from start to finish.</h3>
          <p className="text-[14px] mb-5" style={{ color: 'var(--soft)' }}>One real question. Visual whiteboard. Voice explanation. Follow-up answered.</p>
          <LazyVideo
            label="Full Demo Video — 90–100 sec"
            meta="Replace with complete product session recording"
            className="w-full rounded-2xl"
            aspectRatio="16/9"
          />
        </div>
      </Modal>
    </>
  );
}

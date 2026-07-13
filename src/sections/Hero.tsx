import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Play, Zap, Eye, Clock, Volume2, VolumeX } from 'lucide-react';
import Modal from '../components/Modal';
import LazyVideo from '../components/LazyVideo';
import { track } from '../utils/analytics';
gsap.registerPlugin(ScrollTrigger);

/* ─── Hero video component ─────────────────────────────────────────── */
function HeroVideo({ muted }: { muted: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Pause when out of viewport */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || prefersReduced) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); },
      { threshold: 0.15 }
    );
    obs.observe(v);
    return () => obs.disconnect();
  }, [prefersReduced]);

  /* Sync muted toggle */
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted]);

  if (prefersReduced) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ background:'linear-gradient(135deg,#15131f,#2a2040)' }}
      >
        <p className="text-white/50 font-bold text-[12px]">Video paused — reduced motion</p>
      </div>
    );
  }

  return (
    <>
      {/* Actual video element */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/images/hero-poster.jpg"
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display:'block' }}
        aria-label="Hero product demonstration video"
      >
        <source src="/videos/hero-placeholder.mp4" type="video/mp4" />
      </video>

      {/* Fallback label shown beneath video when file is missing */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center -z-10"
        style={{ background:'linear-gradient(135deg,#15131f,#2a2040)' }}
        aria-hidden="true"
      >
        <div className="text-white/20 text-[42px] mb-3">▶</div>
        <p className="text-white/50 font-bold text-[13px]">Hero Video — 12–15 sec</p>
        <p className="text-white/25 text-[11px] font-mono mt-1">public/videos/hero-placeholder.mp4</p>
      </div>
    </>
  );
}

/* ─── Floating glass pill ───────────────────────────────────────────── */
const PILLS = [
  { Icon: Zap,   label: 'Learn anything',       delay: 0 },
  { Icon: Eye,   label: 'Visual explanations',  delay: 0.12 },
  { Icon: Clock, label: 'Available 24/7',        delay: 0.24 },
];

/* ─── Main Hero component ───────────────────────────────────────────── */
export default function Hero() {
  const navigate   = useNavigate();
  const sectionRef = useRef<HTMLDivElement>(null);
  const badgeRef   = useRef<HTMLDivElement>(null);
  const headRef    = useRef<HTMLDivElement>(null);
  const ctaRef     = useRef<HTMLDivElement>(null);
  const stageRef   = useRef<HTMLDivElement>(null);
  const pillsRef   = useRef<HTMLDivElement>(null);
  const glowRef    = useRef<HTMLDivElement>(null);

  const [demoOpen, setDemoOpen] = useState(false);
  const [muted, setMuted]       = useState(true);

  /* ── Entrance sequence: badge → headline → CTA → stage → pills ── */
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from(badgeRef.current,  { opacity:0, y:18, duration:0.65 })
        .from(headRef.current,   { opacity:0, y:30, duration:0.85 }, '-=0.35')
        .from(ctaRef.current,    { opacity:0, y:22, duration:0.70 }, '-=0.45')
        .from(stageRef.current,  { opacity:0, y:40, scale:0.97, duration:1.0 }, '-=0.50')
        .from(pillsRef.current?.children ?? [], { opacity:0, y:14, duration:0.55, stagger:0.12 }, '-=0.60');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  /* ── Float animation on the video stage ── */
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !stageRef.current) return;
    gsap.to(stageRef.current, {
      y: '-7px',
      duration: 5.5,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  }, []);

  /* ── Scroll parallax: stage scales 1 → 0.96 ── */
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !sectionRef.current || !stageRef.current || !headRef.current) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.6,
        onUpdate: self => {
          const p = self.progress;
          gsap.set(stageRef.current, { scale: 1 - p * 0.04, opacity: 1 - p * 0.2 });
          gsap.set(headRef.current,  { y: -p * 28 });
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  /* ── Subtle mouse parallax on the glow ── */
  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth  - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      gsap.to(el, { x, y, duration: 1.2, ease: 'power1.out' });
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  const handleTrial = useCallback(() => {
    track('checkout_started');
    navigate('/checkout');
  }, [navigate]);

  const handleDemo = useCallback(() => {
    track('full_demo_open');
    setDemoOpen(true);
  }, []);

  /* ── Render ── */
  return (
    <>
      <section
        ref={sectionRef}
        className="relative w-full overflow-hidden"
        style={{
          minHeight: '100svh',
          background: '#fafafa',
          paddingTop: '72px', // clear fixed header
        }}
      >
        {/* ── Background layer: grid + colour washes ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(rgba(140,121,224,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(140,121,224,.055) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        {/* Colour lights */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(140,121,224,.1), transparent 65%),' +
              'radial-gradient(ellipse 40% 35% at 10% 90%,  rgba(239,85,182,.07), transparent 60%),' +
              'radial-gradient(ellipse 40% 35% at 90% 80%,  rgba(37,168,244,.06),  transparent 60%)',
          }}
        />

        {/* ── Stacked content: centred column ── */}
        <div
          className="relative z-10 flex flex-col items-center text-center px-5"
          style={{ paddingTop: '40px', paddingBottom: '60px' }}
        >
          {/* Badge */}
          <div ref={badgeRef} className="eyebrow mb-6">
            Your personal AI tutor · available 24/7
          </div>

          {/* Headline */}
          <div ref={headRef} style={{ maxWidth: '820px', marginBottom: '24px' }}>
            <h1
              className="font-black leading-[1.04]"
              style={{
                fontSize: 'clamp(36px, 6vw, 68px)',
                letterSpacing: '-2.5px',
                color: 'var(--ink)',
              }}
            >
              The tutor that explains it{' '}
              <span className="grad-text">until it finally makes sense.</span>
            </h1>
          </div>

          {/* Supporting line */}
          <p
            style={{
              fontSize: 'clamp(16px, 1.8vw, 19px)',
              color: 'var(--soft)',
              maxWidth: '520px',
              lineHeight: 1.6,
              marginBottom: '32px',
            }}
          >
            Ask anything. Learn through live visual explanations and unlimited follow-up questions.
          </p>

          {/* CTAs */}
          <div
            ref={ctaRef}
            className="flex flex-col sm:flex-row gap-3 items-center justify-center"
            style={{ marginBottom: '52px' }}
          >
            <button
              className="gbtn text-[15px] px-8 py-4"
              onClick={handleTrial}
              aria-label="Start your free trial"
            >
              Start Free Trial
            </button>
            <button
              className="gost text-[15px] px-7 py-4 flex items-center gap-2"
              onClick={handleDemo}
              aria-label="Watch full product demo"
            >
              <Play size={16} aria-hidden="true" />
              Watch Full Demo
            </button>
          </div>

          {/* ── LARGE CINEMATIC VIDEO STAGE ── */}
          <div
            style={{
              width: '100%',
              maxWidth: '900px',    // ~70% of 1280px viewport
              margin: '0 auto',
              position: 'relative',
            }}
          >
            {/* Animated glow behind the stage */}
            <div
              ref={glowRef}
              className="absolute pointer-events-none"
              aria-hidden="true"
              style={{
                inset: '-40px',
                background:
                  'radial-gradient(ellipse 70% 60% at 50% 55%, rgba(239,85,182,.2), rgba(140,121,224,.15) 45%, rgba(37,168,244,.1) 70%, transparent)',
                filter: 'blur(32px)',
                borderRadius: '50%',
              }}
            />

            {/* Video frame */}
            <div
              ref={stageRef}
              style={{
                position: 'relative',
                borderRadius: '18px',
                overflow: 'hidden',
                aspectRatio: '16/9',
                boxShadow:
                  '0 2px 0 rgba(255,255,255,.6) inset,' +   // top highlight
                  '0 48px 100px -24px rgba(140,121,224,.35),' +
                  '0 0 0 1px rgba(140,121,224,.12)',
                border: '1px solid rgba(255,255,255,.4)',
              }}
            >
              {/* Top-edge glass shimmer */}
              <div
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.7) 40%, rgba(255,255,255,.7) 60%, transparent)',
                  zIndex: 4,
                }}
                aria-hidden="true"
              />

              {/* The video itself */}
              <HeroVideo muted={muted} />

              {/* Mute / unmute toggle — bottom right corner */}
              <button
                onClick={() => setMuted(m => !m)}
                aria-label={muted ? 'Unmute video' : 'Mute video'}
                style={{
                  position: 'absolute',
                  bottom: '14px',
                  right: '14px',
                  zIndex: 10,
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,.45)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {muted
                  ? <VolumeX size={14} aria-hidden="true" />
                  : <Volume2 size={14} aria-hidden="true" />
                }
              </button>
            </div>

            {/* ── Three floating glass pills around the stage ── */}
            <div
              ref={pillsRef}
              className="hidden sm:flex justify-center gap-3 flex-wrap"
              style={{ marginTop: '20px' }}
            >
              {PILLS.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="float-anim flex items-center gap-2"
                  style={{
                    background: 'rgba(255,255,255,.72)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,.6)',
                    borderRadius: '999px',
                    padding: '9px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    boxShadow: '0 4px 18px rgba(140,121,224,.12)',
                  }}
                >
                  <Icon size={14} style={{ color: 'var(--g3)' }} aria-hidden="true" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trust strip */}
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
          <p className="text-[14px] mb-5" style={{ color:'var(--soft)' }}>
            One real question. Visual whiteboard. Voice explanation. Follow-up answered.
          </p>
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

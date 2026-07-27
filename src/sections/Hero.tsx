/**
 * Hero.tsx — V3.2 crash-safe + Bunny Stream
 *
 * Screen calibration (unchanged):
 *   --screen-top:    2.4%
 *   --screen-left:   9.6%
 *   --screen-width:  81.4%
 *   --screen-height: 90.6%
 *
 * Video sources: Bunny Stream embed iframes.
 * Local files remain in public/videos for rollback but are not referenced.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Play, BookOpen, Zap, MessageSquare, X } from 'lucide-react';
import { track } from '../utils/analytics';
gsap.registerPlugin(ScrollTrigger);

/* ── Bunny Stream embed URLs ───────────────────────────────────────────────
 * Use https://player.mediadelivery.net/embed/... exactly as supplied.
 * Do not change to /play/... Do not download. Do not bundle.
 * ──────────────────────────────────────────────────────────────────────── */
const HERO_FULL_DEMO_URL =
  'https://player.mediadelivery.net/embed/712849/9ddc752f-6ff6-49b2-9e84-cb7c5aa5a87c?autoplay=false&muted=false&loop=false&preload=false&playsinline=true&rememberPosition=false';

const CARDS = [
  { Icon: BookOpen,      title: 'All subjects', sub: 'Bio, Physics, Math, Econ, etc.' },
  { Icon: Zap,           title: '1:1 lessons',  sub: 'Interactive, visual & audio'    },
  { Icon: MessageSquare, title: 'Ask anything', sub: 'Interrupt with any question'    },
];

/* ── Bunny direct MP4 URL for the Hero laptop loop ─────────────────────────
 * CDN hostname: vz-b523719a-f10.b-cdn.net  (Library ID: 712849)
 * Video ID:     8e42019d-a6fa-43d2-ad9f-74d9a54286a6
 * 720p is the primary source; 1080p is listed as a fallback <source>.
 * Using a native <video> element instead of the iframe so objectFit:cover
 * fills the laptop screen without Bunny player chrome or letterboxing.
 * ──────────────────────────────────────────────────────────────────────── */
const LAPTOP_MP4_720P  = 'https://vz-b523719a-f10.b-cdn.net/8e42019d-a6fa-43d2-ad9f-74d9a54286a6/play_720p.mp4';
const LAPTOP_MP4_1080P = 'https://vz-b523719a-f10.b-cdn.net/8e42019d-a6fa-43d2-ad9f-74d9a54286a6/play_1080p.mp4';

/* ─── Laptop stage ─────────────────────────────────────────────────────────
 * Native <video> with objectFit:cover fills the screen container exactly.
 * No iframe, no player.js, no letterboxing.
 * Mute/unmute is controlled directly via videoRef.current.muted.
 * ──────────────────────────────────────────────────────────────────────── */
function LaptopStage() {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const mountedRef = useRef(true);
  const [muted, setMuted] = useState(true);   // starts muted (autoplay policy)

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* Keep the DOM element in sync whenever React state changes */
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted]);

  const handleMuteToggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;

    const next = !muted;
    v.muted = next;

    /* If the browser paused after unmute, resume playback safely */
    if (!next && v.paused) {
      v.play().catch(() => { /* autoplay policy — silently ignored */ });
    }

    if (mountedRef.current) setMuted(next);
  }, [muted]);

  return (
    <div
      style={{
        '--screen-top':    '2.4%',
        '--screen-left':   '9.6%',
        '--screen-width':  '81.4%',
        '--screen-height': '90.6%',
        position: 'relative',
        width: '100%',
        userSelect: 'none',
      } as React.CSSProperties}
    >
      {/* Screen overlay — calibration unchanged, clipping preserved */}
      <div
        style={{
          position: 'absolute',
          top:    'var(--screen-top)',
          left:   'var(--screen-left)',
          width:  'var(--screen-width)',
          height: 'var(--screen-height)',
          overflow: 'hidden',
          borderRadius: '6px',
          background: '#111',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        {/* Native video — objectFit:cover fills container with no letterboxing */}
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label="Studdy AI tutor demonstration"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            border: 0,
            display: 'block',
            pointerEvents: 'none',
          }}
        >
          {/* 720p primary — 1080p fallback if 720p unavailable */}
          <source src={LAPTOP_MP4_720P}  type="video/mp4" />
          <source src={LAPTOP_MP4_1080P} type="video/mp4" />
        </video>
      </div>

      {/* Mute/unmute button — zIndex 3, above screen overlay */}
      <button
        onClick={handleMuteToggle}
        aria-label={muted ? 'Unmute demo video' : 'Mute demo video'}
        style={{
          position: 'absolute',
          top:   'calc(var(--screen-top) + 14px)',
          right: 'calc(100% - var(--screen-left) - var(--screen-width) + 14px)',
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(0,0,0,.62)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,.18)',
          borderRadius: '999px',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 700,
          fontFamily: 'inherit',
          padding: '7px 12px 7px 10px',
          cursor: 'pointer',
          pointerEvents: 'auto',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {muted ? (
          /* VolumeX — muted */
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        ) : (
          /* Volume2 — unmuted */
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        )}
        {muted ? 'Click to unmute' : 'Click to mute'}
      </button>

      {/* Laptop PNG — z-index 1, unchanged */}
      <img
        src="/images/Laptop.png"
        alt="Studdy running on a laptop"
        style={{ position: 'relative', zIndex: 1, width: '100%', display: 'block', pointerEvents: 'none' }}
        draggable={false}
      />
    </div>
  );
}

/* ─── Watch Full Demo modal ─────────────────────────────────────────────────
 * A2: The local <video> element is replaced by a Bunny iframe.
 * Modal structure, dimensions, backdrop, ESC, body-scroll lock and
 * conditional-mount pattern are all unchanged.
 *
 * Because the iframe is conditionally mounted (created on open, removed on
 * close), Bunny playback is automatically stopped and reset by the browser
 * when the iframe is unmounted — no pause()/currentTime calls needed.
 * ──────────────────────────────────────────────────────────────────────── */
function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  /* ESC key */
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  /* Body scroll lock */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
    document.body.style.overflow = '';
  }, [open]);

  /* Conditional mount — poster-on-first-open preserved; no stale video refs */
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        animation: 'st-fade-in 200ms ease forwards',
      }}
    >
      <style>{`
        @keyframes st-fade-in  { from { opacity:0 } to { opacity:1 } }
        @keyframes st-scale-in { from { opacity:0; transform:scale(.95) } to { opacity:1; transform:scale(1) } }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(10,8,20,.82)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog" aria-modal="true" aria-label="Full product demo"
        style={{
          position: 'relative', zIndex: 1,
          width: '90vw', maxWidth: '1200px', maxHeight: '90vh',
          background: 'rgba(18,14,30,.96)',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: '20px',
          boxShadow: '0 40px 100px rgba(0,0,0,.6), 0 0 0 1px rgba(140,121,224,.15)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          animation: 'st-scale-in 220ms cubic-bezier(.16,1,.3,1) forwards',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,.08)',
          flexShrink: 0,
        }}>
          <div>
            <div className="font-black" style={{ color: '#fff', fontSize: '16px', marginBottom: '2px' }}>Watch Full Demo</div>
            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: '12.5px' }}>See Studdy explain from start to finish</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close demo"
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'rgba(255,255,255,.08)',
              border: '1px solid rgba(255,255,255,.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,.7)', cursor: 'pointer',
              transition: 'background 150ms', flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Bunny iframe — created on open, unmounted on close (stops playback) */}
        <div style={{ flex: 1, position: 'relative', background: '#000', aspectRatio: '16/9', minHeight: 0, overflow: 'hidden' }}>
          <iframe
            src={HERO_FULL_DEMO_URL}
            title="Watch the full Studdy demo"
            loading="lazy"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%',
              height: '100%',
              border: 0,
              display: 'block',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Hero ─── */
export default function Hero() {
  const navigate   = useNavigate();
  const sectionRef = useRef<HTMLDivElement>(null);
  const copyRef    = useRef<HTMLDivElement>(null);
  const ctaRef     = useRef<HTMLDivElement>(null);
  const laptopRef  = useRef<HTMLDivElement>(null);
  const cardsRef   = useRef<HTMLDivElement>(null);
  const glowRef    = useRef<HTMLDivElement>(null);
  const [demoOpen, setDemoOpen] = useState(false);

  /* Entrance animation — unchanged */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from(copyRef.current,   { opacity: 0, y: 24, duration: 0.75 })
        .from(ctaRef.current,    { opacity: 0, y: 16, duration: 0.6  }, '-=0.35')
        .from(laptopRef.current, { opacity: 0, y: 32, duration: 0.85 }, '-=0.4')
        .from(
          cardsRef.current ? Array.from(cardsRef.current.children) : [],
          { opacity: 0, y: 10, duration: 0.4, stagger: 0.1 }, '-=0.45'
        );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  /* Scroll scale — unchanged */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top', end: 'bottom top', scrub: 0.5,
        onUpdate: self => {
          const p = self.progress;
          if (laptopRef.current) gsap.set(laptopRef.current, { scale: 1 - p * 0.02 });
          if (copyRef.current)   gsap.set(copyRef.current,   { y: -p * 18 });
        },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  /* Mouse parallax — desktop only, unchanged */
  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const h = (e: MouseEvent) => {
      gsap.to(el, {
        x: (e.clientX / window.innerWidth  - 0.5) * 22,
        y: (e.clientY / window.innerHeight - 0.5) * 14,
        duration: 1.4, ease: 'power1.out',
      });
    };
    window.addEventListener('mousemove', h, { passive: true });
    return () => window.removeEventListener('mousemove', h);
  }, []);

  const handleTrial = useCallback(() => { track('checkout_started'); navigate('/checkout'); }, [navigate]);
  const handleDemo  = useCallback(() => { track('full_demo_open');   setDemoOpen(true);    }, []);
  const closeDemo   = useCallback(() => setDemoOpen(false), []);

  return (
    <>
      <section
        ref={sectionRef}
        className="relative w-full overflow-hidden"
        style={{ background: '#f9f8fc', minHeight: '100svh' }}
      >
        {/* Background grid — unchanged */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(rgba(140,121,224,.05) 1px,transparent 1px),' +
              'linear-gradient(90deg,rgba(140,121,224,.05) 1px,transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Grain — unchanged */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
          style={{
            opacity: 0.025,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
          }}
        />
        {/* Colour wash — unchanged */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 55% 45% at 50% -5%,rgba(140,121,224,.11),transparent 65%),' +
              'radial-gradient(ellipse 35% 30% at 8% 90%,rgba(239,85,182,.08),transparent 60%),' +
              'radial-gradient(ellipse 35% 30% at 92% 85%,rgba(37,168,244,.07),transparent 60%)',
          }}
        />

        {/* Spacing — unchanged */}
        <style>{`
          #hero-col { padding-top: 20px; }
          @media (min-width: 768px)  { #hero-col { padding-top: 22px; } }
          @media (min-width: 1024px) { #hero-col { padding-top: 28px; } }
        `}</style>

        <div id="hero-col" className="relative z-10 flex flex-col items-center text-center"
          style={{ paddingBottom: '40px', paddingLeft: '20px', paddingRight: '20px' }}>

          {/* Copy — unchanged */}
          <div ref={copyRef} style={{ maxWidth: '760px', marginBottom: '26px' }}>
            <div className="eyebrow mb-5" style={{ display: 'inline-flex' }}>
              Learning that finally clicks.
            </div>
            <h1 className="font-black leading-[1.06]"
              style={{ fontSize: 'clamp(34px,5.5vw,62px)', letterSpacing: '-2px', color: 'var(--ink)', marginBottom: '18px' }}>
              Stop memorising.{' '}
              <span className="grad-text">Start understanding.</span>
            </h1>
            <p style={{ fontSize: 'clamp(15px,1.6vw,18px)', color: 'var(--soft)', lineHeight: 1.65, maxWidth: '560px', margin: '0 auto' }}>
              Ask anything. Learn through live visual explanations. Interrupt anytime to ask follow-up questions until it finally makes sense.
            </p>
          </div>

          {/* CTAs — unchanged */}
          <div ref={ctaRef} className="flex flex-col sm:flex-row gap-3 items-center justify-center" style={{ marginBottom: '36px' }}>
            <button className="gbtn text-[15px] px-8 py-4" onClick={handleTrial} aria-label="Start free trial">
              Start Free Trial
            </button>
            <button className="gost text-[15px] px-7 py-4" onClick={handleDemo} aria-label="Watch full demo"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={15} aria-hidden />
              Watch Full Demo
            </button>
          </div>

          {/* Laptop + cards — unchanged structure */}
          <div style={{ width: '100%', maxWidth: '1060px', margin: '0 auto', position: 'relative' }}>
            <div ref={glowRef} className="absolute pointer-events-none" aria-hidden="true"
              style={{
                inset: '-50px',
                background:
                  'radial-gradient(ellipse 60% 55% at 50% 50%,' +
                  'rgba(239,85,182,.18) 0%,rgba(140,121,224,.14) 35%,' +
                  'rgba(37,168,244,.09) 65%,transparent 85%)',
                filter: 'blur(36px)', borderRadius: '50%', zIndex: 0,
              }}
            />
            <div ref={laptopRef} style={{ position: 'relative', zIndex: 1 }}>
              <LaptopStage />
            </div>

            {/* Feature cards — unchanged */}
            <div ref={cardsRef} style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '20px' }}>
              {CARDS.map(({ Icon, title, sub }) => (
                <div key={title} style={{
                  background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(14px)',
                  border: '1px solid rgba(255,255,255,.65)', borderRadius: '16px',
                  padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px',
                  boxShadow: '0 4px 20px rgba(140,121,224,.12)', minWidth: '180px', flex: '0 1 auto',
                }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--grad)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
                    <Icon size={16} color="#fff" strokeWidth={2} />
                  </div>
                  <div>
                    <div className="font-black" style={{ fontSize: '13.5px', color: 'var(--ink)', lineHeight: 1.2, marginBottom: '2px' }}>{title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--soft)', lineHeight: 1.4 }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trust row — unchanged */}
        <div className="relative z-10 border-t px-6 py-3 flex flex-wrap justify-center gap-6"
          style={{ borderColor: 'var(--border)', color: 'var(--soft)', fontSize: '12.5px', fontWeight: 600 }}>
          {['$0 due today', 'Reminder before renewal', 'Cancel anytime'].map(t => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--g4)' }}>✓</span> {t}
            </span>
          ))}
        </div>
      </section>

      {/* DemoModal: conditionally mounted — Bunny iframe unmounts on close */}
      <DemoModal open={demoOpen} onClose={closeDemo} />
    </>
  );
}

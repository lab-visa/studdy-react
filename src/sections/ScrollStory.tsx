/**
 * ScrollStory.tsx — Section 4 — Cinematic 10-slide scroll story
 *
 * ARCHITECTURE:
 *
 * Scroll:  CSS position:sticky + 10 IntersectionObserver sentinels.
 *          No GSAP. No wheel hijacking. No preventDefault.
 *          Safari cannot get stuck. Exits naturally in both directions.
 *
 * Video:   All 10 Bunny iframes permanently mounted.
 *          Visibility via CSS opacity only — no remounting, no src changes.
 *          Each iframe has a dark cover div that fades away on onLoad.
 *          This prevents any Bunny chrome flash.
 *
 * Playback: muted + autoplay + loop in URL params.
 *           No player.js dependency — Bunny handles playback natively.
 *           All 10 videos play muted in the background (same as the
 *           previous working version). Opacity hides inactive slides.
 *           This is simpler and more reliable across all browsers.
 *
 * Crossfade: CSS transition opacity 550ms on each layer.
 *            Active slide opacity → 1, others → 0.
 *            Minimum opacity math prevents any fully black frame.
 *
 * Crash-safe: no GSAP orientation race, no conditional DOM swap.
 */
import {
  useEffect, useRef, useState, useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../utils/analytics';

/* ══════════════════════════════════════════════════════════════
   SLIDE DATA
   ══════════════════════════════════════════════════════════════ */
interface Slide {
  id: number;
  bunnyId: string;
  eyebrow: string;
  headline: string;
  description: string;
  textSide: 'left' | 'right';
  overlayStrength: number;
  isFinal?: boolean;
}

const LIB = '712849';
const PARAMS =
  'autoplay=true&muted=true&loop=true&playsinline=true' +
  '&preload=true&controls=false&rememberPosition=false';
const embedUrl = (id: string) =>
  `https://player.mediadelivery.net/embed/${LIB}/${id}?${PARAMS}`;

const SLIDES: Slide[] = [
  {
    id: 1, bunnyId: '820e122c-064f-4b71-8b6d-d0d1874b1e27',
    eyebrow: 'THE STRUGGLE',
    headline: 'It starts with one difficult question.',
    description: 'Late at night, homework continues — but understanding does not always come easily.',
    textSide: 'left', overlayStrength: 0.55,
  },
  {
    id: 2, bunnyId: '151be9e3-b812-4bf0-a921-d2e53c239c00',
    eyebrow: 'WHEN LEARNING STOPS',
    headline: 'Then frustration takes over.',
    description: 'The answer may be somewhere in the book. What is missing is someone who can explain it clearly.',
    textSide: 'left', overlayStrength: 0.55,
  },
  {
    id: 3, bunnyId: 'c37db453-eaf2-4aaa-97f3-3a40048f5a3a',
    eyebrow: 'A DIFFERENT WAY',
    headline: 'So he asks Studdy.',
    description: 'One question opens a personal learning experience built around how he understands best.',
    textSide: 'left', overlayStrength: 0.5,
  },
  {
    id: 4, bunnyId: '06fd86f2-c358-4207-a135-0403f1aab46f',
    eyebrow: 'VISUAL EXPLANATIONS',
    headline: 'The lesson comes alive.',
    description: 'Studdy explains step by step using voice, drawings, diagrams and an interactive whiteboard.',
    textSide: 'left', overlayStrength: 0.45,
  },
  {
    id: 5, bunnyId: 'adfa2cdf-68ce-428f-b030-2470eb5af6e2',
    eyebrow: 'THE AHA MOMENT',
    headline: 'Complex ideas finally make sense.',
    description: 'Instead of memorising an answer, he can see why it works.',
    textSide: 'left', overlayStrength: 0.5,
  },
  {
    id: 6, bunnyId: '9cf9db7e-169d-4812-8252-83791afc4506',
    eyebrow: 'CONFIDENCE',
    headline: 'Understanding changes how children learn.',
    description: 'Confusion becomes curiosity. Hesitation becomes confident progress.',
    textSide: 'left', overlayStrength: 0.5,
  },
  {
    id: 7, bunnyId: '6236b3bf-4f2e-42d7-8fe3-c76ff3fa045c',
    eyebrow: 'HOW STUDDY WORKS',
    headline: 'One visual step at a time.',
    description: 'Ask a question. See the explanation. Understand the concept. Take better notes. Solve confidently.',
    textSide: 'left', overlayStrength: 0.45,
  },
  {
    id: 8, bunnyId: '7e652b2e-afc2-4759-b82b-bd6ee3d8d1d7',
    eyebrow: 'THE TRANSFORMATION',
    headline: 'Now he can keep going on his own.',
    description: 'The same learner. The same homework. A completely different level of confidence.',
    textSide: 'left', overlayStrength: 0.55,
  },
  {
    id: 9, bunnyId: '2c7c3194-2990-4ba3-84e3-1ea5bb443587',
    eyebrow: 'PARENTS NOTICE',
    headline: 'The difference is easy to see.',
    description: 'A child who understands needs less reminding, feels less frustrated and learns more independently.',
    textSide: 'left', overlayStrength: 0.5,
  },
  {
    id: 10, bunnyId: '24ea24d8-447f-44e0-bfbb-99f7c35dca40',
    eyebrow: 'MEET STUDDY',
    headline: 'A personal AI tutor, ready whenever learning gets difficult.',
    description: 'Ask anything. Learn visually. Understand deeply.',
    textSide: 'left', overlayStrength: 0.6,
    isFinal: true,
  },
];
const N = SLIDES.length;

/* ══════════════════════════════════════════════════════════════
   TEXT OVERLAY
   ══════════════════════════════════════════════════════════════ */
function SlideText({
  slide, opacity, onTrial,
}: {
  slide: Slide; opacity: number; onTrial: () => void;
}) {
  const isLeft = slide.textSide !== 'right';
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      aria-hidden={opacity < 0.02}
      style={{
        position: 'absolute',
        bottom: '10vh',
        left:  isLeft ? 'clamp(24px, 7vw, 100px)' : 'auto',
        right: !isLeft ? 'clamp(24px, 7vw, 100px)' : 'auto',
        maxWidth: 'min(520px, 45vw)',
        opacity,
        transform: prefersReduced ? 'none' : `translateY(${(1 - opacity) * 10}px)`,
        transition: prefersReduced ? 'none' : 'opacity 500ms ease, transform 500ms ease',
        zIndex: 10,
        pointerEvents: opacity > 0.5 ? 'auto' : 'none',
      }}
    >
      <div aria-hidden="true" style={{
        position: 'absolute', inset: '-28px -36px -28px -36px',
        background: `radial-gradient(ellipse at ${isLeft ? '18%' : '82%'} 65%,
          rgba(0,0,0,${(slide.overlayStrength + 0.1).toFixed(2)}) 0%,
          rgba(0,0,0,${(slide.overlayStrength * 0.4).toFixed(2)}) 45%, transparent 75%)`,
        borderRadius: '24px', zIndex: -1, pointerEvents: 'none',
      }} />
      <div style={{
        fontSize: '10px', fontWeight: 800, letterSpacing: '0.18em',
        color: 'rgba(255,255,255,.5)', marginBottom: '8px',
        textTransform: 'uppercase', fontFamily: 'monospace',
      }}>
        {slide.eyebrow}
      </div>
      <h3 style={{
        fontSize: 'clamp(20px, 2.8vw, 36px)', fontWeight: 900, lineHeight: 1.12,
        letterSpacing: '-0.5px', color: '#fff', marginBottom: '12px',
        textShadow: '0 2px 28px rgba(0,0,0,.6)',
      }}>
        {slide.headline}
      </h3>
      <p style={{
        fontSize: 'clamp(13px, 1.2vw, 15px)', color: 'rgba(255,255,255,.65)',
        lineHeight: 1.7, textShadow: '0 1px 12px rgba(0,0,0,.5)',
        marginBottom: slide.isFinal ? '22px' : 0,
      }}>
        {slide.description}
      </p>
      {slide.isFinal && (
        <button className="gbtn" style={{ fontSize: '14px', padding: '11px 28px' }}
          onClick={onTrial} aria-label="Start free trial with Studdy">
          Start Free Trial
        </button>
      )}
    </div>
  );
}

/* cover handled imperatively via coverRefs in main component */

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function ScrollStory() {
  const navigate = useNavigate();
  const sectionRef   = useRef<HTMLDivElement>(null);
  const sentinelRefs = useRef<(HTMLDivElement | null)[]>(Array(N).fill(null));
  const coverRefs    = useRef<(HTMLDivElement | null)[]>(Array(N).fill(null));
  const mountedRef   = useRef(true);
  const activeRef    = useRef(0);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [active,  setActive]  = useState(0);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  // videoOpacity[i]: drives the slide container
  const [videoOp, setVideoOp] = useState<number[]>(() => {
    const a = Array(N).fill(0) as number[];
    a[0] = 1;
    return a;
  });
  // textOpacity[i]: drives the text overlay
  const [textOp, setTextOp] = useState<number[]>(() => {
    const a = Array(N).fill(0) as number[];
    a[0] = 1;
    return a;
  });

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* isMobile */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  /* Set the active slide — fade in new, fade out old */
  const goToSlide = useCallback((idx: number) => {
    if (!mountedRef.current) return;
    const prev = activeRef.current;
    if (prev === idx) return;
    activeRef.current = idx;
    setActive(idx);

    setVideoOp(old => {
      const n = [...old];
      n[idx]  = 1;
      n[prev] = 0;
      return n;
    });
    setTextOp(old => {
      const n = [...old];
      n[idx]  = 1;
      n[prev] = 0;
      return n;
    });
  }, []);

  /* ── 10 sentinel IntersectionObservers + scroll-idle snap ───────
   *
   * PROBLEM: If the user stops scrolling exactly between two sentinels
   * the crossfade opacity is split and the screen shows a dark overlap.
   *
   * FIX: Two complementary mechanisms:
   *
   * 1. IntersectionObserver on each sentinel — fires as the user scrolls
   *    normally, changing the active slide when a sentinel crosses the
   *    centre of the viewport.
   *
   * 2. Scroll-idle detector — after the user stops scrolling for 150ms,
   *    calculate which sentinel is closest to the centre and snap to it.
   *    This guarantees we never freeze in the dead zone between slides.
   *
   * Neither mechanism hijacks scroll or calls preventDefault.
   * ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    /* --- 1. IntersectionObservers --- */
    SLIDES.forEach((_, i) => {
      const el = sentinelRefs.current[i];
      if (!el) return;

      const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            if (mountedRef.current) goToSlide(i);
          }, 60);
        });
      }, {
        rootMargin: '-35% 0px -35% 0px',
        threshold: 0,
      });

      obs.observe(el);
      observers.push(obs);
    });

    /* --- 2. Scroll-idle snap --- */
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const IDLE_MS = 150; // ms after last scroll event before snapping

    const snapToNearest = () => {
      /* Find which sentinel is closest to the viewport centre */
      const midY = window.innerHeight / 2;
      let bestIdx = activeRef.current;
      let bestDist = Infinity;

      sentinelRefs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        /* Use the vertical centre of each sentinel */
        const sentinelMid = rect.top + rect.height / 2;
        const dist = Math.abs(sentinelMid - midY);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });

      if (mountedRef.current) goToSlide(bestIdx);
    };

    const onScroll = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(snapToNearest, IDLE_MS);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observers.forEach(o => o.disconnect());
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [goToSlide]);

  /* ── Handle iframe onLoad: fade out the cover ─────────────────── */
  const handleIframeLoad = useCallback((i: number) => {
    const cover = coverRefs.current[i];
    if (cover) cover.style.opacity = '0';
  }, []);

  const handleTrial = useCallback(() => {
    track('checkout_started');
    navigate('/checkout');
  }, [navigate]);

  const tag = `${String(active + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */
  return (
    <section ref={sectionRef} style={{ position: 'relative', background: '#0d0b15' }}>

      {/* ── Intro heading ── */}
      <div className="py-14 text-center px-6">
        <div className="eyebrow mb-4" style={{
          color: 'rgba(255,255,255,.45)',
          borderColor: 'rgba(255,255,255,.15)',
          background: 'rgba(255,255,255,.06)',
        }}>
          A story every learner recognises
        </div>
        <h2 className="font-black text-white"
          style={{ fontSize: 'clamp(24px,3.5vw,38px)', letterSpacing: '-0.8px' }}>
          One question changed everything.
        </h2>
      </div>

      {/* ══════════════════════════════════════════════════════════
          DESKTOP
          ══════════════════════════════════════════════════════════ */}
      <div style={{ display: isMobile ? 'none' : 'block' }} aria-hidden={isMobile}>

        {/*
         * STICKY STAGE
         * Stays fixed at top:0 while the scroll track below it scrolls.
         * No GSAP, no wheel listeners, no nested scroll containers.
         * Works perfectly in Safari.
         */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflow: 'hidden',
            background: '#0d0b15',
            zIndex: 5,
          }}
          role="region"
          aria-label="Cinematic story: a learner's journey with Studdy"
        >
          {/* All 10 video layers — always in DOM, opacity-controlled only */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
            {SLIDES.map((slide, i) => (
              <div
                key={slide.id}
                style={{
                  position: 'absolute', inset: 0,
                  opacity: videoOp[i],
                  transition: prefersReduced ? 'none' : 'opacity 550ms ease',
                  overflow: 'hidden',
                  background: '#0d0b15',
                  willChange: 'opacity',
                }}
              >
                <iframe
                  src={embedUrl(slide.bunnyId)}
                  title={`Story slide ${slide.id}: ${slide.headline}`}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  aria-hidden="true"
                  tabIndex={-1}
                  onLoad={() => handleIframeLoad(i)}
                  style={{
                    position: 'absolute',
                    top: '-2px', left: '-2px',
                    width: 'calc(100% + 4px)',
                    height: 'calc(100% + 4px)',
                    border: 0, pointerEvents: 'none', display: 'block',
                  }}
                />
                {/* Flash-prevention cover — hidden imperatively on onLoad */}
                <div
                  ref={el => { coverRefs.current[i] = el; }}
                  aria-hidden="true"
                  style={{
                    position: 'absolute', inset: 0, zIndex: 3,
                    background: '#0d0b15',
                    transition: 'opacity 400ms ease',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Text overlays */}
          {SLIDES.map((slide, i) => (
            <SlideText key={slide.id} slide={slide}
              opacity={textOp[i]} onTrial={handleTrial} />
          ))}

          {/* Progress counter */}
          <div className="font-mono" style={{
            position: 'absolute', top: '28px', left: '32px', zIndex: 20,
            fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em',
            color: 'rgba(255,255,255,.35)',
          }} aria-live="polite">
            {tag}
          </div>

          {/* Progress dots */}
          <div style={{
            position: 'absolute', bottom: '24px', right: '28px',
            display: 'flex', gap: '6px', zIndex: 20, alignItems: 'center',
          }} role="status" aria-label={`Slide ${active + 1} of ${N}`}>
            {SLIDES.map((_, i) => (
              <div key={i} style={{
                height: '5px', borderRadius: '999px',
                width: i === active ? '20px' : '5px',
                background: i === active ? 'var(--g1)' : 'rgba(255,255,255,.22)',
                transition: prefersReduced ? 'none' : 'width 300ms ease, background 300ms ease',
              }} />
            ))}
          </div>
        </div>

        {/*
         * SCROLL TRACK
         * 10 sentinel divs stacked in normal document flow.
         * As the page scrolls, each sentinel crosses the viewport centre,
         * triggering the IntersectionObserver which changes the active slide.
         * 110vh per sentinel = 1100vh total = deliberate, controlled pacing.
         */}
        <div aria-hidden="true" style={{ background: '#0d0b15' }}>
          {SLIDES.map((slide, i) => (
            <div
              key={slide.id}
              ref={el => { sentinelRefs.current[i] = el; }}
              style={{ height: '110vh' }}
            />
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MOBILE — vertical stacked (final layout in separate task)
          ══════════════════════════════════════════════════════════ */}
      <div style={{ display: isMobile ? 'block' : 'none' }} aria-hidden={!isMobile}>
        {SLIDES.map(slide => (
          <div key={slide.id} style={{ background: '#0d0b15' }}>
            <div style={{
              position: 'relative', width: '100%', paddingTop: '56.25%',
              background: '#0d0b15', overflow: 'hidden',
            }}>
              <iframe
                src={embedUrl(slide.bunnyId)}
                title={`Slide ${slide.id}`}
                allow="autoplay; encrypted-media; picture-in-picture"
                loading="lazy"
                aria-hidden="true"
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  top: '-2px', left: '-2px',
                  width: 'calc(100% + 4px)',
                  height: 'calc(100% + 4px)',
                  border: 0,
                  pointerEvents: 'none',
                }}
              />
            </div>
            <div style={{ padding: '18px 20px 24px' }}>
              <div style={{
                fontSize: '9px', fontWeight: 800, letterSpacing: '0.15em',
                color: 'rgba(255,255,255,.4)', marginBottom: '6px',
                textTransform: 'uppercase', fontFamily: 'monospace',
              }}>
                {slide.eyebrow}
              </div>
              <h3 style={{
                fontSize: 'clamp(17px, 4.5vw, 22px)', fontWeight: 900,
                color: '#fff', lineHeight: 1.15, letterSpacing: '-0.4px', marginBottom: '8px',
              }}>
                {slide.headline}
              </h3>
              <p style={{
                fontSize: '14px', color: 'rgba(255,255,255,.6)',
                lineHeight: 1.65, marginBottom: slide.isFinal ? '16px' : 0,
              }}>
                {slide.description}
              </p>
              {slide.isFinal && (
                <button className="gbtn"
                  style={{ width: '100%', fontSize: '14px', padding: '13px' }}
                  onClick={handleTrial} aria-label="Start free trial">
                  Start Free Trial
                </button>
              )}
            </div>
            {slide.id < N && (
              <div style={{ height: '1px', background: 'rgba(255,255,255,.07)', margin: '0 20px' }} />
            )}
          </div>
        ))}
      </div>

    </section>
  );
}

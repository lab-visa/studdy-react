/**
 * ScrollStory.tsx — Section 4
 *
 * Desktop: CSS sticky stage + IntersectionObserver sentinels (110vh each)
 * Mobile:  Completely separate component — simple sticky + sentinels (90svh)
 *          Uses 9:16 vertical videos. No shared state with desktop.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../utils/analytics';

/* ── Slide data ─────────────────────────────────────────────── */
interface Slide {
  id: number;
  bunnyId: string;        // desktop 16:9 video
  mobileBunnyId: string;  // mobile 9:16 video
  eyebrow: string;
  headline: string;
  description: string;
  overlayStrength: number;
  isFinal?: boolean;
}

const LIB = '712849';
const P = 'autoplay=true&muted=true&loop=true&playsinline=true&preload=true&controls=false&rememberPosition=false';
const eUrl = (id: string) => `https://player.mediadelivery.net/embed/${LIB}/${id}?${P}`;

const SLIDES: Slide[] = [
  { id:1,  bunnyId:'820e122c-064f-4b71-8b6d-d0d1874b1e27', mobileBunnyId:'242d7ca2-1f1f-49a5-9af6-2c2a0e33bbf0', eyebrow:'THE STRUGGLE',       headline:'It starts with one difficult question.',                            description:'Late at night, homework continues — but understanding does not always come easily.',                                               overlayStrength:0.55 },
  { id:2,  bunnyId:'151be9e3-b812-4bf0-a921-d2e53c239c00', mobileBunnyId:'ce8e510d-a51f-4bfa-afa2-cc0a7de29873', eyebrow:'WHEN LEARNING STOPS', headline:'Then frustration takes over.',                                      description:'The answer may be somewhere in the book. What is missing is someone who can explain it clearly.',                                  overlayStrength:0.55 },
  { id:3,  bunnyId:'c37db453-eaf2-4aaa-97f3-3a40048f5a3a', mobileBunnyId:'22dfa7fc-f235-4c1c-bbc8-01634b089eba', eyebrow:'A DIFFERENT WAY',     headline:'So he asks Studdy.',                                              description:'One question opens a personal learning experience built around how he understands best.',                                           overlayStrength:0.5  },
  { id:4,  bunnyId:'06fd86f2-c358-4207-a135-0403f1aab46f', mobileBunnyId:'b302c616-81f8-4ff7-8d9e-f68869799af6', eyebrow:'VISUAL EXPLANATIONS',  headline:'The lesson comes alive.',                                         description:'Studdy explains step by step using voice, drawings, diagrams and an interactive whiteboard.',                                      overlayStrength:0.45 },
  { id:5,  bunnyId:'adfa2cdf-68ce-428f-b030-2470eb5af6e2', mobileBunnyId:'ab8735ae-7a31-43aa-b311-8bbcf5a2f772', eyebrow:'THE AHA MOMENT',       headline:'Complex ideas finally make sense.',                               description:'Instead of memorising an answer, he can see why it works.',                                                                        overlayStrength:0.5  },
  { id:6,  bunnyId:'9cf9db7e-169d-4812-8252-83791afc4506', mobileBunnyId:'39508299-0efa-4665-b479-0b78c8dbc02e', eyebrow:'CONFIDENCE',           headline:'Understanding changes how children learn.',                       description:'Confusion becomes curiosity. Hesitation becomes confident progress.',                                                              overlayStrength:0.5  },
  { id:7,  bunnyId:'6236b3bf-4f2e-42d7-8fe3-c76ff3fa045c', mobileBunnyId:'772ec9eb-4370-4417-96af-2f8dd6ed9d93', eyebrow:'HOW STUDDY WORKS',     headline:'One visual step at a time.',                                      description:'Ask a question. See the explanation. Understand the concept. Take better notes. Solve confidently.',                               overlayStrength:0.45 },
  { id:8,  bunnyId:'7e652b2e-afc2-4759-b82b-bd6ee3d8d1d7', mobileBunnyId:'2417db4b-7b0c-46c8-89ff-e93870e59ba4', eyebrow:'THE TRANSFORMATION',   headline:'Now he can keep going on his own.',                              description:'The same learner. The same homework. A completely different level of confidence.',                                                 overlayStrength:0.55 },
  { id:9,  bunnyId:'2c7c3194-2990-4ba3-84e3-1ea5bb443587', mobileBunnyId:'4b31466d-071e-4178-b8be-e2477df6c2ee', eyebrow:'PARENTS NOTICE',        headline:'The difference is easy to see.',                                  description:'A child who understands needs less reminding, feels less frustrated and learns more independently.',                                overlayStrength:0.5  },
  { id:10, bunnyId:'24ea24d8-447f-44e0-bfbb-99f7c35dca40', mobileBunnyId:'d58eb819-dc5d-4484-a6b2-c4de527f5112', eyebrow:'MEET STUDDY',           headline:'A personal AI tutor, ready whenever learning gets difficult.',   description:'Ask anything. Learn visually. Understand deeply.',                                                                                  overlayStrength:0.6, isFinal:true },
];
const N = SLIDES.length;

/* ── Shared text overlay ──────────────────────────────────────── */
function Overlay({ slide, opacity, onTrial, mobile = false }: {
  slide: Slide; opacity: number; onTrial: () => void; mobile?: boolean;
}) {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  return (
    <div aria-hidden={opacity < 0.02} style={{
      position: 'absolute',
      bottom: mobile ? 'max(36px, env(safe-area-inset-bottom,24px))' : '10vh',
      left: mobile ? '24px' : 'clamp(24px,7vw,100px)',
      right: mobile ? '24px' : 'auto',
      maxWidth: mobile ? undefined : 'min(520px,45vw)',
      opacity, zIndex: 10,
      transform: reduced ? 'none' : `translateY(${(1-opacity)*10}px)`,
      transition: reduced ? 'none' : 'opacity 500ms ease, transform 500ms ease',
      pointerEvents: opacity > 0.5 ? 'auto' : 'none',
    }}>
      {/* Local gradient behind text */}
      {!mobile && (
        <div aria-hidden="true" style={{
          position:'absolute', inset:'-28px -36px -28px -36px',
          background:`radial-gradient(ellipse at 18% 65%, rgba(0,0,0,${(slide.overlayStrength+0.1).toFixed(2)}) 0%, rgba(0,0,0,${(slide.overlayStrength*0.4).toFixed(2)}) 45%, transparent 75%)`,
          borderRadius:'24px', zIndex:-1, pointerEvents:'none',
        }} />
      )}
      <div style={{ fontSize:'10px', fontWeight:800, letterSpacing:'0.18em', color:'rgba(255,255,255,.5)', marginBottom:'8px', textTransform:'uppercase', fontFamily:'monospace' }}>
        {slide.eyebrow}
      </div>
      <h3 style={{ fontSize: mobile ? 'clamp(22px,6vw,30px)' : 'clamp(20px,2.8vw,36px)', fontWeight:900, lineHeight:1.12, letterSpacing:'-0.5px', color:'#fff', marginBottom:'10px', textShadow:'0 2px 28px rgba(0,0,0,.7)' }}>
        {slide.headline}
      </h3>
      <p style={{ fontSize: mobile ? '14px' : 'clamp(13px,1.2vw,15px)', color:'rgba(255,255,255,.7)', lineHeight:1.65, textShadow:'0 1px 12px rgba(0,0,0,.6)', marginBottom: slide.isFinal ? '20px' : 0 }}>
        {slide.description}
      </p>
      {slide.isFinal && (
        <button className="gbtn" style={{ width: mobile ? '100%' : undefined, fontSize:'14px', padding:'11px 28px' }} onClick={onTrial} aria-label="Start free trial">
          Start Free Trial
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DESKTOP SECTION
   ══════════════════════════════════════════════════════════════ */
function DesktopStory({ onTrial }: { onTrial: () => void }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const sentinelRefs = useRef<(HTMLDivElement|null)[]>(Array(N).fill(null));
  const coverRefs    = useRef<(HTMLDivElement|null)[]>(Array(N).fill(null));
  const mountedRef   = useRef(true);
  const activeRef    = useRef(0);
  const debounceRef  = useRef<ReturnType<typeof setTimeout>|null>(null);

  const [active,    setActive]    = useState(0);
  const [videoOp,   setVideoOp]   = useState<number[]>(() => { const a=Array(N).fill(0); a[0]=1; return a; });
  const [textOp,    setTextOp]    = useState<number[]>(() => { const a=Array(N).fill(0); a[0]=1; return a; });

  useEffect(() => { mountedRef.current=true; return () => { mountedRef.current=false; }; }, []);

  const goTo = useCallback((idx: number) => {
    if (!mountedRef.current) return;
    const prev = activeRef.current;
    if (prev === idx) return;
    activeRef.current = idx;
    setActive(idx);
    setVideoOp(o => { const n=[...o]; n[idx]=1; n[prev]=0; return n; });
    setTextOp(o  => { const n=[...o]; n[idx]=1; n[prev]=0; return n; });
  }, []);

  /* Sentinels */
  useEffect(() => {
    const obs: IntersectionObserver[] = [];
    SLIDES.forEach((_,i) => {
      const el = sentinelRefs.current[i];
      if (!el) return;
      const o = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => { if (mountedRef.current) goTo(i); }, 60);
        });
      }, { rootMargin:'-35% 0px -35% 0px', threshold:0 });
      o.observe(el); obs.push(o);
    });

    /* Scroll-idle snap */
    let t: ReturnType<typeof setTimeout>|null = null;
    const snap = () => {
      const mid = window.innerHeight/2;
      let best=activeRef.current, dist=Infinity;
      sentinelRefs.current.forEach((el,i) => {
        if (!el) return;
        const d = Math.abs(el.getBoundingClientRect().top + el.getBoundingClientRect().height/2 - mid);
        if (d<dist) { dist=d; best=i; }
      });
      if (mountedRef.current) goTo(best);
    };
    const onScroll = () => { if(t) clearTimeout(t); t=setTimeout(snap,150); };
    window.addEventListener('scroll', onScroll, { passive:true });

    return () => {
      obs.forEach(o=>o.disconnect());
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (t) clearTimeout(t);
      window.removeEventListener('scroll', onScroll);
    };
  }, [goTo]);

  const tag = `${String(active+1).padStart(2,'0')} / ${String(N).padStart(2,'0')}`;

  return (
    <>
      <div style={{ position:'sticky', top:0, height:'100vh', overflow:'hidden', background:'#0d0b15', zIndex:5 }}
        role="region" aria-label="Cinematic story">
        <div aria-hidden="true" style={{ position:'absolute', inset:0 }}>
          {SLIDES.map((slide,i) => (
            <div key={slide.id} style={{ position:'absolute', inset:0, opacity:videoOp[i], transition:reduced?'none':'opacity 550ms ease', overflow:'hidden', background:'#0d0b15' }}>
              <iframe src={eUrl(slide.bunnyId)} title={`Slide ${slide.id}`}
                allow="autoplay; encrypted-media; picture-in-picture"
                loading={i===0?'eager':'lazy'} aria-hidden="true" tabIndex={-1}
                onLoad={() => { const c=coverRefs.current[i]; if(c) c.style.opacity='0'; }}
                style={{ position:'absolute', top:'-2px', left:'-2px', width:'calc(100% + 4px)', height:'calc(100% + 4px)', border:0, pointerEvents:'none', display:'block' }}
              />
              <div ref={el=>{coverRefs.current[i]=el;}} aria-hidden="true"
                style={{ position:'absolute', inset:0, zIndex:3, background:'#0d0b15', transition:'opacity 400ms ease', pointerEvents:'none' }} />
            </div>
          ))}
        </div>
        {SLIDES.map((slide,i) => <Overlay key={slide.id} slide={slide} opacity={textOp[i]} onTrial={onTrial} />)}
        <div className="font-mono" style={{ position:'absolute', top:'28px', left:'32px', zIndex:20, fontSize:'11px', fontWeight:800, letterSpacing:'0.12em', color:'rgba(255,255,255,.35)' }} aria-live="polite">{tag}</div>
        <div style={{ position:'absolute', bottom:'24px', right:'28px', display:'flex', gap:'6px', zIndex:20, alignItems:'center' }}>
          {SLIDES.map((_,i) => (
            <div key={i} style={{ height:'5px', borderRadius:'999px', width:i===active?'20px':'5px', background:i===active?'var(--g1)':'rgba(255,255,255,.22)', transition:reduced?'none':'width 300ms ease' }} />
          ))}
        </div>
      </div>
      {/* Scroll track */}
      <div aria-hidden="true" style={{ background:'#0d0b15' }}>
        {SLIDES.map((slide,i) => (
          <div key={slide.id} ref={el=>{sentinelRefs.current[i]=el;}} style={{ height:'110vh' }} />
        ))}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   MOBILE SECTION — simple full-height slides, natural scroll
   No sticky. No IntersectionObserver. No shared scroll events.
   Each slide is 100svh. Video fills screen. Text at bottom.
   User scrolls naturally through all 10 slides.
   ══════════════════════════════════════════════════════════════ */
function MobileStory({ onTrial }: { onTrial: () => void }) {
  return (
    <div>
      {SLIDES.map(slide => (
        <div key={slide.id} style={{
          position: 'relative',
          width: '100%',
          height: '100svh',
          overflow: 'hidden',
          background: '#0d0b15',
        }}>
          {/* 9:16 vertical video — fills screen */}
          <iframe
            src={eUrl(slide.mobileBunnyId)}
            title={`Slide ${slide.id}: ${slide.headline}`}
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
              display: 'block',
            }}
          />

          {/* Gradient behind text */}
          <div aria-hidden="true" style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.35) 50%, transparent 75%)',
            zIndex: 1, pointerEvents: 'none',
          }} />

          {/* Slide counter */}
          <div style={{
            position: 'absolute', top: '20px', left: '20px', zIndex: 3,
            fontSize: '10px', fontWeight: 800, letterSpacing: '0.15em',
            color: 'rgba(255,255,255,.5)', fontFamily: 'monospace',
          }}>
            {String(slide.id).padStart(2,'0')} / {String(N).padStart(2,'0')}
          </div>

          {/* Text overlay */}
          <div style={{
            position: 'absolute',
            bottom: 'max(40px, env(safe-area-inset-bottom, 28px))',
            left: '24px', right: '24px',
            zIndex: 2,
          }}>
            <div style={{
              fontSize: '9px', fontWeight: 800, letterSpacing: '0.15em',
              color: 'rgba(255,255,255,.55)', marginBottom: '8px',
              textTransform: 'uppercase', fontFamily: 'monospace',
            }}>
              {slide.eyebrow}
            </div>
            <h3 style={{
              fontSize: 'clamp(22px, 6vw, 28px)', fontWeight: 900,
              color: '#fff', lineHeight: 1.12, letterSpacing: '-0.5px',
              marginBottom: '10px', textShadow: '0 2px 20px rgba(0,0,0,.8)',
            }}>
              {slide.headline}
            </h3>
            <p style={{
              fontSize: '14px', color: 'rgba(255,255,255,.75)',
              lineHeight: 1.6, textShadow: '0 1px 10px rgba(0,0,0,.7)',
              marginBottom: slide.isFinal ? '20px' : 0,
            }}>
              {slide.description}
            </p>
            {slide.isFinal && (
              <button className="gbtn"
                style={{ width: '100%', fontSize: '15px', padding: '14px' }}
                onClick={onTrial} aria-label="Start free trial">
                Start Free Trial
              </button>
            )}
          </div>

          {/* Scroll hint — small down arrow on slides 1–9 */}
          {slide.id < N && (
            <div aria-hidden="true" style={{
              position: 'absolute', bottom: '12px', left: '50%',
              transform: 'translateX(-50%)', zIndex: 3,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: '4px', height: '4px', borderRadius: '50%',
                  background: `rgba(255,255,255,${0.6 - i * 0.18})`,
                }} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════════ */
export default function ScrollStory() {
  const navigate   = useNavigate();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width:767px)');
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const handleTrial = useCallback(() => {
    track('checkout_started');
    navigate('/checkout');
  }, [navigate]);

  const intro = (
    <div className="py-14 text-center px-6" style={{ background:'#0d0b15' }}>
      <div className="eyebrow mb-4" style={{ color:'rgba(255,255,255,.45)', borderColor:'rgba(255,255,255,.15)', background:'rgba(255,255,255,.06)' }}>
        A story every learner recognises
      </div>
      <h2 className="font-black text-white" style={{ fontSize:'clamp(24px,3.5vw,38px)', letterSpacing:'-0.8px' }}>
        One question changed everything.
      </h2>
    </div>
  );

  return (
    <section style={{ position:'relative', background:'#0d0b15' }}>
      {intro}
      {isMobile
        ? <MobileStory  onTrial={handleTrial} />
        : <DesktopStory onTrial={handleTrial} />
      }
    </section>
  );
}

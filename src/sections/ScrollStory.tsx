/**
 * ScrollStory.tsx — crash-safe version
 *
 * ROOT CAUSE OF PREVIOUS CRASH:
 * ScrollStory conditionally rendered two completely different DOM trees
 * based on isMobile state.  When isMobile flipped during orientation
 * change, React unmounted the desktop branch (removing outerRef's div
 * from the DOM).  GSAP's ScrollTrigger with pin:true holds an internal
 * reference to that trigger element and has its own scroll/resize
 * observers.  On iOS Safari, the orientation-change resize fires while
 * GSAP is mid-cleanup — GSAP tries to call getBoundingClientRect() on
 * the already-detached node → TypeError → Error Boundary.
 *
 * FIX:
 * Always render ONE DOM structure.  The canvas, outerRef div, and
 * ScrollTrigger trigger element are always present in the DOM.
 * Mobile content is shown via CSS (display:none / display:block).
 * GSAP always has a live DOM node to clean up against.
 */
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const SCENES = [
  { bg0:'#1A1230', bg1:'#120C24', tag:'01 / 07', h:'One question. No one available.',    p:'Late in the evening, a learner hits a wall.' },
  { bg0:'#14202E', bg1:'#0E1424', tag:'02 / 07', h:"Tries again. Still doesn't click.", p:'Sometimes more practice is not the answer.' },
  { bg0:'#1A143A', bg1:'#10082E', tag:'03 / 07', h:'They open Studdy.',                  p:'They need it explained a different way.' },
  { bg0:'#101830', bg1:'#0A1020', tag:'04 / 07', h:'The whiteboard begins.',              p:'Visually. Patiently. Step by step.' },
  { bg0:'#14182C', bg1:'#0E1020', tag:'05 / 07', h:'A follow-up question.',              p:'Without feeling embarrassed to ask again.' },
  { bg0:'#101C28', bg1:'#0A1218', tag:'06 / 07', h:'The concept clicks.',                p:'Finally. Completely. Theirs.' },
  { bg0:'#0C1820', bg1:'#080E14', tag:'07 / 07', h:'The task is done.',                  p:'Less frustration. More confidence.' },
];

const N = SCENES.length;
const FADE = 0.15;

function parseHex(h: string) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function lerpColor(a: string, b: string, t: number) {
  const pa = parseHex(a), pb = parseHex(b);
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',')})`;
}

function getSceneOpacities(p: number): number[] {
  const opacities = new Array(N).fill(0);
  const segmentSize = 1 / N;
  for (let i = 0; i < N; i++) {
    const start   = i * segmentSize;
    const end     = start + segmentSize;
    const fadeIn  = start + segmentSize * FADE;
    const fadeOut = end   - segmentSize * FADE;
    let opacity = 0;
    if      (p < start)   opacity = 0;
    else if (p < fadeIn)  opacity = clamp((p - start) / (fadeIn - start), 0, 1);
    else if (p < fadeOut) opacity = 1;
    else if (p <= end)    opacity = i === N - 1 ? 1 : clamp(1 - (p - fadeOut) / (end - fadeOut), 0, 1);
    else                  opacity = i === N - 1 ? 1 : 0;
    opacities[i] = opacity;
  }
  return opacities;
}

function getDominantScene(p: number) {
  const raw = clamp(p * N, 0, N - 0.001);
  const sceneIdx = Math.min(N - 1, Math.floor(raw));
  return { sceneIdx, scenePct: raw - sceneIdx };
}

export default function ScrollStory() {
  const outerRef  = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dominantScene, setDominantScene] = useState(0);
  const [textOpacities, setTextOpacities] = useState(() => getSceneOpacities(0));
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  /* Track isMobile — used only to hide/show content, not to gate GSAP */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  /*
   * GSAP/ScrollTrigger setup — runs ONCE on mount, cleans up on unmount.
   * It does NOT re-run when isMobile changes, so there is no DOM-swap race.
   * The canvas and outerRef div are always rendered, making cleanup safe.
   */
  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    /* resize reads ref at call time — no stale closure */
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const drawBackground = (p: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { sceneIdx, scenePct } = getDominantScene(p);
      const sc = SCENES[sceneIdx];
      const nx = SCENES[Math.min(sceneIdx + 1, N - 1)];

      const g = ctx.createRadialGradient(
        canvas.width * .55, canvas.height * .4, 0,
        canvas.width * .55, canvas.height * .4, canvas.width * .9
      );
      g.addColorStop(0, lerpColor(sc.bg0, nx.bg0, scenePct));
      g.addColorStop(1, lerpColor(sc.bg1, nx.bg1, scenePct));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (sceneIdx >= 2 && sceneIdx <= 4) {
        const a = sceneIdx === 2 ? scenePct * 0.05
                : sceneIdx === 4 ? (1 - scenePct) * 0.05
                : 0.05;
        ctx.strokeStyle = `rgba(140,121,224,${a})`;
        ctx.lineWidth = 1;
        for (let y = 44; y < canvas.height; y += 44) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
      }
    };

    drawBackground(0);
    setTextOpacities(getSceneOpacities(0));

    const st = ScrollTrigger.create({
      trigger: outer,
      start: 'top top',
      end: '+=850vh',
      pin: true,
      pinSpacing: true,
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: self => {
        const p = clamp(self.progress, 0, 1);
        drawBackground(p);
        const ops = getSceneOpacities(p);
        setTextOpacities(ops);
        let dom = 0;
        ops.forEach((o, i) => { if (o > ops[dom]) dom = i; });
        setDominantScene(dom);
      },
      onLeave: () => {
        drawBackground(1);
        const ops = getSceneOpacities(1);
        setTextOpacities(ops);
        setDominantScene(N - 1);
      },
    });

    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      st.kill();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []); // ← empty deps: runs once, never re-runs on isMobile change

  /* ── Intro header — always visible ── */
  const intro = (
    <div className="py-14 text-center px-6" style={{ background:'#15131F' }}>
      <div className="eyebrow mb-4" style={{ color:'rgba(255,255,255,.45)', borderColor:'rgba(255,255,255,.15)', background:'rgba(255,255,255,.06)' }}>
        A story every learner recognises
      </div>
      <h2 className="font-black text-white" style={{ fontSize:'clamp(24px,3.5vw,38px)', letterSpacing:'-0.8px' }}>
        One question changed everything.
      </h2>
    </div>
  );

  return (
    <div>
      {intro}

      {/* ── MOBILE vertical scenes — shown via CSS only on small screens ── */}
      <div style={{ display: isMobile ? 'block' : 'none' }} aria-hidden={!isMobile}>
        {SCENES.map((sc, i) => (
          <div key={i} className="relative py-16 px-6 text-center" style={{ background: sc.bg0 }}>
            <div className="text-[10px] font-black tracking-widest mb-3 font-mono" style={{ color:'rgba(255,255,255,.3)' }}>{sc.tag}</div>
            <h3 className="font-black text-white mb-2" style={{ fontSize:'clamp(19px,4vw,26px)', letterSpacing:'-0.5px' }}>{sc.h}</h3>
            <p className="text-[14px] italic leading-relaxed" style={{ color:'rgba(255,255,255,.5)' }}>{sc.p}</p>
            {i < N - 1 && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-6" style={{ background:'rgba(255,255,255,.1)' }} />}
          </div>
        ))}
      </div>

      {/*
       * ── DESKTOP pinned stage — ALWAYS in the DOM ──
       * Hidden on mobile via CSS (display:none), but still present so
       * GSAP always has a live DOM node.  st.kill() never races with
       * React unmounting the trigger element.
       */}
      <div style={{ display: isMobile ? 'none' : 'block' }} aria-hidden={isMobile}>
        <div
          ref={outerRef}
          style={{ height:'100vh', overflow:'hidden', position:'relative' }}
          role="region"
          aria-label="Cinematic story"
        >
          <canvas
            ref={canvasRef}
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', display:'block' }}
            aria-hidden="true"
          />

          {/* Scene text layers */}
          <div className="absolute inset-0 pointer-events-none z-10" style={{ padding:'0 10vw 10vh 10vw', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
            {SCENES.map((sc, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  bottom:'10vh', left:'10vw', right:'10vw',
                  opacity: textOpacities[i],
                  transform: `translateY(${(1 - textOpacities[i]) * 12}px)`,
                  transition: 'none',
                  maxWidth:'600px',
                }}
                aria-hidden={textOpacities[i] < 0.1}
              >
                <div className="font-black text-white leading-tight mb-3"
                  style={{ fontSize:'clamp(22px,3.2vw,38px)', letterSpacing:'-0.5px', textShadow:'0 2px 24px rgba(0,0,0,.5)' }}>
                  {sc.h}
                </div>
                <p className="italic leading-relaxed"
                  style={{ fontSize:'15px', color:'rgba(255,255,255,.55)', textShadow:'0 1px 12px rgba(0,0,0,.5)' }}>
                  {sc.p}
                </p>
              </div>
            ))}
          </div>

          {/* Scene tag */}
          <div className="absolute top-8 left-10 z-20 font-mono text-[11px] font-black"
            style={{ color:'rgba(255,255,255,.3)', letterSpacing:'.1em' }} aria-hidden="true">
            {SCENES[dominantScene].tag}
          </div>

          {/* Progress dots */}
          <div className="absolute bottom-8 right-8 flex gap-2 z-20"
            role="status" aria-label={`Story: scene ${dominantScene + 1} of ${N}`}>
            {SCENES.map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-400"
                style={{ height:'6px', width: i === dominantScene ? '22px' : '6px',
                  background: i === dominantScene ? 'var(--g1)' : 'rgba(255,255,255,.2)' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

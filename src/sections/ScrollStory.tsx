import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const SCENES = [
  { bg0:'#1A1230', bg1:'#120C24', tag:'01 / 07', h:'One question. No one available.', p:'Late in the evening, a learner hits a wall.' },
  { bg0:'#14202E', bg1:'#0E1424', tag:'02 / 07', h:'Tries again. Still doesn\'t click.', p:'Sometimes more practice is not the answer.' },
  { bg0:'#1A143A', bg1:'#10082E', tag:'03 / 07', h:'They open Studdy.', p:'They need it explained a different way.' },
  { bg0:'#101830', bg1:'#0A1020', tag:'04 / 07', h:'The whiteboard begins.', p:'Visually. Patiently. Step by step.' },
  { bg0:'#14182C', bg1:'#0E1020', tag:'05 / 07', h:'A follow-up question.', p:'Without feeling embarrassed to ask again.' },
  { bg0:'#101C28', bg1:'#0A1218', tag:'06 / 07', h:'The concept clicks.', p:'Finally. Completely. Theirs.' },
  { bg0:'#0C1820', bg1:'#080E14', tag:'07 / 07', h:'The task is done.', p:'Less frustration. More confidence.' },
];

function parseHex(h: string) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}
function lerp(a: number, b: number, t: number) { return a + (b-a) * t; }
function lerpColor(a: string, b: string, t: number) {
  const pa = parseHex(a), pb = parseHex(b);
  return `rgb(${pa.map((v,i) => Math.round(lerp(v,pb[i],t))).join(',')})`;
}

export default function ScrollStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (isMobile || !containerRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    function draw(sceneIdx: number, progress: number) {
      const sc = SCENES[sceneIdx];
      const nx = SCENES[Math.min(sceneIdx+1, SCENES.length-1)];
      const t = progress;
      const grad = ctx.createRadialGradient(canvas.width*.6, canvas.height*.4, 0, canvas.width*.6, canvas.height*.4, canvas.width*.9);
      grad.addColorStop(0, lerpColor(sc.bg0, nx.bg0, t));
      grad.addColorStop(1, lerpColor(sc.bg1, nx.bg1, t));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Whiteboard lines appear in scene 3-4
      if (sceneIdx >= 2 && sceneIdx <= 4) {
        const alpha = sceneIdx === 2 ? progress * 0.06 : sceneIdx === 4 ? (1-progress) * 0.06 : 0.06;
        ctx.strokeStyle = `rgba(140,121,224,${alpha})`;
        ctx.lineWidth = 1;
        for (let y = 44; y < canvas.height; y += 44) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
      }

      // Scene counter
      ctx.font = '800 11px monospace';
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillText(sc.tag, 28, 40);
    }

    const SCROLL_HEIGHT = 700;
    const st = ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: `+=${SCROLL_HEIGHT}vh`,
      pin: true,
      onUpdate: self => {
        const p = self.progress;
        const sceneIdx = Math.min(SCENES.length-1, Math.floor(p * SCENES.length));
        const sceneProgress = (p * SCENES.length) % 1;
        draw(sceneIdx, sceneProgress);
        setScene(sceneIdx);
      },
    });

    draw(0, 0);
    return () => { st.kill(); window.removeEventListener('resize', resize); };
  }, [isMobile]);

  // Mobile fallback — vertical sections
  if (isMobile) {
    return (
      <div>
        <div className="py-12 text-center px-6" style={{ background: '#15131F' }}>
          <div className="eyebrow mb-4" style={{ color: 'rgba(255,255,255,.45)', borderColor: 'rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)' }}>A story every learner recognises</div>
          <h2 className="font-black text-white" style={{ fontSize: 'clamp(22px,5vw,34px)', letterSpacing: '-0.8px' }}>One question changed everything.</h2>
        </div>
        {SCENES.map((sc, i) => (
          <div key={i} className="relative py-16 px-6 text-center" style={{ background: sc.bg0 }}>
            <div className="text-[11px] font-black tracking-widest mb-3 font-mono" style={{ color: 'rgba(255,255,255,.35)' }}>{sc.tag}</div>
            <h3 className="font-black text-white mb-2" style={{ fontSize: 'clamp(20px,4vw,28px)', letterSpacing: '-0.5px' }}>{sc.h}</h3>
            <p className="text-[14px] italic" style={{ color: 'rgba(255,255,255,.5)' }}>{sc.p}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Intro */}
      <div className="py-16 text-center px-6" style={{ background: '#15131F' }}>
        <div className="eyebrow mb-4" style={{ color: 'rgba(255,255,255,.45)', borderColor: 'rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)' }}>A story every learner recognises</div>
        <h2 className="font-black text-white" style={{ fontSize: 'clamp(24px,3.5vw,38px)', letterSpacing: '-0.8px' }}>One question changed everything.</h2>
      </div>

      {/* Pinned scroll container */}
      <div ref={containerRef} style={{ height: '700vh' }}>
        <div className="sticky top-0 h-screen overflow-hidden">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {/* Scene text */}
          <div className="absolute inset-0 flex items-end pb-16 px-10 pointer-events-none z-10">
            <div className="max-w-[600px]">
              <div className="font-black text-white mb-3 leading-tight" style={{ fontSize: 'clamp(24px,3.5vw,40px)', letterSpacing: '-0.5px' }}>
                {SCENES[scene].h}
              </div>
              <p className="text-[15px] italic leading-relaxed" style={{ color: 'rgba(255,255,255,.5)' }}>
                {SCENES[scene].p}
              </p>
            </div>
          </div>

          {/* Progress dots */}
          <div className="absolute bottom-8 right-8 flex gap-2 z-20" aria-hidden="true">
            {SCENES.map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-300"
                style={{ width: i === scene ? '20px' : '6px', height: '6px', background: i === scene ? 'var(--g1)' : 'rgba(255,255,255,.2)' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

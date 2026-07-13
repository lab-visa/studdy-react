import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const scenes = [
  { bg: ['#1E1432', '#140E24'], text: '"One question. No one available to explain it."', tag: 'Scene 01 / 07', h: 'A learner is stuck late in the evening.' },
  { bg: ['#14202E', '#0E1624'], text: '"Sometimes more practice is not the answer."', tag: 'Scene 02 / 07', h: 'They try again and still don\'t understand.' },
  { bg: ['#1A1430', '#130E26'], text: '"They need it explained differently."', tag: 'Scene 03 / 07', h: 'They open Studdy.' },
  { bg: ['#141830', '#0E1226'], text: '"Visually. Patiently. Step by step."', tag: 'Scene 04 / 07', h: 'The whiteboard begins teaching.' },
  { bg: ['#14182A', '#0E1220'], text: '"Without feeling embarrassed to ask again."', tag: 'Scene 05 / 07', h: 'The learner asks a follow-up.' },
  { bg: ['#101828', '#0A1020'], text: '"Until it finally clicks."', tag: 'Scene 06 / 07', h: 'The concept becomes clear.' },
  { bg: ['#0A1420', '#060E18'], text: '"Less frustration. More confidence."', tag: 'Scene 07 / 07', h: 'The task is completed.' },
];

export default function ScrollStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeScene, setActiveScene] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !stickyRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
    function lerpColor(a: string, b: string, t: number) {
      const r1 = parseInt(a.slice(1,3),16), g1=parseInt(a.slice(3,5),16), b1=parseInt(a.slice(5,7),16);
      const r2 = parseInt(b.slice(1,3),16), g2=parseInt(b.slice(3,5),16), b2=parseInt(b.slice(5,7),16);
      return `rgb(${Math.round(lerp(r1,r2,t))},${Math.round(lerp(g1,g2,t))},${Math.round(lerp(b1,b2,t))})`;
    }

    function drawScene(sceneIdx: number, progress: number) {
      const sc = scenes[sceneIdx];
      const next = scenes[Math.min(sceneIdx + 1, scenes.length - 1)];
      const t = progress;
      const grad = ctx.createRadialGradient(canvas.width*.6, canvas.height*.4, 0, canvas.width*.6, canvas.height*.4, canvas.width*.9);
      grad.addColorStop(0, lerpColor(sc.bg[0], next.bg[0], t));
      grad.addColorStop(1, lerpColor(sc.bg[1], next.bg[1], t));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw whiteboard lines on scene 3-4
      if (sceneIdx >= 2 && sceneIdx <= 3) {
        ctx.strokeStyle = `rgba(140,121,224,${0.08 * (1-t)})`;
        ctx.lineWidth = 1;
        for (let y = 0; y < canvas.height; y += 40) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
      }
    }

    const st = ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        const p = self.progress;
        const total = scenes.length;
        const sceneIdx = Math.min(total - 1, Math.floor(p * total));
        const sceneProgress = (p * total) % 1;
        drawScene(sceneIdx, sceneProgress);
        setActiveScene(sceneIdx);
      },
    });

    drawScene(0, 0);
    return () => { st.kill(); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div className="relative">
      {/* Intro text */}
      <div className="py-16 text-center px-6" style={{ background: '#15131F' }}>
        <div className="eyebrow mb-4" style={{ color: 'rgba(255,255,255,.45)', borderColor: 'rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)' }}>
          Cinematic story
        </div>
        <h2 className="font-black text-white" style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', letterSpacing: '-0.8px' }}>
          A story every learner recognises.
        </h2>
      </div>

      {/* Scroll container */}
      <div ref={containerRef} style={{ height: `${scenes.length * 100}vh` }}>
        <div ref={stickyRef} className="sticky top-0 h-screen overflow-hidden">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {/* Scene overlay */}
          <div className="absolute inset-0 flex items-end pb-12 px-8 pointer-events-none z-10">
            <div>
              <div className="text-[11px] font-black tracking-[.12em] uppercase mb-3 font-mono" style={{ color: 'rgba(255,255,255,.35)' }}>
                {scenes[activeScene].tag}
              </div>
              <h3
                className="font-black text-white mb-2 leading-tight"
                style={{ fontSize: 'clamp(22px, 3.5vw, 38px)', letterSpacing: '-0.5px', maxWidth: '600px' }}
              >
                {scenes[activeScene].h}
              </h3>
              <p className="text-[15px] leading-relaxed italic" style={{ color: 'rgba(255,255,255,.5)', maxWidth: '540px' }}>
                {scenes[activeScene].text}
              </p>
            </div>
          </div>

          {/* Progress dots */}
          <div className="absolute bottom-8 right-8 flex gap-2 z-20">
            {scenes.map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                style={{ background: i === activeScene ? '#fff' : 'rgba(255,255,255,.2)', transform: i === activeScene ? 'scale(1.5)' : 'scale(1)' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One-off confetti burst (skipped for reduced-motion users). */
import { useEffect, useRef } from 'react';

export default function Confetti() {
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

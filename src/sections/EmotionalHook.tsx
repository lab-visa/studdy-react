import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const LINES = [
  { text: 'School teaches the class.', grad: false },
  { text: 'Tuition teaches the subject.', grad: false },
  { text: 'Studdy teaches you.', grad: true },
];

export default function EmotionalHook() {
  const sectionRef = useRef<HTMLElement>(null);
  const linesRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      // Simulate handwriting reveal with staggered clip-path wipe
      linesRef.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, y: 20, clipPath: 'inset(0 100% 0 0)' },
          {
            opacity: 1, y: 0, clipPath: 'inset(0 0% 0 0)',
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 65%',
              once: true,
            },
            delay: i * 0.35,
          }
        );
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-20 text-center px-6"
      style={{ background: '#15131F' }}
    >
      {/* Whiteboard lines on dark bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px)',
          backgroundSize: '100% 44px',
          backgroundPosition: '0 22px',
        }}
      />
      {/* Subtle glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(140,121,224,.12), transparent 70%)' }}
      />

      <div className="relative z-10">
        {LINES.map((l, i) => (
          <span
            key={i}
            ref={el => { linesRef.current[i] = el; }}
            className={`block font-black leading-snug ${l.grad ? 'grad-text' : 'text-white'}`}
            style={{ fontSize: 'clamp(22px, 4vw, 48px)', letterSpacing: '-0.5px', marginBottom: '0.2em' }}
          >
            {l.text}
          </span>
        ))}
      </div>
    </section>
  );
}

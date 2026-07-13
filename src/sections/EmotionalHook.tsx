import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

export default function EmotionalHook() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const lines = ref.current.querySelectorAll('.hook-line');
    gsap.from(lines, {
      opacity: 0, y: 24,
      duration: 0.8, stagger: 0.25, ease: 'power3.out',
      scrollTrigger: { trigger: ref.current, start: 'top 70%' },
    });
  }, []);

  return (
    <section
      className="relative overflow-hidden py-28 text-center"
      style={{ background: '#15131F' }}
    >
      {/* glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(140,121,224,.15), transparent 70%)' }} />

      <div ref={ref} className="relative z-10 px-6">
        {[
          'School teaches the class.',
          'Tuition teaches the subject.',
          null, // spacer for the gradient line
        ].map((line, i) =>
          line ? (
            <div
              key={i}
              className="hook-line block font-black leading-snug"
              style={{ fontSize: 'clamp(22px, 4vw, 46px)', color: '#fff', marginBottom: '0.3em', letterSpacing: '-0.5px' }}
            >
              {line}
            </div>
          ) : null
        )}
        <div
          className="hook-line block font-black leading-snug grad-text"
          style={{ fontSize: 'clamp(22px, 4vw, 46px)', marginBottom: '0.3em', letterSpacing: '-0.5px' }}
        >
          Studdy Lab teaches the learner.
        </div>
      </div>
    </section>
  );
}

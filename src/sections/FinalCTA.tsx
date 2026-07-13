import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useNavigate } from 'react-router-dom';
import { SUPPORT_WHATSAPP } from '../data/config';
import { track } from '../utils/analytics';
gsap.registerPlugin(ScrollTrigger);

export default function FinalCTA() {
  const boardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!boardRef.current) return;
    const ctx = gsap.context(() => {
      const lines = boardRef.current!.querySelectorAll('.cta-line');
      gsap.fromTo(lines,
        { opacity: 0, y: 12, clipPath: 'inset(0 100% 0 0)' },
        {
          opacity: 1, y: 0, clipPath: 'inset(0 0% 0 0)',
          duration: 0.85, stagger: 0.3, ease: 'power3.out',
          scrollTrigger: { trigger: boardRef.current, start: 'top 70%', once: true },
        }
      );
    }, boardRef);
    return () => ctx.revert();
  }, []);

  return (
    <section className="py-28 px-6" style={{ background: 'var(--dim)', borderTop: '1px solid var(--border)' }}>
      <div className="max-w-[820px] mx-auto text-center">
        {/* Whiteboard returns */}
        <div
          ref={boardRef}
          className="relative rounded-3xl px-8 py-10 mb-10 overflow-hidden"
          style={{ background: '#fff', border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(140,121,224,.1)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'var(--grad)' }} />
          {/* Whiteboard lines */}
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
            style={{ backgroundImage: 'linear-gradient(rgba(140,121,224,.05) 1px, transparent 1px)', backgroundSize: '100% 40px', backgroundPosition: '0 22px' }}
          />
          <div className="relative z-10">
            <div className="text-[11px] font-black uppercase tracking-widest mb-4" style={{ color: 'var(--soft)', letterSpacing: '.14em' }}>✏️ One question</div>
            {[
              'One question could change',
              'how you learn, work,',
              'or solve problems.',
            ].map((line, i) => (
              <span
                key={i}
                className="cta-line block font-black leading-tight"
                style={{ fontSize: 'clamp(24px, 4vw, 42px)', letterSpacing: '-1px', color: i === 2 ? 'var(--g1)' : 'var(--ink)' }}
              >
                {line}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            className="gbtn text-[16px] px-9 py-4"
            onClick={() => { track('checkout_started'); navigate('/checkout'); }}
          >
            Start Free Trial
          </button>
          <a
            href={SUPPORT_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="gost text-[15px] px-7 py-4"
            onClick={() => track('whatsapp_support_click')}
          >
            💬 Talk to us on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

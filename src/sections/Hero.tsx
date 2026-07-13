import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { track } from '../utils/analytics';

const floatingLabels = [
  { text: 'School subjects', icon: '📚', delay: 0 },
  { text: 'Coding & engineering', icon: '💻', delay: 0.3 },
  { text: 'Homework & exam help', icon: '🎯', delay: 0.6 },
  { text: 'Excel & work tasks', icon: '📊', delay: 0.9 },
  { text: 'Visual explanations', icon: '✏️', delay: 1.2 },
  { text: 'Available 24/7', icon: '⚡', delay: 1.5 },
];

const writeLines = [
  { text: 'Let\'s understand fractions.', delay: 0.3, cls: 'text-[var(--ink)] font-semibold text-[17px]' },
  { text: 'Split a whole into equal parts.', delay: 1.0, cls: 'text-[var(--soft)] text-[15px] pl-4 border-l-[3px] border-[var(--g3)]' },
  { text: '1 part out of 4 = 1/4', delay: 1.7, cls: 'text-[var(--soft)] text-[15px] pl-4 border-l-[3px] border-[var(--g3)]' },
  { text: 'Answer: one-quarter ✓', delay: 2.4, cls: 'text-[var(--g1)] font-black text-[18px]' },
  { text: 'Want to try one yourself?', delay: 3.1, cls: 'text-[var(--g4)] text-[14px] font-bold' },
];

export default function Hero() {
  const copyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!copyRef.current) return;
    gsap.from(copyRef.current.children, {
      opacity: 0, y: 30, duration: 0.8, stagger: 0.12, ease: 'power3.out', delay: 0.2,
    });
  }, []);

  return (
    <section
      className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse 75% 55% at 65% 0%, rgba(140,121,224,.1), transparent 65%), radial-gradient(ellipse 55% 40% at 5% 80%, rgba(239,85,182,.07), transparent 60%), #fff',
      }}
    >
      {/* Whiteboard grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          opacity: 0.25,
        }}
      />

      <div className="max-w-[1200px] mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-14 items-center">

          {/* Left copy */}
          <div ref={copyRef}>
            <div className="eyebrow mb-6">
              <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: 'var(--grad)' }} />
              Your personal AI tutor, available 24/7
            </div>

            <h1
              className="font-black leading-[1.06] mb-5"
              style={{ fontSize: 'clamp(38px, 5.2vw, 62px)', letterSpacing: '-2px' }}
            >
              The tutor that explains it<br />
              <span className="grad-text">until it finally makes sense.</span>
            </h1>

            <p className="mb-8 leading-relaxed max-w-[500px]" style={{ fontSize: 'clamp(16px, 1.8vw, 19px)', color: 'var(--soft)' }}>
              Ask by voice, text or image. Learn through live visual explanations, step-by-step guidance and follow-up questions.
            </p>

            <div className="flex flex-wrap gap-3 mb-6">
              <button
                className="gbtn text-[15px]"
                onClick={() => { track('hero_demo_play'); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }}
              >
                Start Free Trial
              </button>
              <button
                className="gost text-[15px]"
                onClick={() => { track('full_demo_open'); document.getElementById('proof')?.scrollIntoView({ behavior: 'smooth' }); }}
              >
                ▶ Watch Full Demo
              </button>
            </div>

            <div className="flex flex-wrap gap-4">
              {['Voice conversations', 'Visual whiteboard', 'All subjects & work tasks', 'Available 24/7'].map(t => (
                <span key={t} className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: 'var(--soft)' }}>
                  <span style={{ color: 'var(--g3)' }}>✓</span> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right - Living Whiteboard */}
          <div className="relative">
            {/* Glow */}
            <div
              className="absolute -inset-10 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, rgba(239,85,182,.14), rgba(140,121,224,.1) 45%, rgba(37,168,244,.07) 70%, transparent)', filter: 'blur(30px)' }}
            />

            <div
              className="relative z-10 rounded-[32px] p-4"
              style={{ background: 'linear-gradient(135deg,#fdf4fb,#f0ecff,#eaf6ff)', boxShadow: '0 44px 90px -20px rgba(140,121,224,.32)' }}
            >
              {/* Whiteboard inner */}
              <div className="rounded-[22px] overflow-hidden bg-white relative" style={{ minHeight: '440px' }}>
                {/* Whiteboard lines */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ backgroundImage: 'linear-gradient(rgba(140,121,224,.06) 1px, transparent 1px)', backgroundSize: '100% 38px', backgroundPosition: '0 20px' }}
                />

                <div className="p-7 relative z-10 flex flex-col" style={{ minHeight: '440px' }}>
                  {/* Question chip */}
                  <div className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-bold mb-6 max-w-fit" style={{ background: 'var(--dim)', border: '1px solid var(--border)', color: 'var(--soft)' }}>
                    <span className="text-[18px]">🧒</span> Explain fractions to me
                  </div>

                  {/* Animated writing */}
                  <div className="flex-1 flex flex-col gap-3">
                    {writeLines.map((l, i) => (
                      <div
                        key={i}
                        className={`write-in ${l.cls}`}
                        style={{ animationDelay: `${l.delay}s` }}
                      >
                        {l.text}
                      </div>
                    ))}
                  </div>

                  {/* Alfrenzo avatar bar */}
                  <div className="flex items-center gap-3 mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-[14px]" style={{ background: 'var(--grad)' }}>A</div>
                    <div>
                      <div className="font-bold text-[13px]">Alfrenzo</div>
                      <div className="text-[11px]" style={{ color: 'var(--soft)' }}>Your AI tutor</div>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[14px]" style={{ background: 'var(--dim)' }}>💬</div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[14px]" style={{ background: 'var(--dim)' }}>🔊</div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] text-white" style={{ background: 'var(--g1)' }}>🎙️</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating use-case labels — desktop only */}
            <div className="hidden xl:flex flex-col gap-2.5 absolute -right-40 top-1/2 -translate-y-1/2 z-20">
              {floatingLabels.map((l, i) => (
                <div
                  key={l.text}
                  className="float-anim bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-[0_8px_30px_rgba(0,0,0,.1)] min-w-[185px]"
                  style={{ animationDelay: `${i * 0.4}s` }}
                >
                  <span className="text-[17px]">{l.icon}</span>
                  <span className="font-bold text-[13px]" style={{ color: 'var(--ink)' }}>{l.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

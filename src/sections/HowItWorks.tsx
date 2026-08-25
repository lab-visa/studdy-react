import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    id: 0,
    stage: 'Ask',
    stageLabel: 'Learner asks',
    content: '"Explain photosynthesis visually."',
    isQuestion: true,
    desc: 'Voice, text, image or document — any question, any format.',
  },
  {
    id: 1,
    stage: 'Understand',
    stageLabel: 'Studdy explains',
    content: 'Chlorophyll captures sunlight → CO₂ + water → glucose + oxygen. Let me draw this out...',
    isQuestion: false,
    desc: 'Studdy draws the concept step-by-step on a visual whiteboard with voice.',
  },
  {
    id: 2,
    stage: 'Follow up',
    stageLabel: 'Learner follows up',
    content: '"Why do plants specifically need sunlight?"',
    isQuestion: true,
    desc: 'Interrupt, clarify, go deeper — unlimited questions, no hesitation.',
  },
  {
    id: 3,
    stage: 'Practise',
    stageLabel: 'Studdy challenges',
    content: 'Which part of the plant captures light, and what does it produce?',
    isQuestion: false,
    desc: 'Attempt examples. Build genuine understanding, not just recall.',
  },
];

const N = STEPS.length;

export default function HowItWorks() {
  const sectionRef  = useRef<HTMLDivElement>(null);
  const tokenRef    = useRef<HTMLDivElement>(null);
  const lineRef     = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      // The connecting line grows
      if (lineRef.current) {
        gsap.fromTo(
          lineRef.current,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 60%',
              end: 'bottom 60%',
              scrub: 0.8,
            },
          }
        );
      }

      // Token slides along the line, activating each step
      const stepEls = sectionRef.current!.querySelectorAll<HTMLElement>('.hiw-step-card');

      if (tokenRef.current && stepEls.length === N) {
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top 55%',
          end: 'bottom 55%',
          scrub: 0.8,
          onUpdate: self => {
            const p = self.progress;
            const containerW = sectionRef.current!.querySelector<HTMLElement>('.hiw-track')?.offsetWidth ?? 1;
            /* Token centre tracks the line fill end exactly.
               Line goes from 0 to containerW.
               Token is 24px wide so offset by 12px to centre it on the fill end. */
            const x = p * containerW - 12;
            gsap.set(tokenRef.current, { x: Math.max(0, x) });

            const stepIdx = Math.min(N - 1, Math.floor(p * N));
            setActiveStep(stepIdx);

            // Fade cards
            stepEls.forEach((el, i) => {
              const isActive = i === stepIdx;
              gsap.to(el, {
                opacity: isActive ? 1 : 0.35,
                scale: isActive ? 1 : 0.97,
                duration: 0.3,
                ease: 'power2.out',
              });
            });
          },
        });
      }

      // Initial card entrance
      gsap.from(stepEls, {
        opacity: 0, y: 20, duration: 0.6, stagger: 0.12, ease: 'power2.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', once: true },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="hiw"
      ref={sectionRef}
      className="py-24 px-6"
      style={{ background: '#15131F' }}
    >
      <div className="max-w-[1100px] mx-auto">
        <div
          className="eyebrow mb-5"
          style={{ color:'rgba(255,255,255,.45)', borderColor:'rgba(255,255,255,.15)', background:'rgba(255,255,255,.06)' }}
        >
          How it works
        </div>
        <h2
          className="font-black text-white mb-4"
          style={{ fontSize:'clamp(26px,3.5vw,40px)', letterSpacing:'-0.8px' }}
        >
          From question to understanding.
        </h2>
        <p className="mb-12 text-[15px]" style={{ color:'rgba(255,255,255,.35)' }}>
          Follow one question — photosynthesis — through the complete journey.
        </p>

        {/* ── Desktop connected track ── */}
        <div className="hidden md:block">
          {/* Animated line + token */}
          <div className="hiw-track relative mb-12" style={{ height: '4px' }}>
            {/* Background rail */}
            <div className="absolute inset-0 rounded-full" style={{ background:'rgba(255,255,255,.07)' }} />
            {/* Growing fill */}
            <div
              ref={lineRef}
              className="absolute inset-0 rounded-full"
              style={{ background:'var(--grad)', transformOrigin:'left center', transform: "scaleX(0)" }}
            />
            {/* Glowing token */}
            <div
              ref={tokenRef}
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'var(--grad)',
                boxShadow: '0 0 0 4px rgba(239,85,182,.2), 0 0 16px rgba(239,85,182,.4)',
                border: '2px solid #fff',
                willChange: 'transform',
              }}
              aria-hidden="true"
            />
            {/* Step dots on the line */}
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all duration-300"
                style={{
                  left: `${(i / (N - 1)) * 100}%`,
                  width: '10px',
                  height: '10px',
                  background: i <= activeStep ? 'var(--g1)' : 'rgba(255,255,255,.2)',
                  zIndex: 1,
                }}
                aria-hidden="true"
              />
            ))}
          </div>

          {/* Step cards */}
          <div className="grid grid-cols-4 gap-5">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className="hiw-step-card"
                style={{ opacity: 0.35 }} // GSAP controls this
              >
                {/* Stage label */}
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: s.isQuestion ? 'rgba(239,85,182,.7)' : 'rgba(37,168,244,.7)' }}
                >
                  {s.stageLabel}
                </div>

                {/* Step title */}
                <h3 className="font-black text-white text-[17px] mb-3">{s.stage}</h3>

                {/* Prompt bubble */}
                <div
                  className="rounded-2xl px-4 py-3 mb-4 text-[13px] leading-relaxed"
                  style={{
                    background: s.isQuestion ? 'rgba(239,85,182,.08)' : 'rgba(37,168,244,.08)',
                    border: `1px solid ${s.isQuestion ? 'rgba(239,85,182,.18)' : 'rgba(37,168,244,.18)'}`,
                    color: '#fff',
                    fontStyle: s.isQuestion ? 'italic' : 'normal',
                  }}
                >
                  {s.content}
                </div>

                <p className="text-[13px] leading-relaxed" style={{ color:'rgba(255,255,255,.4)' }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mobile: vertical stacked ── */}
        <div className="md:hidden flex flex-col gap-6">
          {/* Vertical line — grows as user scrolls */}
          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-px"
              style={{ background:'rgba(255,255,255,.08)' }} aria-hidden="true" />
            <div
              className="absolute left-[19px] top-0 w-px origin-top"
              style={{ background:'var(--grad)', height:'100%', transform:'scaleY(0)' }}
              id="hiw-mobile-line"
              aria-hidden="true"
            />
            {STEPS.map((s, idx) => (
              <MobileStep key={s.id} s={s} idx={idx} lineId="hiw-mobile-line" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileStep({
  s, idx, lineId,
}: {
  s: typeof STEPS[0];
  idx: number;
  lineId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      /* Slide card in */
      gsap.from(ref.current, {
        opacity: 0, x: 16, duration: 0.6, ease: 'power2.out',
        scrollTrigger: { trigger: ref.current, start: 'top 82%', once: true },
      });
      /* Grow the gradient line proportionally as each step enters */
      const lineEl = document.getElementById(lineId);
      if (lineEl) {
        const fraction = (idx + 1) / STEPS.length;
        gsap.to(lineEl, {
          scaleY: fraction,
          ease: 'none',
          scrollTrigger: {
            trigger: ref.current,
            start: 'top 75%',
            end: 'bottom 60%',
            scrub: 0.6,
          },
        });
      }
    });
    return () => ctx.revert();
  }, [idx, lineId]);

  return (
    <div ref={ref} className="flex gap-4 pb-8 relative" style={{ paddingLeft: '0' }}>
      {/* Node */}
      <div
        className="flex-none w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-[13px] z-10"
        style={{ background:'var(--grad)', flexShrink:0 }}
      >
        {String(idx + 1).padStart(2, '0')}
      </div>

      <div className="flex-1">
        <div
          className="text-[10px] font-black uppercase tracking-widest mb-1"
          style={{ color: s.isQuestion ? 'rgba(239,85,182,.7)' : 'rgba(37,168,244,.7)' }}
        >
          {s.stageLabel}
        </div>
        <h3 className="font-black text-white text-[16px] mb-2">{s.stage}</h3>
        <div
          className="rounded-xl px-3 py-2.5 mb-3 text-[13px]"
          style={{
            background: s.isQuestion ? 'rgba(239,85,182,.08)' : 'rgba(37,168,244,.08)',
            border: `1px solid ${s.isQuestion ? 'rgba(239,85,182,.18)' : 'rgba(37,168,244,.18)'}`,
            color: '#fff',
            fontStyle: s.isQuestion ? 'italic' : 'normal',
          }}
        >
          {s.content}
        </div>
        <p className="text-[13px]" style={{ color:'rgba(255,255,255,.4)' }}>{s.desc}</p>
      </div>
    </div>
  );
}

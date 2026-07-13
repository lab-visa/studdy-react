import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  { n:'01', title:'Ask', desc:'Voice, text, image or document — any question, any format.', hint:'Explain how photosynthesis works' },
  { n:'02', title:'Understand', desc:'Studdy draws the answer step by step on a visual whiteboard with voice.', hint:'Chlorophyll absorbs light...' },
  { n:'03', title:'Follow up', desc:'Interrupt, clarify, go deeper — unlimited questions without hesitation.', hint:'What happens at night?' },
  { n:'04', title:'Practise', desc:'Attempt examples or challenges. Build genuine understanding, not recall.', hint:'Now you try: label this diagram.' },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      const cards = sectionRef.current!.querySelectorAll('.hiw-card');
      const prompt = sectionRef.current!.querySelector('.hiw-prompt');

      gsap.from(cards, {
        opacity: 0, x: -20,
        duration: 0.6, stagger: 0.15, ease: 'power2.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', once: true },
      });

      // Prompt travels right across the steps
      if (prompt) {
        gsap.to(prompt, {
          x: '100%',
          duration: 2, ease: 'power2.inOut',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 50%', once: true },
          delay: 0.5,
        });
      }
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="hiw" className="py-24 px-6" style={{ background: '#15131F' }} ref={sectionRef}>
      <div className="max-w-[1100px] mx-auto">
        <div className="eyebrow mb-5" style={{ color:'rgba(255,255,255,.45)', borderColor:'rgba(255,255,255,.15)', background:'rgba(255,255,255,.06)' }}>
          How it works
        </div>
        <h2 className="font-black text-white mb-14" style={{ fontSize:'clamp(26px,3.5vw,40px)', letterSpacing:'-0.8px' }}>
          From question to understanding.
        </h2>

        {/* Animated journey line */}
        <div className="relative mb-14 hidden md:block">
          <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background:'rgba(255,255,255,.08)' }} />
          <div className="hiw-prompt absolute top-1/2 left-0 -translate-y-1/2 -translate-x-full">
            <div className="bg-white rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap" style={{ color:'var(--ink)', boxShadow:'0 4px 16px rgba(239,85,182,.3)', border:'1.5px solid rgba(239,85,182,.4)' }}>
              Explain photosynthesis →
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-0">
          {STEPS.map((s, i) => (
            <div key={i} className="hiw-card relative pt-14 px-6">
              {/* Step number */}
              <div className="absolute top-0 left-6 w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-[13px]" style={{ background:'var(--grad)' }}>
                {s.n}
              </div>

              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-[22px] left-[68px] right-0 h-px" style={{ background:'rgba(255,255,255,.06)' }} />
              )}

              <h3 className="font-black text-white text-[18px] mb-2">{s.title}</h3>
              <p className="text-[14px] leading-relaxed mb-4" style={{ color:'rgba(255,255,255,.45)' }}>{s.desc}</p>
              <div className="text-[12px] italic px-3 py-2 rounded-xl" style={{ background:'rgba(255,255,255,.05)', color:'rgba(255,255,255,.35)' }}>
                "{s.hint}"
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

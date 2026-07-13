import { useState } from 'react';
import { subjects } from '../data/subjects';
import SectionHeading from '../components/SectionHeading';
import LazyVideo from '../components/LazyVideo';

export default function SubjectSelector() {
  const [active, setActive] = useState(subjects[0]);

  return (
    <section id="subjects" className="py-24 px-6 overflow-hidden">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading eyebrow="Use cases" heading="One tutor. Whatever you are trying to learn." />

        {/* Selector pills */}
        <div className="flex flex-wrap gap-2 mb-10">
          {subjects.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s)}
              className="px-5 py-2.5 rounded-full text-[14px] font-bold transition-all"
              style={{
                background: active.id === s.id ? 'var(--ink)' : '#fff',
                color: active.id === s.id ? '#fff' : 'var(--soft)',
                border: `1.5px solid ${active.id === s.id ? 'transparent' : 'var(--border)'}`,
              }}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Stage */}
        <div className="relative rounded-3xl overflow-hidden min-h-[400px] flex items-center p-12" style={{ background: 'var(--dim)' }}>
          {/* Big background word */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 font-black select-none pointer-events-none transition-all duration-500"
            style={{
              fontSize: 'clamp(80px, 14vw, 160px)',
              color: 'var(--ink)',
              opacity: 0.04,
              letterSpacing: '-0.04em',
              right: '-20px',
            }}
          >
            {active.word}
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center w-full relative z-10">
            <div>
              <div className="eyebrow mb-4" style={{ color: active.accent, borderColor: `${active.accent}40`, background: `${active.accent}15` }}>
                {active.icon} {active.label}
              </div>
              <h3 className="font-black leading-tight mb-4" style={{ fontSize: 'clamp(26px, 3vw, 38px)', letterSpacing: '-0.8px' }}>
                {active.question}
              </h3>
              <div className="flex flex-col gap-3 mb-8">
                {active.benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: 'var(--soft)' }}>
                    <span className="font-black" style={{ color: 'var(--g4)' }}>✓</span> {b}
                  </div>
                ))}
              </div>
              <button className="gbtn" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
                Try this for free →
              </button>
            </div>

            <LazyVideo
              label={`${active.icon} ${active.label} Preview`}
              meta={`Replace with real ${active.label} clip (20-30 sec)`}
              className="w-full min-h-[280px]"
              aspectRatio="4/3"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

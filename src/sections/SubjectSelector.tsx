import { useState } from 'react';
import { subjects } from '../data/subjects';
import SectionHeading from '../components/SectionHeading';
import LazyVideo, { VIDEO_SPECS } from '../components/LazyVideo';

export default function SubjectSelector() {
  const [active, setActive] = useState(subjects[0]);

  return (
    <section id="subjects" className="py-24 px-6 overflow-hidden">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading eyebrow="Use cases" heading="One tutor. Whatever you need to learn." />

        {/* Selector */}
        <div className="flex flex-wrap gap-2 mb-10">
          {subjects.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s)}
              aria-pressed={active.id === s.id}
              className="px-5 py-2.5 rounded-full text-[13.5px] font-bold transition-all duration-200"
              style={{
                background: active.id === s.id ? 'var(--ink)' : '#fff',
                color: active.id === s.id ? '#fff' : 'var(--soft)',
                border: `1.5px solid ${active.id === s.id ? 'transparent' : 'var(--border)'}`,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Stage */}
        <div
          className="relative rounded-3xl overflow-hidden"
          style={{ background: 'var(--dim)', border: '1.5px solid var(--border)', minHeight: '420px' }}
        >
          {/* Giant background word */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 font-black select-none pointer-events-none"
            aria-hidden="true"
            style={{
              fontSize: 'clamp(80px, 15vw, 160px)',
              color: active.accent,
              opacity: 0.06,
              letterSpacing: '-0.04em',
              right: '-10px',
              whiteSpace: 'nowrap',
              transition: 'color 0.4s, opacity 0.4s',
            }}
          >
            {active.word}
          </div>

          <div className="relative z-10 grid lg:grid-cols-2 gap-10 items-center p-10 md:p-12">
            {/* Copy */}
            <div>
              <div
                className="eyebrow mb-5"
                style={{ color: active.accent, borderColor: `${active.accent}40`, background: `${active.accent}12`, transition: 'all 0.3s' }}
              >
                {active.label}
              </div>
              <h3
                className="font-black leading-tight mb-4"
                style={{ fontSize: 'clamp(24px, 3vw, 36px)', letterSpacing: '-0.8px', color: 'var(--ink)' }}
              >
                {active.prompt}
              </h3>
              <p className="mb-8 leading-relaxed" style={{ color: 'var(--soft)', fontSize: '15.5px' }}>{active.desc}</p>
              <div className="flex flex-col gap-3 mb-8">
                {active.outcomes.map((o, i) => (
                  <div key={i} className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: 'var(--soft)' }}>
                    <span className="font-black" style={{ color: 'var(--g4)' }}>✓</span> {o}
                  </div>
                ))}
              </div>
              <button
                className="gbtn text-[14px]"
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Try {active.label} for free →
              </button>
            </div>

            {/* Video */}
            <LazyVideo
              label={`${active.label} — subject preview`}
              spec={VIDEO_SPECS.subjectPreview}
              className="w-full rounded-2xl"
              aspectRatio="4/3"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

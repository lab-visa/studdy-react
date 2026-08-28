import SectionHeading from '../components/SectionHeading';

const rows = [
  { topic: 'Availability',       bad: 'Fixed times only',             good: 'Available instantly, 24/7'       },
  { topic: 'Cost',               bad: 'Costs more than a daily coffee', good: 'Costs less than one coffee a week' },
  { topic: 'Explanations',       bad: 'One try, then move on',         good: 'Unlimited re-explanations'       },
  { topic: 'Learning style',     bad: 'Same for everyone',             good: 'Adapts to each learner'          },
  { topic: 'Visual learning',    bad: 'Textbook only',                 good: 'Interactive whiteboard'          },
  { topic: 'Follow-up questions',bad: 'Wait for next session',         good: 'Ask immediately, unlimited'      },
];

export default function Comparison() {
  return (
    <section id="compare" className="py-24 px-4 md:px-6">
      <div className="max-w-[1000px] mx-auto">
        <SectionHeading
          eyebrow="Why learners switch"
          heading="Studdy vs waiting for support."
          sub="Studdy is not designed to replace every teacher. It helps during the moments when support is needed immediately."
        />

        {/* ── Desktop table ── */}
        <div className="hidden md:block rounded-3xl overflow-hidden"
          style={{ border: '1.5px solid var(--border)' }}>
          <div className="grid grid-cols-3">
            {['What matters', 'Traditional support', 'Studdy Lab'].map((h, i) => (
              <div key={i} className="px-6 py-4 text-[12px] font-black uppercase tracking-wide"
                style={{
                  color: i === 2 ? 'var(--g3)' : 'var(--soft)',
                  background: i === 2
                    ? 'linear-gradient(135deg,rgba(239,85,182,.08),rgba(140,121,224,.08))'
                    : 'var(--dim)',
                }}>
                {h}
              </div>
            ))}
            {rows.map((r, i) => (
              <>
                <div key={`t${i}`} className="px-6 py-4 font-bold text-[14px]"
                  style={{ borderTop: '1px solid var(--border)', background: 'var(--dim)' }}>
                  {r.topic}
                </div>
                <div key={`b${i}`} className="px-6 py-4 text-[14px] flex items-center gap-2"
                  style={{ borderTop: '1px solid var(--border)', color: 'var(--soft)' }}>
                  <span style={{ color: '#ccc' }}>✕</span> {r.bad}
                </div>
                <div key={`g${i}`} className="px-6 py-4 text-[14px] font-bold flex items-center gap-2"
                  style={{ borderTop: '1px solid var(--border)', background: 'rgba(140,121,224,.03)' }}>
                  <span style={{ color: 'var(--g4)' }}>✓</span> {r.good}
                </div>
              </>
            ))}
          </div>
        </div>

        {/* ── Mobile cards ── */}
        <div className="md:hidden flex flex-col gap-4">
          {rows.map((r, i) => (
            <div key={i} className="rounded-2xl overflow-hidden"
              style={{ border: '1.5px solid var(--border)' }}>
              {/* Topic header */}
              <div className="px-4 py-2.5 text-[11px] font-black uppercase tracking-widest"
                style={{ background: 'var(--dim)', color: 'var(--soft)' }}>
                {r.topic}
              </div>
              {/* Two columns side by side */}
              <div className="grid grid-cols-2">
                {/* Traditional */}
                <div className="px-4 py-3"
                  style={{ borderRight: '1px solid var(--border)', background: '#fff' }}>
                  <div className="text-[10px] font-black uppercase tracking-wide mb-1.5"
                    style={{ color: 'var(--soft)' }}>
                    Traditional
                  </div>
                  <div className="flex items-start gap-1.5 text-[13px]"
                    style={{ color: 'var(--soft)', lineHeight: 1.4 }}>
                    <span style={{ color: '#ccc', flexShrink: 0, marginTop: '1px' }}>✕</span>
                    <span>{r.bad}</span>
                  </div>
                </div>
                {/* Studdy Lab */}
                <div className="px-4 py-3"
                  style={{ background: 'linear-gradient(135deg,rgba(239,85,182,.05),rgba(140,121,224,.05))' }}>
                  <div className="text-[10px] font-black uppercase tracking-wide mb-1.5"
                    style={{ color: 'var(--g3)' }}>
                    Studdy Lab
                  </div>
                  <div className="flex items-start gap-1.5 text-[13px] font-bold"
                    style={{ color: 'var(--ink)', lineHeight: 1.4 }}>
                    <span style={{ color: 'var(--g4)', flexShrink: 0, marginTop: '1px' }}>✓</span>
                    <span>{r.good}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

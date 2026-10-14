import SectionHeading from '../components/SectionHeading';
import { useMarket } from '../context/MarketContext';

const rows = [
  { topic: 'Availability',       bad: 'Fixed times only',             good: 'Available instantly, 24/7'       },
  { topic: 'Cost',               bad: 'Costs more than a daily coffee', good: 'Costs less than one coffee a week' },
  { topic: 'Explanations',       bad: 'One try, then move on',         good: 'Unlimited re-explanations'       },
  { topic: 'Learning style',     bad: 'Same for everyone',             good: 'Adapts to each learner'          },
  { topic: 'Visual learning',    bad: 'Textbook only',                 good: 'Interactive whiteboard'          },
  { topic: 'Follow-up questions',bad: 'Wait for next session',         good: 'Ask immediately, unlimited'      },
];

/* India version: compares against home tuition / coaching, with ₹ prices. */
const INDIA_ROWS: typeof rows = [
  { topic: 'Availability',     bad: 'Fixed tuition timings',              good: 'Any time, even at 11 pm, 24×7' },
  { topic: 'Cost',             bad: '₹3,000–10,000+ a month per subject', good: 'From ₹1,250/month for every subject' },
  { topic: 'Doubts',           bad: 'Shy to ask in a batch of 30',        good: 'Ask anything, as many times as you like' },
  { topic: 'Explanations',     bad: 'Explained once, then move on',       good: 'Re-explained until it clicks' },
  { topic: 'Visual learning',  bad: 'Board and textbook',                 good: 'Step by step on a live whiteboard' },
  { topic: 'Coverage',         bad: 'One subject per tutor',              good: 'School, entrance, college & skills' },
];

export default function Comparison() {
  const { isIndia } = useMarket();
  const list = isIndia ? INDIA_ROWS : rows;
  return (
    <section id="compare" className="py-24 px-4 md:px-6">
      <div className="max-w-[1000px] mx-auto">
        <SectionHeading
          eyebrow="Why learners switch"
          heading={isIndia ? 'Studdy vs waiting for tuition.' : 'Studdy vs waiting for support.'}
          sub={isIndia
            ? "Studdy doesn't replace your teachers. It's there for every doubt that comes up between classes, the moment it comes up."
            : 'Studdy is not designed to replace every teacher. It helps during the moments when support is needed immediately.'}
        />

        {/* ── Desktop table ── */}
        <div className="hidden md:block rounded-3xl overflow-hidden"
          style={{ border: '1.5px solid var(--border)' }}>
          <div className="grid grid-cols-3">
            {['What matters', isIndia ? 'Tuition & coaching' : 'Traditional support', 'Studdy Lab'].map((h, i) => (
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
            {list.map((r, i) => (
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
          {list.map((r, i) => (
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
                    {isIndia ? 'Tuition' : 'Traditional'}
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

/**
 * IndiaCoverage - shown only to visitors in India (see Home.tsx).
 *
 * Answers the first question an Indian parent or student asks - "does it
 * cover MY board / MY exam / MY course?" - in one glance, from Class 1 all
 * the way to college, PG and work skills.
 */
import { School, Target, GraduationCap, Briefcase, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SectionHeading from '../components/SectionHeading';
import { track } from '../utils/analytics';
import { INDIA_CTA_LABEL, INDIA_REFUND_DAYS } from '../data/india';

const STAGES: { Icon: LucideIcon; title: string; line: string; tags: string[] }[] = [
  {
    Icon: School,
    title: 'School · Class 1 to 12',
    line: 'Homework, chapter doubts, NCERT exercises and board-exam revision - every subject.',
    tags: ['CBSE', 'ICSE / ISC', 'IB', 'IGCSE', 'All State Boards', 'Maths', 'Science', 'English', 'SST', 'Accounts'],
  },
  {
    Icon: Target,
    title: 'Entrance exams',
    line: 'Concepts and tough problems broken down step by step, as many times as you need.',
    tags: ['JEE Main & Advanced', 'NEET', 'CUET', 'BITSAT', 'MHT-CET', 'KCET', 'CLAT', 'NDA', 'Olympiads'],
  },
  {
    Icon: GraduationCap,
    title: 'College & PG',
    line: 'Semester subjects, assignments, lab concepts and competitive-exam prep.',
    tags: ['B.Tech', 'MBBS', 'B.Com', 'BBA', 'B.Sc', 'MBA', 'M.Tech', 'GATE', 'CAT'],
  },
  {
    Icon: Briefcase,
    title: 'Work & new skills',
    line: 'Learn anything new, at your pace - for your first job or your next one.',
    tags: ['Excel', 'Python & coding', 'Data & AI tools', 'Spoken English', 'Interview prep', 'Business writing'],
  },
];

export default function IndiaCoverage() {
  const navigate = useNavigate();

  return (
    <section id="coverage" className="py-24 px-6">
      <div className="max-w-[1100px] mx-auto">
        <SectionHeading
          eyebrow="Made for Indian learners"
          heading="One tutor from Class 1 to your first job."
          sub="Whatever your board, entrance exam or course - ask any question and get a clear, step-by-step explanation in minutes, not days."
          center
        />

        <div className="grid sm:grid-cols-2 gap-5">
          {STAGES.map(({ Icon, title, line, tags }) => (
            <div key={title} className="rounded-2xl p-7 bg-white"
              style={{ border: '1.5px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,.04)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--grad)' }} aria-hidden="true">
                  <Icon size={18} color="#fff" strokeWidth={2} />
                </div>
                <h3 className="font-black text-[17px]" style={{ color: 'var(--ink)', letterSpacing: '-0.3px' }}>{title}</h3>
              </div>
              <p className="text-[14px] mb-4 leading-relaxed" style={{ color: 'var(--soft)' }}>{line}</p>
              <div className="flex flex-wrap gap-2">
                {tags.map(t => (
                  <span key={t} className="text-[12px] font-bold px-3 py-1 rounded-full"
                    style={{ background: 'var(--dim)', color: 'var(--ink)', border: '1px solid var(--border)' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <button className="gbtn text-[15px] px-8 py-4"
            onClick={() => { track('checkout_started'); navigate('/checkout'); }}>
            {INDIA_CTA_LABEL}
          </button>
          <p className="text-[13px] mt-3 font-semibold" style={{ color: 'var(--soft)' }}>
            Not happy in the first {INDIA_REFUND_DAYS} days? Ask for a full refund.
          </p>
        </div>
      </div>
    </section>
  );
}

import { useState, useRef, useEffect } from 'react';
import SectionHeading from '../components/SectionHeading';
import LazyVideo from '../components/LazyVideo';
import { DEMO_QUESTIONS, type DemoTab } from '../data/subjects';
import { track } from '../utils/analytics';

const TABS: { key: DemoTab; label: string }[] = [
  { key: 'school',  label: 'School' },
  { key: 'college', label: 'College' },
  { key: 'work',    label: 'Work' },
];

type DemoState = 'idle' | 'typing' | 'thinking' | 'playing';

export default function AskStuddy() {
  const [tab, setTab] = useState<DemoTab>('school');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [state, setState] = useState<DemoState>('idle');
  const [inputVal, setInputVal] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const questions = DEMO_QUESTIONS.filter(q => q.tab === tab);
  const active = DEMO_QUESTIONS.find(q => q.id === activeId);

  const clearTimers = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };

  useEffect(() => () => clearTimers(), []);

  const handleQuestion = (q: typeof DEMO_QUESTIONS[0]) => {
    clearTimers();
    track('interactive_question_selected', { id: q.id });
    setActiveId(q.id);
    setState('typing');
    setInputVal('');
    setShowFollowUp(false);

    // Simulate typing the prompt
    let i = 0;
    const type = () => {
      if (i <= q.q.length) {
        setInputVal(q.q.slice(0, i));
        i++;
        timeoutRef.current = setTimeout(type, 28);
      } else {
        setState('thinking');
        timeoutRef.current = setTimeout(() => {
          setState('playing');
          timeoutRef.current = setTimeout(() => setShowFollowUp(true), 1200);
        }, 700);
      }
    };
    type();
  };

  return (
    <section id="demo" className="py-24 px-6" style={{ background: 'var(--dim)' }}>
      <div className="max-w-[1100px] mx-auto">
        <SectionHeading
          eyebrow="Try it yourself"
          heading="Ask Studdy anything."
          sub="Choose a question and watch how Studdy responds — this is a preview of the real product."
          center
        />

        <div className="grid lg:grid-cols-[340px_1fr] gap-8 items-start">
          {/* Left — tabs + questions */}
          <div>
            <div className="flex gap-1 p-1 rounded-full mb-5" style={{ background: '#fff', border: '1.5px solid var(--border)', display: 'inline-flex' }}>
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setActiveId(null); setState('idle'); }}
                  className="px-5 py-2 rounded-full text-[13px] font-bold transition-all"
                  style={{ background: tab === t.key ? 'var(--ink)' : 'transparent', color: tab === t.key ? '#fff' : 'var(--soft)' }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {questions.map(q => (
                <button
                  key={q.id}
                  onClick={() => handleQuestion(q)}
                  className="text-left p-4 rounded-2xl text-[14.5px] font-semibold transition-all"
                  style={{
                    background: activeId === q.id ? 'rgba(239,85,182,.05)' : '#fff',
                    border: `1.5px solid ${activeId === q.id ? 'var(--g1)' : 'var(--border)'}`,
                    color: 'var(--ink)',
                  }}
                  aria-pressed={activeId === q.id}
                >
                  {q.q}
                </button>
              ))}
            </div>
          </div>

          {/* Right — product stage */}
          <div className="bg-white rounded-3xl overflow-hidden" style={{ border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.06)' }}>
            {/* Topbar */}
            <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)', background: '#fdfcff' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-[13px]" style={{ background: 'var(--grad)' }}>S</div>
              <div>
                <div className="font-bold text-[13.5px]">Studdy</div>
                <div className="text-[11.5px]" style={{ color: 'var(--soft)' }}>
                  {state === 'thinking' ? 'Processing...' : state === 'playing' ? 'Explaining now' : 'Click a question to begin'}
                </div>
              </div>
              {state === 'thinking' && (
                <div className="ml-auto flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--g1)', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
            </div>

            {/* Input field */}
            <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--dim)', border: '1.5px solid var(--border)' }}>
                <input
                  type="text"
                  readOnly
                  value={inputVal}
                  placeholder="Select a question above..."
                  className="flex-1 text-[14px] font-medium bg-transparent outline-none"
                  style={{ color: 'var(--ink)' }}
                  aria-label="Question input"
                />
                {state === 'thinking' && <div className="w-1 h-4 rounded-full animate-pulse" style={{ background: 'var(--g1)' }} />}
              </div>
            </div>

            {/* Response area */}
            <div className="p-5" style={{ minHeight: '300px' }}>
              {state === 'idle' && (
                <div className="flex flex-col items-center justify-center h-52 text-center" style={{ color: 'var(--soft)' }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--dim)' }}>
                    <div className="text-[20px]">↑</div>
                  </div>
                  <p className="text-[14px]">Choose a question to see how Studdy explains it.</p>
                </div>
              )}

              {(state === 'typing' || state === 'thinking') && (
                <div className="flex flex-col items-center justify-center h-52">
                  <div className="flex gap-2 mb-3">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: 'var(--grad)', animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--soft)' }}>
                    {state === 'typing' ? 'Sending...' : 'Studdy is thinking...'}
                  </p>
                </div>
              )}

              {state === 'playing' && active && (
                <>
                  <LazyVideo
                    label={active.videoLabel}
                    meta="Replace with real recorded response video"
                    className="w-full rounded-2xl mb-4"
                    aspectRatio="16/9"
                  />
                  {showFollowUp && (
                    <div className="mt-4 p-4 rounded-2xl" style={{ background: 'var(--dim)', border: '1px solid var(--border)' }}>
                      <p className="text-[12px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--soft)' }}>Follow-up</p>
                      <input
                        type="text"
                        placeholder="Ask a follow-up question..."
                        className="w-full text-[14px] bg-transparent outline-none"
                        style={{ color: 'var(--ink)' }}
                        aria-label="Follow-up question field"
                      />
                    </div>
                  )}
                  <div className="mt-4 p-4 rounded-2xl text-center" style={{ background: 'rgba(239,85,182,.05)', border: '1px solid rgba(239,85,182,.15)' }}>
                    <p className="text-[13px] mb-3" style={{ color: 'var(--soft)' }}>
                      This is a preview. Start your free trial for unlimited questions on any topic.
                    </p>
                    <button className="gbtn text-[13px] px-5 py-2.5" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
                      Start Free Trial
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

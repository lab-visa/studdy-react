import { useState } from 'react';
import SectionHeading from '../components/SectionHeading';
import { demoTabs, type DemoStep } from '../data/subjects';
import { track } from '../utils/analytics';

type Tab = 'school' | 'college' | 'work';

export default function AskStuddy() {
  const [activeTab, setActiveTab] = useState<Tab>('school');
  const [activeStep, setActiveStep] = useState<DemoStep | null>(null);
  const [thinking, setThinking] = useState(false);
  const [done, setDone] = useState(false);

  const handleQuestion = (step: DemoStep) => {
    track('interactive_question_selected', { question: step.q, tab: activeTab });
    setActiveStep(step);
    setThinking(true);
    setDone(false);
    setTimeout(() => { setThinking(false); setDone(true); }, 1800);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'school', label: '🎒 School' },
    { key: 'college', label: '🎓 College' },
    { key: 'work', label: '💼 Work' },
  ];

  return (
    <section id="demo" className="py-24 px-6" style={{ background: 'var(--dim)' }}>
      <div className="max-w-[1100px] mx-auto">
        <SectionHeading eyebrow="Try it yourself" heading="Try asking Studdy." sub="Select a question and watch how Studdy explains it — this is a preview." center />

        <div className="grid lg:grid-cols-2 gap-14 items-start">
          {/* Left — tabs + questions */}
          <div>
            {/* Tab switcher */}
            <div className="flex gap-2 mb-6 p-1 rounded-full inline-flex" style={{ background: '#fff', border: '1.5px solid var(--border)' }}>
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setActiveTab(t.key); setActiveStep(null); setDone(false); }}
                  className="px-5 py-2 rounded-full text-[13.5px] font-bold transition-all"
                  style={{
                    background: activeTab === t.key ? 'var(--ink)' : 'transparent',
                    color: activeTab === t.key ? '#fff' : 'var(--soft)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {demoTabs[activeTab].map((step, i) => (
                <button
                  key={i}
                  onClick={() => handleQuestion(step)}
                  className="text-left p-4 rounded-2xl font-bold text-[14.5px] transition-all flex items-center gap-3"
                  style={{
                    background: activeStep?.q === step.q ? 'rgba(239,85,182,.05)' : '#fff',
                    border: `1.5px solid ${activeStep?.q === step.q ? 'var(--g1)' : 'var(--border)'}`,
                    color: 'var(--ink)',
                  }}
                >
                  <span className="text-[22px]">💬</span>
                  {step.q}
                </button>
              ))}
            </div>
          </div>

          {/* Right — demo player */}
          <div className="bg-white rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,.06)]" style={{ border: '1.5px solid var(--border)' }}>
            {/* topbar */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--border)', background: '#fdfcff' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-[14px]" style={{ background: 'var(--grad)' }}>A</div>
              <div>
                <div className="font-bold text-[14px]">Studdy</div>
                <div className="text-[12px]" style={{ color: 'var(--soft)' }}>
                  {thinking ? '⏳ Thinking...' : done ? 'Response ready' : 'Click a question to start'}
                </div>
              </div>
            </div>

            <div className="p-6 min-h-[320px]">
              {!activeStep && (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <div className="text-[40px] mb-3">👆</div>
                  <p className="text-[14.5px]" style={{ color: 'var(--soft)' }}>Select a question on the left to see how Studdy explains it.</p>
                </div>
              )}

              {activeStep && (
                <>
                  <div className="mb-4">
                    <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--soft)' }}>You asked</div>
                    <div className="rounded-2xl p-4 text-[14.5px]" style={{ background: 'var(--dim)' }}>{activeStep.q}</div>
                  </div>

                  {thinking && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg,rgba(239,85,182,.06),rgba(140,121,224,.06))', border: '1px solid rgba(140,121,224,.12)' }}>
                      <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--g1)' }} />
                      <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--g2)', animationDelay: '0.15s' }} />
                      <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--g3)', animationDelay: '0.3s' }} />
                    </div>
                  )}

                  {done && (
                    <>
                      <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--soft)' }}>Studdy explains</div>
                      <div className="rounded-2xl p-4 mb-4" style={{ background: 'linear-gradient(135deg,rgba(239,85,182,.06),rgba(140,121,224,.06))', border: '1px solid rgba(140,121,224,.12)' }}>
                        {/* Progress bar */}
                        <div className="h-2 rounded-full mb-4 overflow-hidden" style={{ background: '#f0eef5' }}>
                          <div className="h-full rounded-full transition-all duration-[1.4s]" style={{ width: `${activeStep.fill}%`, background: 'var(--grad)' }} />
                        </div>
                        {activeStep.steps.map((s, i) => (
                          <p key={i} className="text-[14px] mb-2 write-in" style={{ animationDelay: `${i * 0.3}s`, color: 'var(--ink)' }}>
                            {s}
                          </p>
                        ))}
                      </div>
                      <div className="p-4 rounded-2xl text-center text-[13.5px] font-bold" style={{ background: 'rgba(239,85,182,.05)', border: '1px solid rgba(239,85,182,.15)', color: 'var(--soft)' }}>
                        This is a preview. The full tutor covers any topic, any subject, unlimited questions.
                        <button className="gbtn mt-3 w-full text-[13px]" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
                          Start Free Trial →
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

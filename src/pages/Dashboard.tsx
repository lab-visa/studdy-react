import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../utils/analytics';

const recentSessions = [
  { subject:'Maths', topic:'Fractions and percentages', time:'2 hours ago', icon:'📐' },
  { subject:'Science', topic:'How volcanoes erupt', time:'Yesterday', icon:'🔬' },
  { subject:'English', topic:'Essay structure', time:'2 days ago', icon:'📖' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');

  return (
    <div className="min-h-screen" style={{ background: 'var(--dim)' }}>
      {/* Top bar */}
      <header className="bg-white h-16 flex items-center justify-between px-6 sticky top-0 z-50" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="font-black text-[20px]"><span className="grad-text">studdy</span> lab</div>
        <div className="flex items-center gap-3">
          <a
            href="https://wa.me/441234567890"
            className="text-[13px] font-bold flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: 'var(--dim)', color: 'var(--soft)' }}
            onClick={() => track('whatsapp_support_click')}
          >
            💬 Support
          </a>
          <button
            className="text-[13px] font-bold px-4 py-2 rounded-full"
            style={{ background: 'var(--dim)', color: 'var(--soft)' }}
            onClick={() => navigate('/')}
          >
            ← Website
          </button>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto px-6 py-8">
        {/* Welcome banner */}
        <div
          className="rounded-3xl p-8 mb-6 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#fdf4fb,#f0ecff,#eaf6ff)', border: '1.5px solid var(--border)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'var(--grad)' }} />
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <div className="eyebrow mb-3">Your private dashboard</div>
              <h1 className="font-black mb-2" style={{ fontSize: 'clamp(24px,3vw,36px)', letterSpacing: '-0.8px' }}>Welcome back! 👋</h1>
              <p className="text-[15px]" style={{ color: 'var(--soft)' }}>Your trial is active. 5 days remaining.</p>
            </div>
            <button
              className="gbtn text-[15px]"
              onClick={() => { track('dashboard_opened'); window.open('https://studdyai.com', '_blank'); }}
            >
              Start Learning →
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Ask a question */}
            <div className="bg-white rounded-2xl p-6" style={{ border: '1.5px solid var(--border)' }}>
              <h2 className="font-black text-[17px] mb-4">Ask a question</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Type any question — Maths, Science, coding, Excel..."
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl text-[14px]"
                  style={{ border: '1.5px solid var(--border)', background: 'var(--dim)' }}
                />
                <button className="gbtn px-5 text-[14px]" onClick={() => window.open('https://studdyai.com', '_blank')}>Ask →</button>
              </div>
            </div>

            {/* Login details */}
            <div className="bg-white rounded-2xl p-6" style={{ border: '1.5px solid var(--border)' }}>
              <h2 className="font-black text-[17px] mb-4">Login details</h2>
              {[
                { label:'Login URL', value:'studdyai.com/sign-in' },
                { label:'Email', value:'your-email@example.com' },
                { label:'Password', value:'••••••••••' },
              ].map(({ label, value }) => (
                <div key={label} className="mb-3">
                  <div className="text-[11.5px] font-black uppercase tracking-wide mb-1.5" style={{ color: 'var(--soft)' }}>{label}</div>
                  <div className="rounded-xl px-4 py-3 font-mono text-[13.5px] flex justify-between items-center" style={{ background: 'var(--dim)', border: '1px dashed var(--border)' }}>
                    <span>{value}</span>
                    <button className="text-[12px] font-bold" style={{ color: 'var(--g3)' }}>Copy</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent sessions */}
            <div className="bg-white rounded-2xl p-6" style={{ border: '1.5px solid var(--border)' }}>
              <h2 className="font-black text-[17px] mb-4">Recent learning sessions</h2>
              {recentSessions.map((s, i) => (
                <div key={i} className="flex items-center gap-4 py-3" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px]" style={{ background: 'var(--dim)' }}>{s.icon}</div>
                  <div className="flex-1">
                    <div className="font-bold text-[14px]">{s.topic}</div>
                    <div className="text-[12px]" style={{ color: 'var(--soft)' }}>{s.subject} · {s.time}</div>
                  </div>
                  <button className="text-[12.5px] font-bold" style={{ color: 'var(--g3)' }}>Continue</button>
                </div>
              ))}
            </div>
          </div>

          {/* Side column */}
          <div className="space-y-5">
            {/* Trial status */}
            <div className="bg-white rounded-2xl p-6" style={{ border: '1.5px solid var(--border)' }}>
              <h2 className="font-black text-[17px] mb-4">Trial & billing</h2>
              {[
                { label:'Status', value:'🟢 Trial active' },
                { label:'Trial ends', value:'19 July 2026' },
                { label:'Then billed', value:'$9.99/week' },
              ].map(({ label, value }) => (
                <div key={label} className="mb-3">
                  <div className="text-[11.5px] font-black uppercase tracking-wide mb-1" style={{ color: 'var(--soft)' }}>{label}</div>
                  <div className="rounded-xl px-4 py-2.5 text-[13.5px] font-semibold" style={{ background: 'var(--dim)' }}>{value}</div>
                </div>
              ))}
              <button className="gost w-full mt-2 text-[13px]">Manage billing</button>
              <button
                className="w-full mt-2 text-[13px] font-bold py-3 rounded-full"
                style={{ background: '#fff0f0', color: '#b42318', border: '1.5px solid #ffd5d2' }}
              >
                Cancel subscription
              </button>
            </div>

            {/* Subjects */}
            <div className="bg-white rounded-2xl p-6" style={{ border: '1.5px solid var(--border)' }}>
              <h2 className="font-black text-[17px] mb-4">Start a subject</h2>
              {['📐 Maths', '🔬 Science', '📖 English', '💻 Coding', '📊 Excel', '🎯 Exam Prep'].map(s => (
                <button
                  key={s}
                  className="w-full text-left px-4 py-3 rounded-xl text-[14px] font-bold mb-2 hover:opacity-80"
                  style={{ background: 'var(--dim)', color: 'var(--ink)' }}
                  onClick={() => window.open('https://studdyai.com', '_blank')}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* WhatsApp support */}
            <a
              href="https://wa.me/441234567890"
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl p-5 text-center"
              style={{ background: 'var(--grad)', color: '#fff' }}
              onClick={() => track('whatsapp_support_click')}
            >
              <div className="text-[24px] mb-2">💬</div>
              <div className="font-black text-[15px] mb-1">WhatsApp Support</div>
              <div className="text-[12.5px] opacity-85">Cancel, billing or questions — we reply fast</div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

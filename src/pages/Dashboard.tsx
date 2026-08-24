import { useNavigate, useLocation } from 'react-router-dom';
import { SUPPORT_WHATSAPP, LEARN_ROUTE, PLANS, type Region } from '../data/config';
import { track } from '../utils/analytics';
import { subjects } from '../data/subjects';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const planId = (location.state?.planId ?? 'annual') as string;
  const region = (location.state?.region ?? 'us') as Region;

  const plan = PLANS.find(p => p.id === planId) ?? PLANS[1];
  const pd = plan.monthly[region as any];

  return (
    <div className="min-h-screen" style={{ background: 'var(--dim)' }}>
      {/* Topbar */}
      <header className="bg-white h-16 flex items-center justify-between px-6 sticky top-0 z-50" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="font-black text-[20px]"><span className="grad-text">studdy</span> lab</div>
        <div className="flex items-center gap-3">
          <a
            href={SUPPORT_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-bold flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: 'var(--dim)', color: 'var(--soft)' }}
            onClick={() => track('whatsapp_support_click')}
          >
            💬 Support
          </a>
          <button className="text-[13px] font-bold px-4 py-2 rounded-full" style={{ background: 'var(--dim)', color: 'var(--soft)' }} onClick={() => navigate('/')}>
            ← Back
          </button>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="rounded-3xl p-8 mb-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#fdf4fb,#f0ecff,#eaf6ff)', border: '1.5px solid var(--border)' }}>
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'var(--grad)' }} />
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="eyebrow mb-3">Your learning dashboard</div>
              <h1 className="font-black mb-2" style={{ fontSize: 'clamp(22px,3vw,34px)', letterSpacing: '-0.8px' }}>Welcome — your trial has started. 🎉</h1>
              <p className="text-[14.5px]" style={{ color: 'var(--soft)' }}>
                {`${7} free days · ${plan.name} plan · ${pd.symbol}0 charged today`}
              </p>
            </div>
            <button
              className="gbtn text-[15px]"
              onClick={() => { track('dashboard_opened'); navigate(LEARN_ROUTE); }}
            >
              Start First Session →
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Main */}
          <div className="lg:col-span-2 space-y-5">
            {/* Ask a question */}
            <div className="bg-white rounded-2xl p-6" style={{ border: '1.5px solid var(--border)' }}>
              <h2 className="font-black text-[17px] mb-4">Ask your first question</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Type any question — maths, science, coding, Excel..."
                  className="flex-1 px-4 py-3 rounded-xl text-[14px]"
                  style={{ border: '1.5px solid var(--border)', background: 'var(--dim)' }}
                  aria-label="Ask Studdy a question"
                />
                <button
                  className="gbtn px-5 text-[14px]"
                  onClick={() => navigate(LEARN_ROUTE)}
                  aria-label="Submit question"
                >
                  Ask →
                </button>
              </div>
            </div>

            {/* Starter prompts */}
            <div className="bg-white rounded-2xl p-6" style={{ border: '1.5px solid var(--border)' }}>
              <h2 className="font-black text-[17px] mb-4">Try one of these to get started</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  'Explain photosynthesis with a diagram',
                  'Debug a simple Python error',
                  'Help me structure an essay',
                  'Build an Excel VLOOKUP formula',
                ].map(q => (
                  <button
                    key={q}
                    className="text-left p-4 rounded-xl text-[13.5px] font-semibold transition-all"
                    style={{ background: 'var(--dim)', border: '1.5px solid var(--border)', color: 'var(--ink)' }}
                    onClick={() => navigate(LEARN_ROUTE)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* No sessions yet */}
            <div className="bg-white rounded-2xl p-6" style={{ border: '1.5px solid var(--border)' }}>
              <h2 className="font-black text-[17px] mb-2">Recent sessions</h2>
              <p className="text-[14px] mb-5" style={{ color: 'var(--soft)' }}>No sessions yet — start your first one above.</p>
              <button
                className="gbtn text-[14px]"
                onClick={() => navigate(LEARN_ROUTE)}
              >
                Start Learning →
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Trial status */}
            <div className="bg-white rounded-2xl p-6" style={{ border: '1.5px solid var(--border)' }}>
              <h2 className="font-black text-[17px] mb-4">Trial & billing</h2>
              {[
                { label:'Status', value:'🟢 Trial active' },
                { label:'Plan', value:`${plan.name}` },
                { label:'Due today', value:`${pd.symbol}0.00` },
                { label:'After trial', value:pd.trialNote },
              ].map(({ label, value }) => (
                <div key={label} className="mb-3">
                  <div className="text-[11px] font-black uppercase tracking-wide mb-1" style={{ color: 'var(--soft)' }}>{label}</div>
                  <div className="rounded-xl px-4 py-2.5 text-[13.5px] font-semibold" style={{ background: 'var(--dim)' }}>{value}</div>
                </div>
              ))}
              <a
                href={SUPPORT_WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center mt-3 py-3 rounded-xl text-[13px] font-bold"
                style={{ background: '#fff0f0', color: '#b42318', border: '1.5px solid #ffd5d2' }}
                onClick={() => track('whatsapp_support_click')}
              >
                Cancel via WhatsApp
              </a>
            </div>

            {/* Subjects */}
            <div className="bg-white rounded-2xl p-6" style={{ border: '1.5px solid var(--border)' }}>
              <h2 className="font-black text-[17px] mb-4">Start by subject</h2>
              {subjects.map(s => (
                <button
                  key={s.id}
                  className="w-full text-left px-4 py-3 rounded-xl text-[13.5px] font-semibold mb-2 transition-colors"
                  style={{ background: 'var(--dim)', color: 'var(--ink)' }}
                  onClick={() => navigate(LEARN_ROUTE)}
                  aria-label={`Start ${s.label} session`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

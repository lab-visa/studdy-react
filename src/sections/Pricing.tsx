import { useState, useEffect } from 'react';
import SectionHeading from '../components/SectionHeading';
import { PLANS, REGIONS, TRIAL_DAYS, type Region } from '../data/config';
import { track } from '../utils/analytics';
import { useNavigate } from 'react-router-dom';

export default function Pricing() {
  const [region, setRegion] = useState<Region>('us');
  const navigate = useNavigate();

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) track('pricing_view'); },
      { threshold: 0.3 }
    );
    const el = document.getElementById('pricing');
    if (el) obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handlePlan = (planId: string, event: string) => {
    track(event as Parameters<typeof track>[0]);
    navigate('/checkout', { state: { planId, region } });
  };

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-[1000px] mx-auto">
        <SectionHeading
          eyebrow="Pricing"
          heading="Start learning today."
          sub={`${TRIAL_DAYS} days completely free. We'll message you before anything is charged.`}
          center
        />

        {/* Region toggle */}
        <div className="flex justify-center mb-10">
          <div className="flex gap-1 p-1 rounded-full" style={{ background: 'var(--dim)', border: '1.5px solid var(--border)' }}>
            {REGIONS.map(r => (
              <button
                key={r.key}
                onClick={() => setRegion(r.key)}
                className="px-5 py-2 rounded-full text-[13px] font-bold transition-all"
                style={{ background: region === r.key ? '#fff' : 'transparent', color: region === r.key ? 'var(--ink)' : 'var(--soft)', boxShadow: region === r.key ? '0 2px 8px rgba(0,0,0,.08)' : 'none' }}
              >
                {r.flag} {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-stretch">
          {/* Monthly */}
          {(() => {
            const plan = PLANS[0];
            const pd = plan.monthly[region];
            return (
              <div className="rounded-2xl p-8 flex flex-col" style={{ border: '1.5px solid var(--border)', background: '#fff' }}>
                <div className="text-[12px] font-black uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>{plan.name}</div>
                <div className="font-black mb-1" style={{ fontSize: '38px', letterSpacing: '-1.5px' }}>
                  {pd.symbol}0 <span className="text-[14px] font-medium" style={{ color: 'var(--soft)' }}>today</span>
                </div>
                <p className="text-[13px] mb-6 flex-1" style={{ color: 'var(--soft)' }}>{pd.trialNote}</p>
                <ul className="space-y-2 mb-6">
                  {['Full tutor access','All subjects','Unlimited questions','WhatsApp support','Cancel anytime'].map(f => (
                    <li key={f} className="flex gap-2 text-[13.5px]" style={{ color: 'var(--soft)' }}>
                      <span style={{ color: 'var(--g4)' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button className="gost w-full justify-center" onClick={() => handlePlan('monthly', 'monthly_plan_click')}>
                  Start Free Trial
                </button>
              </div>
            );
          })()}

          {/* Annual — Best Value */}
          {(() => {
            const plan = PLANS[1];
            const pd = plan.monthly[region];
            return (
              <div
                className="rounded-2xl p-8 flex flex-col relative"
                style={{ border: '2px solid transparent', background: 'linear-gradient(#fff,#fff) padding-box, var(--grad) border-box', boxShadow: '0 20px 60px rgba(140,121,224,.15)' }}
              >
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-white text-[11px] font-black px-4 py-1.5 rounded-full whitespace-nowrap" style={{ background: 'var(--grad)' }}>
                  Best Value
                </div>
                <div className="text-[12px] font-black uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>{plan.name}</div>
                <div className="font-black mb-1" style={{ fontSize: '38px', letterSpacing: '-1.5px' }}>
                  {pd.symbol}0 <span className="text-[14px] font-medium" style={{ color: 'var(--soft)' }}>today</span>
                </div>
                <p className="text-[13px] mb-6 flex-1" style={{ color: 'var(--soft)' }}>{pd.trialNote}</p>
                <ul className="space-y-2 mb-6">
                  {['Full tutor access','All subjects','Unlimited questions','Save 50% vs monthly','WhatsApp reminder before billing'].map(f => (
                    <li key={f} className="flex gap-2 text-[13.5px]" style={{ color: 'var(--soft)' }}>
                      <span style={{ color: 'var(--g4)' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button className="gbtn w-full justify-center" onClick={() => handlePlan('annual', 'annual_plan_click')}>
                  Start Free Trial
                </button>
              </div>
            );
          })()}

          {/* Human Tutor — comparison only */}
          <div className="rounded-2xl p-8 flex flex-col" style={{ border: '1.5px solid var(--border)', background: '#fff', opacity: 0.55 }}>
            <div className="text-[12px] font-black uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>Human Tutor</div>
            <div className="font-black mb-1" style={{ fontSize: '38px', letterSpacing: '-1.5px' }}>
              Varies <span className="text-[14px] font-medium" style={{ color: 'var(--soft)' }}>per hour</span>
            </div>
            <p className="text-[13px] mb-6 flex-1" style={{ color: 'var(--soft)' }}>Typical tutoring billed hourly with fixed scheduling.</p>
            <ul className="space-y-2 mb-6">
              {['Fixed appointment times','Single teaching style','One explanation per session','Availability varies','Best for deep personal mentoring'].map(f => (
                <li key={f} className="flex gap-2 text-[13.5px]" style={{ color: 'var(--soft)' }}>
                  <span style={{ color: 'var(--border)' }}>–</span> {f}
                </li>
              ))}
            </ul>
            <button className="gost w-full justify-center opacity-50" disabled aria-label="Human tutor comparison — no action">
              Comparison only
            </button>
          </div>
        </div>

        <p className="text-center text-[13px] mt-6 font-semibold" style={{ color: 'var(--soft)' }}>
          🛡️ $0 due today · Reminder before billing · Cancel anytime · No calls or forms
        </p>
      </div>
    </section>
  );
}

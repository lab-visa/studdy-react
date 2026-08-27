import { useState, useEffect } from 'react';
import SectionHeading from '../components/SectionHeading';
import { REGION_DATA, REGION_GROUPS, TRIAL_DAYS, type Region } from '../data/config';
import { detectRegion } from '../utils/geo';
import { track } from '../utils/analytics';
import { useNavigate } from 'react-router-dom';

type Plan = 'monthly' | 'yearly';

/* Same four always-visible regions as Checkout, for a consistent feel
 * across the site — the visitor's own detected country is pinned in
 * front of these (unless it's already one of them). */
const PINNED_REGIONS: Region[] = ['us', 'uk', 'uae', 'au'];

export default function Pricing() {
  const navigate = useNavigate();
  const [region, setRegion] = useState<Region>('us');
  const [detectedRegion, setDetectedRegion] = useState<Region | null>(null);
  const [showAll, setShowAll] = useState(false);

  /* Detect country on mount — defaults to United States / USD if the
   * lookup fails or the visitor is somewhere we don't have a mapping
   * for (locked decision, Vish Aug 2026). */
  useEffect(() => {
    detectRegion().then(r => {
      setRegion(r);
      setDetectedRegion(r);
    });
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) track('pricing_view'); },
      { threshold: 0.3 }
    );
    const el = document.getElementById('pricing');
    if (el) obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const rd = REGION_DATA[region];
  const hasStripe = Boolean(rd.monthly.stripeId) && Boolean(rd.yearly.stripeId);

  const handlePlan = (chosenPlan: Plan, event: string) => {
    track(event as Parameters<typeof track>[0]);
    /* Carry the region + plan the visitor already picked here straight
     * through to Checkout, instead of making it re-detect and possibly
     * switch on them. */
    navigate('/checkout', { state: { region, plan: chosenPlan } });
  };

  const topRegions: Region[] =
    detectedRegion && !PINNED_REGIONS.includes(detectedRegion)
      ? [detectedRegion, ...PINNED_REGIONS]
      : PINNED_REGIONS;

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-[1000px] mx-auto">
        <SectionHeading
          eyebrow="Pricing"
          heading="Start learning today."
          sub={`${TRIAL_DAYS} days completely free. We'll message you before anything is charged.`}
          center
        />

        {/* Region selector */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex gap-1.5 flex-wrap justify-center">
            {topRegions.map(r => (
              <button key={r} onClick={() => setRegion(r)}
                className="px-4 py-2 rounded-full text-[13px] font-bold transition-all"
                style={{
                  background: region === r ? 'var(--ink)' : 'var(--dim)',
                  color:      region === r ? '#fff' : 'var(--soft)',
                  border: `1.5px solid ${region === r ? 'transparent' : 'var(--border)'}`,
                }}>
                {REGION_DATA[r].flag} {REGION_DATA[r].label}
              </button>
            ))}
            <button onClick={() => setShowAll(v => !v)}
              className="px-4 py-2 rounded-full text-[13px] font-bold"
              style={{ background: 'var(--dim)', color: 'var(--soft)', border: '1.5px solid var(--border)' }}>
              {showAll ? 'Less ↑' : 'More countries ↓'}
            </button>
          </div>

          {showAll && (
            <div className="mt-4 flex flex-col items-center gap-3 max-w-[720px]">
              {REGION_GROUPS.map(group => {
                const regions = group.regions.filter(r => !topRegions.includes(r));
                if (regions.length === 0) return null;
                return (
                  <div key={group.label} className="text-center">
                    <div className="text-[10px] font-black uppercase tracking-wide mb-1.5"
                      style={{ color: 'var(--soft)', letterSpacing: '0.08em' }}>
                      {group.label}
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-center">
                      {regions.map(r => (
                        <button key={r} onClick={() => { setRegion(r); setShowAll(false); }}
                          className="px-3 py-1 rounded-full text-[11.5px] font-bold transition-all"
                          style={{
                            background: region === r ? 'var(--ink)' : '#fff',
                            color:      region === r ? '#fff' : 'var(--soft)',
                            border: `1.5px solid ${region === r ? 'transparent' : 'var(--border)'}`,
                          }}>
                          {REGION_DATA[r].flag} {REGION_DATA[r].label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!hasStripe && (
          <p className="text-center text-[13px] mb-8 font-semibold" style={{ color: 'var(--g1)' }}>
            {rd.flag} {rd.label} pricing is coming soon — email hello@studdylab.com to join the waitlist.
          </p>
        )}

        <div className="grid md:grid-cols-3 gap-5 items-stretch">
          {/* Monthly */}
          <div className="rounded-2xl p-8 flex flex-col relative overflow-hidden"
            style={{ border: '1.5px solid var(--border)', background: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,.04)' }}>
            <div className="text-[12px] font-black uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>Monthly</div>
            <div className="font-black mb-1" style={{ fontSize: '38px', letterSpacing: '-1.5px' }}>
              {rd.symbol}0 <span className="text-[14px] font-medium" style={{ color: 'var(--soft)' }}>today</span>
            </div>
            <p className="text-[13px] mb-6 flex-1" style={{ color: 'var(--soft)' }}>
              Then {rd.monthly.display} after your {TRIAL_DAYS}-day free trial.
            </p>
            <ul className="space-y-2 mb-6">
              {['Full tutor access','All subjects','Unlimited questions','WhatsApp support','Cancel anytime'].map(f => (
                <li key={f} className="flex gap-2 text-[13.5px]" style={{ color: 'var(--soft)' }}>
                  <span style={{ color: 'var(--g4)' }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button className="gost w-full justify-center" disabled={!hasStripe}
              style={{ opacity: hasStripe ? 1 : 0.5 }}
              onClick={() => handlePlan('monthly', 'monthly_plan_click')}>
              Start Free Trial
            </button>
          </div>

          {/* Yearly — Best Value */}
          <div
            className="rounded-2xl p-8 flex flex-col relative overflow-hidden"
            style={{ border: '2px solid transparent', background: 'linear-gradient(#fff,#fff) padding-box, var(--grad) border-box', boxShadow: '0 20px 60px rgba(140,121,224,.18)' }}
          >
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'var(--grad)' }} />
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-white text-[11px] font-black px-4 py-1.5 rounded-full whitespace-nowrap" style={{ background: 'var(--grad)' }}>
              Best Value
            </div>
            <div className="text-[12px] font-black uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>Yearly</div>
            <div className="font-black mb-1" style={{ fontSize: '38px', letterSpacing: '-1.5px' }}>
              {rd.symbol}0 <span className="text-[14px] font-medium" style={{ color: 'var(--soft)' }}>today</span>
            </div>
            <p className="text-[13px] mb-1 flex-1" style={{ color: 'var(--soft)' }}>
              Then {rd.yearly.display} after your {TRIAL_DAYS}-day free trial.
            </p>
            <p className="text-[12px] mb-5 font-bold" style={{ color: 'var(--g4)' }}>Save 60% vs monthly</p>
            <ul className="space-y-2 mb-6">
              {['Full tutor access','All subjects','Unlimited questions','Save 60% vs monthly','WhatsApp reminder before billing'].map(f => (
                <li key={f} className="flex gap-2 text-[13.5px]" style={{ color: 'var(--soft)' }}>
                  <span style={{ color: 'var(--g4)' }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button className="gbtn w-full justify-center" disabled={!hasStripe}
              style={{ opacity: hasStripe ? 1 : 0.5 }}
              onClick={() => handlePlan('yearly', 'annual_plan_click')}>
              Start Free Trial
            </button>
          </div>

          {/* Human Tutor — comparison only, real per-region price */}
          <div className="rounded-2xl p-8 flex flex-col" style={{ border: '1.5px solid var(--border)', background: '#fff', opacity: 0.6 }}>
            <div className="text-[12px] font-black uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>Human Tutor</div>
            <div className="font-black mb-1" style={{ fontSize: '38px', letterSpacing: '-1.5px' }}>
              {rd.tutorPrice}
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
          🛡️ {rd.symbol}0 due today · Reminder before billing · Cancel anytime · No calls or forms
        </p>
      </div>
    </section>
  );
}

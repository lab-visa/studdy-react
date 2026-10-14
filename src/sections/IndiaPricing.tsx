/**
 * IndiaPricing — the Pricing section as shown to visitors in India.
 *
 * India offer (Oct 2026, Vish): pay first, Quarterly or Yearly, 7-day full
 * refund, no free trial, no auto-debit. "Get Started" opens /checkout with
 * the chosen plan. Changing the country dropdown back to anything else
 * switches the whole page to the international free-trial version.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SectionHeading from '../components/SectionHeading';
import RegionPicker from '../components/RegionPicker';
import { useMarket } from '../context/MarketContext';
import { track } from '../utils/analytics';
import {
  INDIA_PLANS, INDIA_REFUND_DAYS, INDIA_CTA_LABEL, INDIA_TUTOR_PRICE,
  INDIA_YEARLY_SAVING, INDIA_YEARLY_SAVING_PCT, type IndiaPlan,
} from '../data/india';

const FEATURES = [
  'Every subject, every board',
  'JEE, NEET, CUET & more',
  'College, PG & new skills',
  'Unlimited doubts, 24×7',
  'Voice, text or photo questions',
  'WhatsApp support',
];

export default function IndiaPricing() {
  const navigate = useNavigate();
  const { region, setRegion, detectedRegion } = useMarket();
  const [selected, setSelected] = useState<IndiaPlan>('yearly');

  const start = (plan: IndiaPlan) => {
    track(plan === 'yearly' ? 'annual_plan_click' : 'monthly_plan_click', { region: 'in', plan });
    navigate('/checkout', { state: { region: 'in', plan } });
  };

  const card = (plan: IndiaPlan) => {
    const p = INDIA_PLANS[plan];
    const isSel = selected === plan;
    return (
      <div key={plan}
        onClick={() => setSelected(plan)}
        className={`rounded-2xl p-8 flex flex-col relative cursor-pointer ${isSel ? 'gradient-border-live' : ''}`}
        style={isSel
          ? { boxShadow: '0 20px 60px rgba(140,121,224,.18)' }
          : { border: '1.5px solid var(--border)', background: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,.04)' }}>
        {plan === 'yearly' && (
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-white text-[11px] font-black px-4 py-1.5 rounded-full whitespace-nowrap"
            style={{ background: 'var(--grad)' }}>
            Best Value · Save {INDIA_YEARLY_SAVING_PCT}
          </div>
        )}
        <div className="text-[12px] font-black uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>{p.label}</div>
        <div className="font-black mb-1" style={{ fontSize: '38px', letterSpacing: '-1.5px' }}>
          {p.display} <span className="text-[14px] font-medium" style={{ color: 'var(--soft)' }}>{p.period}</span>
        </div>
        <p className="text-[13px] mb-1" style={{ color: 'var(--soft)' }}>
          That's just {p.perMonth}. One-time payment, GST included.
        </p>
        <p className="text-[12px] mb-5 font-bold" style={{ color: 'var(--g4)' }}>
          {plan === 'yearly' ? `You save ${INDIA_YEARLY_SAVING} vs paying quarterly` : 'No auto-debit. Renew only if you love it.'}
        </p>
        <ul className="space-y-2 mb-6 flex-1">
          {FEATURES.map(f => (
            <li key={f} className="flex gap-2 text-[13.5px]" style={{ color: 'var(--soft)' }}>
              <span style={{ color: 'var(--g4)' }}>✓</span> {f}
            </li>
          ))}
        </ul>
        <button className={`${isSel ? 'gbtn' : 'gost'} w-full justify-center`}
          onClick={(e) => { e.stopPropagation(); start(plan); }}>
          {INDIA_CTA_LABEL}
        </button>
      </div>
    );
  };

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-[1000px] mx-auto">
        <SectionHeading
          eyebrow="Pricing"
          heading="Less than one month of tuition."
          sub={`One tutor for every subject, every exam and every doubt. Not happy in the first ${INDIA_REFUND_DAYS} days? Get a full refund.`}
          center
        />

        <div className="flex justify-center mb-10">
          <RegionPicker region={region} onChange={setRegion} detectedRegion={detectedRegion} />
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-stretch">
          {card('quarterly')}
          {card('yearly')}

          {/* Human tutor — comparison only */}
          <div className="rounded-2xl p-8 flex flex-col" style={{ border: '1.5px solid var(--border)', background: '#fff', opacity: 0.6 }}>
            <div className="text-[12px] font-black uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>Home tutor</div>
            <div className="font-black mb-1" style={{ fontSize: '32px', letterSpacing: '-1.2px' }}>{INDIA_TUTOR_PRICE}</div>
            <p className="text-[13px] mb-6 flex-1" style={{ color: 'var(--soft)' }}>Typical home tuition, per subject, at fixed timings.</p>
            <ul className="space-y-2 mb-6">
              {['Fixed timings only', 'One subject per tutor', 'Explained once per class', 'Not there at exam-night 11 pm', 'Best for deep 1:1 mentoring'].map(f => (
                <li key={f} className="flex gap-2 text-[13.5px]" style={{ color: 'var(--soft)' }}>
                  <span style={{ color: 'var(--border)' }}>–</span> {f}
                </li>
              ))}
            </ul>
            <button className="gost w-full justify-center opacity-50" disabled aria-label="Home tutor comparison — no action">
              Comparison only
            </button>
          </div>
        </div>

        <p className="text-center text-[13px] mt-6 font-semibold" style={{ color: 'var(--soft)' }}>
          🛡️ {INDIA_REFUND_DAYS}-day full refund · Secure UPI, card & netbanking · No auto-debit
        </p>
      </div>
    </section>
  );
}

/**
 * IndiaCheckout — /checkout as shown to visitors in India.
 *
 * Pay first, Quarterly or Yearly, 7-day full refund, no free trial.
 *
 * INTERIM (Oct 2026): online payment via Cashfree is the next build step.
 * Until it is live, "Continue" opens WhatsApp with the chosen plan already
 * typed in, and the team replies with a Cashfree payment link. When the
 * Cashfree checkout ships, only handleContinue() below changes — the page,
 * plans and wording stay the same.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RegionPicker from '../components/RegionPicker';
import { useMarket } from '../context/MarketContext';
import { track } from '../utils/analytics';
import { trackEvent } from '../utils/tracking';
import { SUPPORT_WHATSAPP_NUMBER } from '../data/config';
import {
  INDIA_PLANS, INDIA_REFUND_DAYS, INDIA_YEARLY_SAVING, INDIA_YEARLY_SAVING_PCT, type IndiaPlan,
} from '../data/india';

export default function IndiaCheckout({ initialPlan }: { initialPlan: IndiaPlan }) {
  const navigate = useNavigate();
  const { region, setRegion, detectedRegion } = useMarket();
  const [plan, setPlan] = useState<IndiaPlan>(initialPlan);
  const p = INDIA_PLANS[plan];

  const handleContinue = () => {
    track('checkout_started', { region: 'in', plan });
    trackEvent('trial_clicked');
    const msg = `Hi! I'd like to get started with Studdy Lab — ${p.label} plan (${p.display} ${p.period}). Please send me the payment link.`;
    window.open(`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--dim)' }}>
      <div className="w-full max-w-[560px]">
        <button onClick={() => navigate(-1)}
          className="text-[13px] font-semibold mb-6 flex items-center gap-1"
          style={{ color: 'var(--soft)' }}>
          ← Back
        </button>

        <div className="bg-white rounded-3xl"
          style={{ border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.08)' }}>
          <div className="px-8 pt-8 pb-6 text-center"
            style={{ background: 'linear-gradient(135deg,#fdf4fb,#f0ecff,#eaf6ff)', borderRadius: '24px 24px 0 0' }}>
            <div className="font-black text-[24px] mb-1"><span className="grad-text">studdy</span></div>
            <div className="text-[13px] font-semibold" style={{ color: 'var(--soft)' }}>
              Your AI tutor for school, entrance exams, college and beyond
            </div>
          </div>

          <div className="px-8 py-6">
            {/* Plan toggle */}
            <div className="flex gap-2 p-1 rounded-2xl mb-6" style={{ background: 'var(--dim)' }}>
              {(['quarterly', 'yearly'] as IndiaPlan[]).map(k => (
                <button key={k} onClick={() => setPlan(k)}
                  className="flex-1 py-3 rounded-xl text-[13.5px] font-bold transition-all"
                  style={{
                    background: plan === k ? '#fff' : 'transparent',
                    color: plan === k ? 'var(--ink)' : 'var(--soft)',
                    boxShadow: plan === k ? '0 2px 8px rgba(0,0,0,.08)' : 'none',
                  }}>
                  {INDIA_PLANS[k].label}
                  {k === 'yearly' && (
                    <span className="ml-2 text-[10px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--grad)', color: '#fff' }}>
                      SAVE {INDIA_YEARLY_SAVING_PCT}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mb-6">
              <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--soft)' }}>Your country</div>
              <RegionPicker region={region} onChange={setRegion} detectedRegion={detectedRegion} />
            </div>

            {/* Price summary */}
            <div className="rounded-2xl p-5 mb-6"
              style={{ background: 'linear-gradient(135deg,rgba(239,85,182,.06),rgba(140,121,224,.06))', border: '1px solid rgba(140,121,224,.15)' }}>
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="font-black text-[15px]" style={{ color: 'var(--ink)' }}>{p.label} plan · {p.period}</div>
                  <div className="text-[13px] mt-0.5" style={{ color: 'var(--soft)' }}>
                    Just {p.perMonth} · GST included · No auto-debit
                  </div>
                  {plan === 'yearly' && (
                    <div className="text-[12px] mt-1 font-bold" style={{ color: 'var(--g4)' }}>
                      You save {INDIA_YEARLY_SAVING} vs quarterly
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-black text-[28px]" style={{ color: 'var(--ink)' }}>{p.display}</div>
                  <div className="text-[11px]" style={{ color: 'var(--soft)' }}>pay once</div>
                </div>
              </div>
            </div>

            <button className="gbtn w-full text-[15px] py-4 mb-3" onClick={handleContinue}>
              Get Started · {p.display}
            </button>
            <p className="text-center text-[12px] mb-4" style={{ color: 'var(--soft)' }}>
              We'll send your secure payment link on WhatsApp right away. Your login arrives as soon as you pay.
            </p>

            <div className="flex justify-center gap-4 flex-wrap">
              {[`${INDIA_REFUND_DAYS}-day full refund`, 'UPI, cards & netbanking', 'Unlimited doubts, 24×7'].map(t => (
                <div key={t} className="flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: 'var(--soft)' }}>
                  <span style={{ color: 'var(--g4)' }}>✓</span> {t}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-[12px]" style={{ color: 'var(--soft)' }}>
          Home tuition costs ₹800–1,500 an hour · Studdy covers every subject for less than one month of tuition
        </div>
      </div>
    </div>
  );
}

/**
 * IndiaCheckout - /checkout as shown to visitors in India.
 *
 * Pay first, Quarterly or Yearly, 7-day full refund, no free trial.
 *
 * Flow: the buyer enters name, email and mobile → /api/cashfree/create-order
 * saves the order and creates it at Cashfree → Cashfree's own payment page
 * opens (UPI, cards, netbanking) → after paying, Cashfree sends them to
 * /dashboard?order_id=..., which confirms the payment with Cashfree and
 * shows their login.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RegionPicker from '../components/RegionPicker';
import { useMarket } from '../context/MarketContext';
import { track } from '../utils/analytics';
import { trackEvent, getLeadId, getCampaignCode } from '../utils/tracking';
import { getRefCode } from '../utils/ref';
import { openCashfreeCheckout } from '../utils/cashfree';
import {
  INDIA_PLANS, INDIA_REFUND_DAYS, INDIA_YEARLY_SAVING, INDIA_YEARLY_SAVING_PCT, type IndiaPlan,
} from '../data/india';

export default function IndiaCheckout({ initialPlan }: { initialPlan: IndiaPlan }) {
  const navigate = useNavigate();
  const { region, setRegion, detectedRegion } = useMarket();
  const [plan, setPlan] = useState<IndiaPlan>(initialPlan);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /* Partner code: from their ?ref= link (already applied), or typed here. */
  const [savedRef] = useState(() => getRefCode());
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const p = INDIA_PLANS[plan];

  const handleContinue = async () => {
    setError('');
    if (name.trim().length < 2) return setError('Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError('Please enter a valid email address.');
    const digits = phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(digits)) return setError('Please enter a valid 10-digit mobile number.');

    setBusy(true);
    track('checkout_started', { region: 'in', plan });
    trackEvent('trial_clicked');
    try {
      const res = await fetch('/api/cashfree/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan, name: name.trim(), email: email.trim(), phone: digits,
          leadId: getLeadId(), campaign: getCampaignCode(),
          ref: code.trim() ? code.trim() : savedRef, refTyped: Boolean(code.trim()),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.paymentSessionId) throw new Error(data.error || 'Could not start payment. Please try again.');
      await openCashfreeCheckout(data.paymentSessionId, data.mode === 'production' ? 'production' : 'sandbox');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start payment. Please try again.');
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, props: Record<string, string>) => (
    <label className="block mb-3">
      <span className="block text-[11px] font-black uppercase tracking-wide mb-1.5" style={{ color: 'var(--soft)' }}>{label}</span>
      <input value={value} onChange={e => set(e.target.value)} {...props}
        className="w-full rounded-xl px-4 py-3 text-[15px] outline-none"
        style={{ border: '1.5px solid var(--border)', background: '#fff', color: 'var(--ink)' }} />
    </label>
  );

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

            {/* Buyer details - Cashfree needs them, and the mobile number is how
              * we reach the family for onboarding and the 7-day refund. */}
            {field('Your name', name, setName, { autoComplete: 'name', placeholder: 'Your full name' })}
            {field('Email', email, setEmail, { type: 'email', autoComplete: 'email', placeholder: 'you@example.com' })}
            {field('Mobile (WhatsApp)', phone, setPhone, { type: 'tel', autoComplete: 'tel', inputMode: 'numeric', placeholder: '98765 43210' })}

            {savedRef && !codeOpen ? (
              <div className="flex items-center justify-between gap-2 mb-3 text-[12.5px]" style={{ color: 'var(--soft)' }}>
                <span>Partner code <b style={{ color: 'var(--ink)' }}>{savedRef}</b> applied</span>
                <button type="button" onClick={() => setCodeOpen(true)} className="underline font-semibold">Change</button>
              </div>
            ) : !codeOpen ? (
              <button type="button" onClick={() => setCodeOpen(true)} className="mb-3 text-[12.5px] font-semibold underline" style={{ color: 'var(--soft)' }}>
                Have a partner code?
              </button>
            ) : (
              field('Partner code (optional)', code, v => setCode(v.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40)), { autoComplete: 'off', placeholder: 'e.g. ASHA482' })
            )}

            {error && (
              <div className="rounded-xl p-3 mb-3 text-[13px]"
                style={{ background: 'rgba(239,68,68,.06)', color: '#dc2626', border: '1px solid rgba(239,68,68,.2)' }}>
                {error}
              </div>
            )}

            <button className="gbtn w-full text-[15px] py-4 mb-3 mt-2" onClick={handleContinue} disabled={busy}
              style={{ opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Opening secure payment…' : `Pay ${p.display} & get started`}
            </button>
            <p className="text-center text-[12px] mb-4" style={{ color: 'var(--soft)' }}>
              Secure payment by Cashfree. Your login appears on screen the moment you pay.
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

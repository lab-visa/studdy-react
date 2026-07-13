import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PLANS, REGIONS, type Region } from '../data/config';
import { track } from '../utils/analytics';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [region, setRegion] = useState<Region>((location.state?.region ?? 'us') as Region);
  const [planId, setPlanId] = useState<string>(location.state?.planId ?? 'annual');
  const [loading, setLoading] = useState(false);

  const plan = PLANS.find(p => p.id === planId) ?? PLANS[1];
  const pd = plan.monthly[region];

  const handleSubmit = () => {
    track('checkout_started');
    setLoading(true);
    setTimeout(() => {
      track('checkout_completed');
      navigate('/checkout-success', { state: { planId, region } });
    }, 1800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16" style={{ background: 'var(--dim)' }}>
      <div className="w-full max-w-[520px]">
        <button onClick={() => navigate(-1)} className="text-[14px] font-semibold mb-6 block" style={{ color: 'var(--soft)' }}>
          ← Back
        </button>
        <div className="bg-white rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,.08)]" style={{ border: '1.5px solid var(--border)' }}>
          <div className="text-center mb-6">
            <div className="font-black text-[21px] mb-1"><span className="grad-text">studdy</span> lab</div>
            <div className="text-[13px] font-semibold" style={{ color: 'var(--soft)' }}>Start your free trial</div>
          </div>

          {/* Plan selector */}
          <div className="flex gap-2 mb-5 p-1 rounded-2xl" style={{ background: 'var(--dim)' }}>
            {PLANS.map(p => (
              <button
                key={p.id}
                onClick={() => setPlanId(p.id)}
                className="flex-1 py-2.5 rounded-xl text-[13.5px] font-bold transition-all"
                style={{ background: planId === p.id ? '#fff' : 'transparent', color: planId === p.id ? 'var(--ink)' : 'var(--soft)', boxShadow: planId === p.id ? '0 2px 8px rgba(0,0,0,.08)' : 'none' }}
              >
                {p.name} {p.badge ? `· ${p.badge}` : ''}
              </button>
            ))}
          </div>

          {/* Region */}
          <div className="flex gap-1.5 mb-5 flex-wrap">
            {REGIONS.map(r => (
              <button
                key={r.key}
                onClick={() => setRegion(r.key)}
                className="px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-all"
                style={{ background: region === r.key ? 'var(--ink)' : 'var(--dim)', color: region === r.key ? '#fff' : 'var(--soft)' }}
              >
                {r.flag} {r.label}
              </button>
            ))}
          </div>

          {/* Trial summary */}
          <div className="rounded-2xl p-5 mb-5" style={{ background: 'linear-gradient(135deg,rgba(239,85,182,.06),rgba(140,121,224,.06))', border: '1px solid rgba(140,121,224,.15)' }}>
            <div className="flex justify-between items-center mb-2">
              <div>
                <div className="font-black text-[16px]">7-Day Free Trial</div>
                <div className="text-[13px]" style={{ color: 'var(--soft)' }}>{pd.trialNote}</div>
              </div>
              <div className="font-black text-[22px]">{pd.symbol}0</div>
            </div>
          </div>

          {/* Placeholder form */}
          <div className="space-y-4 mb-5">
            {(['Email address', 'Full name', 'WhatsApp number'] as const).map(f => (
              <div key={f}>
                <label className="block text-[11.5px] font-black uppercase tracking-wide mb-1.5" style={{ color: 'var(--soft)' }}>{f}</label>
                <input type="text" className="w-full px-4 py-3 rounded-xl text-[14px]" style={{ border: '1.5px solid var(--border)', background: '#fff' }} placeholder={f} aria-label={f} />
              </div>
            ))}
          </div>

          <div className="rounded-xl p-4 mb-5 text-[12.5px]" style={{ background: 'var(--dim)', color: 'var(--soft)' }}>
            <div className="font-black mb-1">Payment integration placeholder</div>
            Stripe or Razorpay embedded here. Card captured for after trial — {pd.symbol}0 charged today.
          </div>

          <button className="gbtn w-full text-[15px] py-4" onClick={handleSubmit} disabled={loading} aria-label="Start free trial">
            {loading ? 'Starting your trial...' : `Start Free Trial — ${pd.symbol}0 today`}
          </button>

          <p className="text-center text-[12px] mt-4" style={{ color: 'var(--soft)' }}>
            We'll message you on WhatsApp before you're charged. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

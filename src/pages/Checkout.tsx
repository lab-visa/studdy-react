/**
 * Checkout.tsx
 *
 * Flow:
 * 1. Detect user country via IP → set default region
 * 2. User selects region + plan
 * 3. Click "Start Free Trial"
 * 4. If Stripe price ID exists → redirect to Stripe hosted checkout
 * 5. If no Stripe ID yet (region coming soon) → show waitlist message
 *
 * Post-payment: Stripe redirects to /welcome?session_id=xxx
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  REGION_DATA, REGION_GROUPS, COUNTRY_TO_REGION,
  type Region,
} from '../data/config';
import { track } from '../utils/analytics';

/* ── IP detection ─────────────────────────────────────────────── */
async function detectRegion(): Promise<Region> {
  try {
    const res  = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    const code = data?.country_code as string;
    return COUNTRY_TO_REGION[code] ?? 'other';
  } catch {
    return 'us';
  }
}

/* ── Plan toggle ──────────────────────────────────────────────── */
type Plan = 'monthly' | 'yearly';

export default function Checkout() {
  const navigate = useNavigate();
  const [region,   setRegion]   = useState<Region>('us');
  const [plan,     setPlan]     = useState<Plan>('yearly');
  const [loading,  setLoading]  = useState(false);
  const [detected, setDetected] = useState(false);
  const [showAll,  setShowAll]  = useState(false);

  /* Detect country on mount */
  useEffect(() => {
    detectRegion().then(r => {
      setRegion(r);
      setDetected(true);
    });
  }, []);

  const rd      = REGION_DATA[region];
  const planData = plan === 'monthly' ? rd.monthly : rd.yearly;
  const hasStripe = Boolean(planData.stripeId);

  /* Monthly equivalent for yearly plan */
  const yearlyMonthly = plan === 'yearly'
    ? `${rd.symbol}${(parseFloat(rd.yearly.amount) / 12).toFixed(2)}/mo`
    : null;

  const handleStart = () => {
    if (!hasStripe) return;
    track('checkout_started', { region, plan });
    setLoading(true);

    /* Redirect to Stripe hosted checkout */
    const successUrl = `${window.location.origin}/welcome?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${window.location.origin}/checkout`;

    /* Build Stripe checkout URL */
    // const stripeUrl =
      `https://checkout.stripe.com/pay/${planData.stripeId}` +
      `?success_url=${encodeURIComponent(successUrl)}` +
      `&cancel_url=${encodeURIComponent(cancelUrl)}`;

    /* Correct approach: use Stripe Payment Links for now
       (the buy.stripe.com links you already have) */
    const paymentLinks: Partial<Record<Region, Record<Plan, string>>> = {
      us: {
        monthly: 'https://buy.stripe.com/14A5kFavJdycddxbZd5J61h',
        yearly:  'https://buy.stripe.com/eVqdRbgU7gKogpJ5AP5J61i',
      },
      uk: {
        monthly: 'https://buy.stripe.com/5kQ6oJ0V99hWddxfbp5J61j',
        yearly:  'https://buy.stripe.com/4gMaEZbzN79OehB5AP5J61k',
      },
    };

    const link = paymentLinks[region]?.[plan];
    if (link) {
      window.location.href = link;
    } else {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'var(--dim)' }}>
      <div className="w-full max-w-[560px]">

        {/* Back */}
        <button onClick={() => navigate(-1)}
          className="text-[13px] font-semibold mb-6 flex items-center gap-1"
          style={{ color: 'var(--soft)' }}>
          ← Back
        </button>

        <div className="bg-white rounded-3xl overflow-hidden"
          style={{ border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.08)' }}>

          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center"
            style={{ background: 'linear-gradient(135deg, #fdf4fb, #f0ecff, #eaf6ff)' }}>
            <div className="font-black text-[24px] mb-1">
              <span className="grad-text">studdy</span>
              <span style={{ color: 'var(--ink)' }}> lab</span>
            </div>
            <div className="text-[13px] font-semibold" style={{ color: 'var(--soft)' }}>
              Start your 7-day free trial
            </div>
          </div>

          <div className="px-8 py-6">

            {/* Plan toggle */}
            <div className="flex gap-2 p-1 rounded-2xl mb-6"
              style={{ background: 'var(--dim)' }}>
              {(['monthly', 'yearly'] as Plan[]).map(p => (
                <button key={p} onClick={() => setPlan(p)}
                  className="flex-1 py-3 rounded-xl text-[13.5px] font-bold transition-all relative"
                  style={{
                    background: plan === p ? '#fff' : 'transparent',
                    color:      plan === p ? 'var(--ink)' : 'var(--soft)',
                    boxShadow:  plan === p ? '0 2px 8px rgba(0,0,0,.08)' : 'none',
                  }}>
                  {p === 'yearly' ? 'Yearly' : 'Monthly'}
                  {p === 'yearly' && (
                    <span className="ml-2 text-[10px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--grad)', color: '#fff' }}>
                      SAVE 60%
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Region selector */}
            <div className="mb-6">
              <div className="text-[11px] font-black uppercase tracking-wide mb-2"
                style={{ color: 'var(--soft)' }}>
                Your country {!detected && '(detecting...)'}
              </div>

              {/* Show top regions always */}
              <div className="flex gap-1.5 flex-wrap">
                {(['us','uk','uae','au','in'] as Region[]).map(r => (
                  <button key={r} onClick={() => setRegion(r)}
                    className="px-3 py-1.5 rounded-full text-[12px] font-bold transition-all"
                    style={{
                      background: region === r ? 'var(--ink)' : 'var(--dim)',
                      color:      region === r ? '#fff' : 'var(--soft)',
                    }}>
                    {REGION_DATA[r].flag} {REGION_DATA[r].label}
                  </button>
                ))}
                <button onClick={() => setShowAll(v => !v)}
                  className="px-3 py-1.5 rounded-full text-[12px] font-bold transition-all"
                  style={{ background: 'var(--dim)', color: 'var(--soft)' }}>
                  {showAll ? 'Less ↑' : 'More countries ↓'}
                </button>
              </div>

              {/* All regions expanded */}
              {showAll && (
                <div className="mt-3 space-y-2">
                  {REGION_GROUPS.filter(g => g.label !== 'Other').map(group => (
                    <div key={group.label}>
                      <div className="text-[10px] font-black uppercase tracking-wide mb-1"
                        style={{ color: 'var(--soft)' }}>
                        {group.label}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {group.regions.map(r => (
                          <button key={r} onClick={() => { setRegion(r); setShowAll(false); }}
                            className="px-3 py-1 rounded-full text-[11px] font-bold transition-all"
                            style={{
                              background: region === r ? 'var(--ink)' : 'var(--dim)',
                              color:      region === r ? '#fff' : 'var(--soft)',
                            }}>
                            {REGION_DATA[r].flag} {REGION_DATA[r].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Price summary card */}
            <div className="rounded-2xl p-5 mb-6"
              style={{ background: 'linear-gradient(135deg,rgba(239,85,182,.06),rgba(140,121,224,.06))', border: '1px solid rgba(140,121,224,.15)' }}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-black text-[15px]" style={{ color: 'var(--ink)' }}>
                    7-Day Free Trial
                  </div>
                  <div className="text-[13px] mt-0.5" style={{ color: 'var(--soft)' }}>
                    {plan === 'yearly'
                      ? `Then ${rd.yearly.display} after trial${yearlyMonthly ? ` · ${yearlyMonthly}` : ''}`
                      : `Then ${rd.monthly.display} after trial`
                    }
                  </div>
                  {plan === 'yearly' && (
                    <div className="text-[12px] mt-1 font-bold" style={{ color: 'var(--g4)' }}>
                      Save 60% vs monthly billing
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-black text-[28px]" style={{ color: 'var(--ink)' }}>
                    {rd.symbol}0
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--soft)' }}>today</div>
                </div>
              </div>
            </div>

            {/* Coming soon notice for regions without Stripe yet */}
            {!hasStripe && (
              <div className="rounded-2xl p-4 mb-4 text-center"
                style={{ background: 'rgba(239,85,182,.06)', border: '1px solid rgba(239,85,182,.2)' }}>
                <div className="font-black text-[13px]" style={{ color: 'var(--g1)' }}>
                  {rd.flag} {rd.label} payments coming soon
                </div>
                <div className="text-[12px] mt-1" style={{ color: 'var(--soft)' }}>
                  We are setting up local payments for your region.
                  Email us at hello@studdylab.com to join the waitlist.
                </div>
              </div>
            )}

            {/* CTA */}
            <button
              className="gbtn w-full text-[15px] py-4 mb-4"
              onClick={handleStart}
              disabled={loading || !hasStripe}
              style={{ opacity: !hasStripe ? 0.5 : 1 }}
              aria-label="Start free trial">
              {loading
                ? 'Redirecting to secure checkout...'
                : hasStripe
                  ? `Start Free Trial — ${rd.symbol}0 today`
                  : 'Coming Soon for Your Region'
              }
            </button>

            {/* Trust signals */}
            <div className="flex justify-center gap-4 flex-wrap">
              {['No charge for 7 days', 'Cancel anytime', 'Secure checkout'].map(t => (
                <div key={t} className="flex items-center gap-1 text-[11.5px] font-semibold"
                  style={{ color: 'var(--soft)' }}>
                  <span style={{ color: 'var(--g4)' }}>✓</span> {t}
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Human tutor comparison */}
        <div className="mt-4 text-center text-[12px]" style={{ color: 'var(--soft)' }}>
          {rd.tutorPrice} for a human tutor · Studdy Lab costs less than one session per month
        </div>

      </div>
    </div>
  );
}

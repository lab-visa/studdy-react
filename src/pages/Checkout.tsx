/**
 * Checkout.tsx — Embedded Stripe Checkout
 *
 * Flow:
 * 1. Detect country via IP → set region + currency
 * 2. User picks Monthly or Yearly
 * 3. Click Start Free Trial
 * 4. Call /api/create-checkout-session → get clientSecret
 * 5. Render Stripe EmbeddedCheckout inside our page
 * 6. On complete → Stripe redirects to /dashboard?session_id=xxx
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  REGION_DATA, COUNTRY_TO_REGION, REGION_GROUPS, type Region,
} from '../data/config';
import { track } from '../utils/analytics';
import { trackEvent, getLeadId } from '../utils/tracking';

type Plan = 'monthly' | 'yearly';

/* Detect country from IP */
async function detectRegion(): Promise<Region> {
  try {
    const res  = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    return COUNTRY_TO_REGION[data?.country_code as string] ?? 'other';
  } catch {
    return 'us';
  }
}

/* Read UTM params from URL */
function getUTM() {
  const p = new URLSearchParams(window.location.search);
  return {
    utmSource:   p.get('utm_source')   ?? 'direct',
    utmCampaign: p.get('utm_campaign') ?? 'none',
  };
}

/* Always shown, in this order, regardless of where the visitor is from —
 * their own detected country is added in front of this list (unless it's
 * already one of these four). */
const PINNED_REGIONS: Region[] = ['us', 'uk', 'uae', 'au'];

export default function Checkout() {
  const navigate  = useNavigate();
  const [region,  setRegion]  = useState<Region>('us');
  const [detectedRegion, setDetectedRegion] = useState<Region | null>(null);
  const [plan,    setPlan]    = useState<Plan>('yearly');
  const [showAll, setShowAll] = useState(false);

  /* Detect country on mount */
  useEffect(() => {
    detectRegion().then(r => {
      setRegion(r);
      setDetectedRegion(r);
    });
  }, []);

  /* Log that this lead reached the checkout page */
  useEffect(() => {
    trackEvent('checkout_viewed');
  }, []);

  const rd       = REGION_DATA[region];
  const planData = plan === 'monthly' ? rd.monthly : rd.yearly;
  const hasStripe = Boolean(planData.stripeId);

  const yearlyMonthly = plan === 'yearly'
    ? `${rd.symbol}${(parseFloat(rd.yearly.amount) / 12).toFixed(2)}/mo`
    : null;

  /* Redirect to Stripe Payment Link — works immediately, no extra setup */
  const handleStart = useCallback(() => {
    if (!hasStripe) return;
    track('checkout_started', { region, plan });

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
      /* Log this click — don't block the redirect waiting for it */
      trackEvent('trial_clicked');

      /* Append UTM + our lead_id (as Stripe's client_reference_id) to the link.
       * client_reference_id is a built-in Stripe field — it rides along through
       * checkout and comes back on the completed session, so the webhook can
       * match this payment back to the exact lead who started it. */
      const { utmSource, utmCampaign } = getUTM();
      const leadId = getLeadId();
      /* IMPORTANT: link has no existing "?" — the first param must start
       * the query string with "?", not continue one that was never opened. */
      const separator = link.includes('?') ? '&' : '?';
      let fullLink = `${link}${separator}utm_source=${utmSource}&utm_campaign=${utmCampaign}`;
      if (leadId) {
        fullLink += `&client_reference_id=${encodeURIComponent(leadId)}`;
      }
      window.location.href = fullLink;
    }
  }, [hasStripe, plan, region]);

  /* Your detected country goes first, then the 4 pinned ones — no repeats. */
  const topRegions: Region[] =
    detectedRegion && !PINNED_REGIONS.includes(detectedRegion)
      ? [detectedRegion, ...PINNED_REGIONS]
      : PINNED_REGIONS;

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
            style={{ background: 'linear-gradient(135deg,#fdf4fb,#f0ecff,#eaf6ff)' }}>
            <div className="font-black text-[24px] mb-1">
              <span className="grad-text">studdy</span>
            </div>
            <div className="text-[13px] font-semibold" style={{ color: 'var(--soft)' }}>
              Start your 7-day free trial
            </div>
          </div>

          <div className="px-8 py-6">

            <>
                {/* Plan toggle */}
                <div className="flex gap-2 p-1 rounded-2xl mb-6"
                  style={{ background: 'var(--dim)' }}>
                  {(['monthly', 'yearly'] as Plan[]).map(p => (
                    <button key={p} onClick={() => setPlan(p)}
                      className="flex-1 py-3 rounded-xl text-[13.5px] font-bold transition-all"
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
                    Your country
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {topRegions.map(r => (
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
                      className="px-3 py-1.5 rounded-full text-[12px] font-bold"
                      style={{ background: 'var(--dim)', color: 'var(--soft)' }}>
                      {showAll ? 'Less ↑' : 'More ↓'}
                    </button>
                  </div>

                  {showAll && (
                    <div className="mt-3 space-y-3">
                      {REGION_GROUPS.map(group => {
                        const regions = group.regions.filter(r => !topRegions.includes(r));
                        if (regions.length === 0) return null;
                        return (
                          <div key={group.label}>
                            <div className="text-[10px] font-black uppercase tracking-wide mb-1.5"
                              style={{ color: 'var(--soft)' }}>
                              {group.label}
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                              {regions.map(r => (
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
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Price summary */}
                <div className="rounded-2xl p-5 mb-6"
                  style={{ background: 'linear-gradient(135deg,rgba(239,85,182,.06),rgba(140,121,224,.06))', border: '1px solid rgba(140,121,224,.15)' }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-black text-[15px]" style={{ color: 'var(--ink)' }}>
                        7-Day Free Trial
                      </div>
                      <div className="text-[13px] mt-0.5" style={{ color: 'var(--soft)' }}>
                        {plan === 'yearly'
                          ? `Then ${rd.yearly.display} · ${yearlyMonthly}`
                          : `Then ${rd.monthly.display} after trial`}
                      </div>
                      {plan === 'yearly' && (
                        <div className="text-[12px] mt-1 font-bold" style={{ color: 'var(--g4)' }}>
                          Save 60% vs monthly
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

                {/* Coming soon */}
                {!hasStripe && (
                  <div className="rounded-2xl p-4 mb-4 text-center"
                    style={{ background: 'rgba(239,85,182,.06)', border: '1px solid rgba(239,85,182,.2)' }}>
                    <div className="font-black text-[13px]" style={{ color: 'var(--g1)' }}>
                      {rd.flag} {rd.label} payments coming soon
                    </div>
                    <div className="text-[12px] mt-1" style={{ color: 'var(--soft)' }}>
                      Email hello@studdylab.com to join the waitlist.
                    </div>
                  </div>
                )}

                {/* CTA */}
                <button
                  className="gbtn w-full text-[15px] py-4 mb-4"
                  onClick={handleStart}
                  disabled={!hasStripe}
                  style={{ opacity: !hasStripe ? 0.5 : 1 }}>
                  {hasStripe
                    ? `Start Free Trial — ${rd.symbol}0 today`
                    : 'Coming Soon for Your Region'}
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
              </>
          </div>
        </div>

        {/* Human tutor comparison */}
        <div className="mt-4 text-center text-[12px]" style={{ color: 'var(--soft)' }}>
          {rd.tutorPrice} for a human tutor · Studdy costs less than one session per month
        </div>

      </div>
    </div>
  );
}

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
import { useNavigate, useLocation } from 'react-router-dom';
import { REGION_DATA, type Region } from '../data/config';
import { detectRegion } from '../utils/geo';
import { track } from '../utils/analytics';
import { trackEvent, getLeadId } from '../utils/tracking';
import RegionPicker from '../components/RegionPicker';

type Plan = 'monthly' | 'yearly';

/* Read UTM params from URL */
function getUTM() {
  const p = new URLSearchParams(window.location.search);
  return {
    utmSource:   p.get('utm_source')   ?? 'direct',
    utmCampaign: p.get('utm_campaign') ?? 'none',
  };
}

export default function Checkout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  /* If the visitor picked a region and/or a plan on the homepage Pricing
   * section (before clicking "Start Free Trial"), honor those choices
   * here instead of silently resetting them. Only an explicit "monthly"
   * from that click overrides the default — every other entry point
   * (header, footer, final CTA, direct link) still opens on Yearly, per
   * Vish (Aug 2026). */
  const passedState  = location.state as { region?: Region; plan?: Plan } | null;
  const passedRegion = passedState?.region ?? null;
  const passedPlan: Plan = passedState?.plan === 'monthly' ? 'monthly' : 'yearly';

  const [region,  setRegion]  = useState<Region>(passedRegion ?? 'us');
  const [detectedRegion, setDetectedRegion] = useState<Region | null>(passedRegion);
  const [plan,    setPlan]    = useState<Plan>(passedPlan);

  /* Detect country on mount — but don't override an explicit choice
   * carried over from the Pricing section. */
  useEffect(() => {
    detectRegion().then(r => {
      setDetectedRegion(prev => prev ?? r);
      if (!passedRegion) setRegion(r);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* Redirect to Stripe Payment Link — works immediately, no extra setup.
   * The link always comes straight from REGION_DATA (single source of
   * truth in config.ts) so a region can never show "Start Free Trial" as
   * enabled (hasStripe true) while secretly having nowhere to send the
   * customer. */
  const handleStart = useCallback(() => {
    if (!hasStripe) return;
    track('checkout_started', { region, plan });

    const link = planData.paymentLink;
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

        {/* NOTE: no overflow-hidden here — the region picker below opens a
         * dropdown panel that must be able to render outside this card's
         * bounds. The header banner gets its own top corner radius instead
         * of relying on the card clipping it. */}
        <div className="bg-white rounded-3xl"
          style={{ border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.08)' }}>

          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center"
            style={{ background: 'linear-gradient(135deg,#fdf4fb,#f0ecff,#eaf6ff)', borderRadius: '24px 24px 0 0' }}>
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

                {/* Region selector — one compact dropdown, same as Pricing */}
                <div className="mb-6">
                  <div className="text-[11px] font-black uppercase tracking-wide mb-2"
                    style={{ color: 'var(--soft)' }}>
                    Your country
                  </div>
                  <RegionPicker region={region} onChange={setRegion} detectedRegion={detectedRegion} />
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
                    ? `Start Free Trial - ${rd.symbol}0 today`
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

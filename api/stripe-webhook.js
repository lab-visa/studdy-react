/**
 * POST /api/stripe-webhook
 *
 * Stripe calls this URL directly (not the browser) the instant something
 * happens on a payment. Handled here, one event per real-world moment:
 *
 *   checkout.session.completed
 *     -> customer finished checkout, 7-day trial started, card saved
 *     -> assign a Studdy account seat, save card/trial/billing info
 *     -> stage = 'trial_started' (NOT 'paid' yet — no money has moved)
 *
 *   invoice.payment_succeeded
 *     -> Stripe actually took a real payment (trial ended, or a later
 *        monthly/yearly renewal)
 *     -> stage = 'paid', total_months_paid +1, save the invoice link
 *
 *   invoice.payment_failed
 *     -> the card was declined -> status = 'Failed'
 *
 *   customer.subscription.updated
 *     -> catches pause/resume
 *
 *   customer.subscription.deleted
 *     -> subscription actually ended (cancelled in Stripe, by us or by
 *        the bank) -> status = 'Cancelled', free up their Studdy seat
 *
 *   charge.dispute.created
 *     -> customer or bank raised a dispute/chargeback -> flag it so we
 *        see it immediately, don't silently lose track of it
 *
 *   customer.subscription.trial_will_end
 *     -> 3 days left in someone's trial -> flags them so Vish can message
 *        them on WhatsApp before they're charged (no auto-send yet)
 *
 *   charge.dispute.closed
 *     -> a dispute we flagged earlier is now resolved (won/lost)
 *
 *   refund.created
 *     -> a refund was issued (e.g. Vish refunding someone manually in
 *        Stripe) -> logged so it's never lost track of
 *
 * SECURITY: every request here is verified against Stripe's signature
 * (STRIPE_WEBHOOK_SECRET) so nobody but Stripe itself can trigger this.
 *
 * Vish has all Stripe event types enabled on this endpoint already, so
 * no Stripe Dashboard changes are needed for the 3 newest ones above.
 */
import Stripe from 'stripe';
import { getSupabase } from './_lib/supabase.js';
import { mapStatus, toDate, resolveNextBilling } from './_lib/status.js';

/* Vercel must NOT parse the body — Stripe's signature check needs the
 * exact raw bytes Stripe sent, not a re-serialized JSON object. */
export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* Finds a Studdy account/group with a free seat (fewer than 7 active
 * customers) and claims one seat. If every existing group is full, returns
 * null — Vish needs to add a new group/account manually in that case. */
async function assignStuddyAccount(supabase) {
  const { data: groups, error } = await supabase
    .from('studdy_accounts')
    .select('*')
    .order('group_name', { ascending: true });

  if (error) throw error;

  const open = (groups || []).find((g) => (g.active_customer_count ?? 0) < 7);
  if (!open) return null;

  await supabase
    .from('studdy_accounts')
    .update({ active_customer_count: (open.active_customer_count ?? 0) + 1 })
    .eq('id', open.id);

  return open;
}

/* Frees a seat when someone's subscription actually ends, so the next new
 * customer can be slotted into that group instead of opening a new one. */
async function releaseStuddyAccount(supabase, groupName) {
  if (!groupName) return;
  const { data: group } = await supabase
    .from('studdy_accounts')
    .select('id, active_customer_count')
    .eq('group_name', groupName)
    .maybeSingle();

  if (!group) return;
  const next = Math.max(0, (group.active_customer_count ?? 0) - 1);
  await supabase.from('studdy_accounts').update({ active_customer_count: next }).eq('id', group.id);
}

async function findLeadBy(supabase, column, value) {
  if (!value) return null;
  const { data } = await supabase.from('leads').select('*').eq(column, value).maybeSingle();
  return data;
}

/* Disputes and refunds both come in attached to a charge ID, not a
 * customer ID or subscription ID — look the charge up first to find
 * which customer it belongs to, then match our lead by that. */
async function findLeadByChargeId(stripe, supabase, chargeId) {
  if (!chargeId) return null;
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
    return await findLeadBy(supabase, 'stripe_customer_id', customerId);
  } catch (err) {
    console.error('Could not retrieve charge', chargeId, err.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supabase = getSupabase();

  try {
    /* ─────────────────────────────────────────────────────────────
     * Checkout finished — trial starts, card is saved
     * ───────────────────────────────────────────────────────────── */
    if (event.type === 'checkout.session.completed') {
      const sessionSummary = event.data.object;

      const session = await stripe.checkout.sessions.retrieve(sessionSummary.id, {
        expand: ['subscription', 'subscription.default_payment_method', 'customer'],
      });

      const sub = session.subscription;
      const customer = session.customer;
      const leadId = session.client_reference_id || null;

      const priceItem = sub?.items?.data?.[0];
      const planType = priceItem?.price?.recurring?.interval === 'year' ? 'Yearly' : 'Monthly';
      const currency = priceItem?.price?.currency?.toUpperCase() || null;
      const amount = priceItem?.price?.unit_amount ? priceItem.price.unit_amount / 100 : null;

      const trialStart = toDate(sub?.trial_start);
      const trialEnd = toDate(sub?.trial_end);
      const nextBilling = resolveNextBilling(sub);

      const card = sub?.default_payment_method?.card;
      const cardBrand = card?.brand || null;
      const cardLast4 = card?.last4 || null;
      const cardExpiry = card ? `${String(card.exp_month).padStart(2, '0')}/${card.exp_year}` : null;

      /* Billing country from what the customer actually typed on the card
       * form — the single most reliable "which country is this person in"
       * signal we get, so use it to fill in detected_country/region
       * whenever we have it. */
      const billingAddress = session.customer_details?.address;
      const detectedCountry = billingAddress?.country || null;
      const detectedRegion = billingAddress?.state || null;

      const dashboardUrl = `https://studdylab.com/dashboard?session_id=${session.id}`;
      const account = await assignStuddyAccount(supabase);

      /* A brand-new trial has taken $0 so far — it is NOT revenue yet.
       * stage='trial_started' keeps that honest for reporting; stage only
       * flips to 'paid' once invoice.payment_succeeded actually fires. */
      const record = {
        email: customer?.email || session.customer_details?.email || null,
        parent_name: customer?.name || session.customer_details?.name || null,
        stripe_session_id: session.id,
        stripe_customer_id: typeof customer === 'string' ? customer : customer?.id || null,
        stripe_subscription_id: typeof sub === 'string' ? sub : sub?.id || null,
        dashboard_url: dashboardUrl,
        platform: 'stripe',
        currency,
        plan_type: planType,
        amount,
        trial_start_date: trialStart,
        trial_end_date: trialEnd,
        first_payment_date: trialEnd,
        next_billing_date: nextBilling,
        card_brand: cardBrand,
        card_last4: cardLast4,
        card_expiry: cardExpiry,
        detected_country: detectedCountry,
        detected_region: detectedRegion,
        studdy_email: account?.studdy_email || null,
        studdy_password: account?.studdy_password || null,
        studdy_url: account?.studdy_url || 'https://studdyai.com',
        group_name: account?.group_name || null,
        stage: sub?.status === 'trialing' ? 'trial_started' : 'paid',
        status: mapStatus(sub?.status),
        updated_at: new Date().toISOString(),
      };

      if (leadId) {
        const existing = await findLeadBy(supabase, 'lead_id', leadId);
        if (existing) {
          await supabase.from('leads').update(record).eq('lead_id', leadId);
        } else {
          await supabase.from('leads').insert({ lead_id: leadId, ...record, opened_at: new Date().toISOString() });
        }
      } else {
        /* No lead ID at all — someone paid without ever being tracked on
         * the site (e.g. a raw Stripe link shared somewhere). Still record
         * the real customer so nothing is lost. */
        await supabase.from('leads').insert({ ...record, opened_at: new Date().toISOString() });
      }

      if (!account) {
        console.error(`No free Studdy account slot for session ${session.id} — add a new group in studdy_accounts.`);
      }
    }

    /* ─────────────────────────────────────────────────────────────
     * A real payment actually succeeded — trial ended and the card was
     * charged, or a later month/year renewed. THIS is the moment money
     * actually moved.
     * ───────────────────────────────────────────────────────────── */
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      if ((invoice.amount_paid ?? 0) <= 0) {
        /* A $0 invoice (can happen right at trial creation on some Stripe
         * API versions) is not a real payment — ignore it. */
        return res.status(200).json({ received: true });
      }

      const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      const lead =
        (await findLeadBy(supabase, 'stripe_subscription_id', subId)) ||
        (await findLeadBy(supabase, 'stripe_customer_id', invoice.customer));

      if (lead) {
        const nextBilling = toDate(invoice.lines?.data?.[0]?.period?.end) || lead.next_billing_date;
        await supabase
          .from('leads')
          .update({
            stage: 'paid',
            status: 'Active',
            total_months_paid: (lead.total_months_paid ?? 0) + 1,
            latest_invoice_url: invoice.hosted_invoice_url || null,
            latest_invoice_pdf: invoice.invoice_pdf || null,
            next_billing_date: nextBilling,
            payment_failed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('lead_id', lead.lead_id);
      } else {
        console.error(`invoice.payment_succeeded for unknown subscription ${subId} / customer ${invoice.customer}`);
      }
    }

    /* ─────────────────────────────────────────────────────────────
     * A payment attempt failed (card declined, insufficient funds, etc).
     * ───────────────────────────────────────────────────────────── */
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      const lead =
        (await findLeadBy(supabase, 'stripe_subscription_id', subId)) ||
        (await findLeadBy(supabase, 'stripe_customer_id', invoice.customer));

      if (lead) {
        await supabase
          .from('leads')
          .update({
            status: 'Failed',
            payment_failed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('lead_id', lead.lead_id);
      }
    }

    /* ─────────────────────────────────────────────────────────────
     * Subscription paused/resumed (or any other status change that isn't
     * a full cancellation, which is its own event below).
     * ───────────────────────────────────────────────────────────── */
    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const lead = await findLeadBy(supabase, 'stripe_subscription_id', sub.id);
      if (lead && sub.status === 'paused') {
        await supabase
          .from('leads')
          .update({ status: 'Paused', updated_at: new Date().toISOString() })
          .eq('lead_id', lead.lead_id);
      }
    }

    /* ─────────────────────────────────────────────────────────────
     * 3 days left in someone's trial. We don't have automatic WhatsApp
     * sending wired up yet, so this doesn't message anyone by itself —
     * it just flags the lead so Vish can filter for "trial ending soon"
     * in Supabase and message them himself before they're charged.
     * ───────────────────────────────────────────────────────────── */
    if (event.type === 'customer.subscription.trial_will_end') {
      const sub = event.data.object;
      const lead = await findLeadBy(supabase, 'stripe_subscription_id', sub.id);
      if (lead && lead.stage === 'trial_started') {
        await supabase
          .from('leads')
          .update({
            stage: 'trial_ending_soon',
            trial_ending_notified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('lead_id', lead.lead_id);
      }
    }

    /* ─────────────────────────────────────────────────────────────
     * A dispute we already flagged has now been resolved — won, lost,
     * or closed. Records the outcome so it's never left hanging.
     * ───────────────────────────────────────────────────────────── */
    if (event.type === 'charge.dispute.closed') {
      const dispute = event.data.object;
      const lead = await findLeadByChargeId(stripe, supabase, dispute.charge);
      if (lead) {
        await supabase
          .from('leads')
          .update({
            dispute_outcome: dispute.status || null,
            dispute_closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('lead_id', lead.lead_id);
      }
    }

    /* ─────────────────────────────────────────────────────────────
     * A refund was issued (from Stripe directly, e.g. by Vish manually)
     * — log it so it doesn't just vanish from our records. A full
     * refund also flips their status so it's obvious at a glance.
     * ───────────────────────────────────────────────────────────── */
    if (event.type === 'refund.created') {
      const refund = event.data.object;
      const lead = await findLeadByChargeId(stripe, supabase, refund.charge);
      if (lead) {
        const refundAmount = (refund.amount ?? 0) / 100;
        const isFullRefund = lead.amount != null && refundAmount >= Number(lead.amount);
        await supabase
          .from('leads')
          .update({
            refund_amount: refundAmount,
            refund_reason: refund.reason || null,
            refunded_at: new Date().toISOString(),
            status: isFullRefund ? 'Refunded' : lead.status,
            updated_at: new Date().toISOString(),
          })
          .eq('lead_id', lead.lead_id);
      }
    }

    /* ─────────────────────────────────────────────────────────────
     * Subscription actually ended — cancelled by us, by the customer's
     * bank, or the card kept failing until Stripe gave up. Free the seat.
     * ───────────────────────────────────────────────────────────── */
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const lead = await findLeadBy(supabase, 'stripe_subscription_id', sub.id);
      if (lead) {
        await supabase
          .from('leads')
          .update({
            status: 'Cancelled',
            stage: 'cancelled',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('lead_id', lead.lead_id);
        await releaseStuddyAccount(supabase, lead.group_name);
      }
    }

    /* ─────────────────────────────────────────────────────────────
     * Customer or their bank raised a dispute/chargeback — flag it so
     * it's never silently missed.
     * ───────────────────────────────────────────────────────────── */
    if (event.type === 'charge.dispute.created') {
      const dispute = event.data.object;
      const matched = await findLeadByChargeId(stripe, supabase, dispute.charge);
      if (matched) {
        await supabase
          .from('leads')
          .update({
            status: 'Disputed',
            dispute_status: dispute.status || 'needs_response',
            updated_at: new Date().toISOString(),
          })
          .eq('lead_id', matched.lead_id);
      }
      console.error(`Dispute raised on charge ${dispute.charge} — check Stripe Dashboard > Disputes.`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe-webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}

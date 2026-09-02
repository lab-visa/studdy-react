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
import { toDate } from './_lib/status.js';
import { syncCheckoutSession, findLeadBy } from './_lib/sync-checkout-session.js';
import {
  syncCustomerFromCheckoutSession,
  recordPaymentSucceeded,
  recordPaymentFailed,
  recordSubscriptionEnded,
  recordRefund,
  recordDisputeCreated,
  recordDisputeClosed,
} from './_lib/sync-customer.js';

/* Runs the new-CRM-tables sync alongside the existing `leads` sync above.
 * Wrapped so that if anything in here ever throws, it's only logged —
 * never allowed to affect the response Stripe gets, or the `leads` row a
 * real customer's dashboard depends on. New-CRM-table sync being a few
 * seconds late (retried on the next webhook) is fine; breaking a paying
 * customer's checkout is not.
 *
 * CRM-1 Objective 4: in addition to the existing console.error, also
 * best-effort record the failure into the already-existing, previously
 * unused `activity_log` table (migration 0008), so there's a durable,
 * queryable failure history beyond Vercel's ephemeral logs. Identified
 * only by Stripe's own event.id/event.type — never a name, email, card,
 * or Studdy credential. This logging attempt is itself wrapped in its
 * own try/catch, so a failure to log the failure can never throw or
 * affect the response Stripe gets. */
export async function safely(supabase, label, event, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`sync-customer (${label}) error:`, err);
    await logSyncFailure(supabase, label, event);
  }
}

export async function logSyncFailure(supabase, label, event) {
  try {
    await supabase.from('activity_log').insert({
      event_type: 'crm_sync_failed',
      entity_type: 'stripe_event',
      entity_id: event?.id ?? null,
      actor: 'system',
      metadata: { stripe_event_type: event?.type ?? null, label },
    });
  } catch (logErr) {
    console.error('activity_log write failed (best-effort, ignored):', logErr);
  }
}

/* CRM-1 Objective 3 (Revision 2.1 correction): atomic at-most-once claim
 * for invoice.payment_succeeded, gating the legacy total_months_paid
 * increment BEFORE it runs — not a "SELECT then decide" check, which is
 * not atomic under concurrent duplicate delivery (two requests can both
 * pass a SELECT before either writes). A single, plain INSERT into the
 * dedicated payment_claims table (migration 0015) — deliberately NOT an
 * upsert/"ON CONFLICT DO NOTHING" — is the only gate: payment_claims.
 * stripe_event_id is that table's PRIMARY KEY, so a plain INSERT can only
 * ever do one of two things: (1) succeed, meaning it just created exactly
 * one new row (a plain INSERT with no ON CONFLICT clause can never
 * silently affect zero rows), or (2) fail with Postgres error code 23505
 * (unique-violation on the primary key) because some request — this
 * process or another — already holds the claim for this exact event.
 * Postgres's own primary-key enforcement is the sole arbiter of which
 * concurrent request wins; there is no separate "check, then decide"
 * step for a duplicate to race against. Deliberately its own table, not
 * payment_events — payment_events is written by the best-effort new-CRM
 * bookkeeping path below, which can legitimately fail or lag; the legacy
 * path's correctness must never depend on that succeeding.
 *
 * Returns true if THIS call won the claim — positive evidence, not an
 * absence-of-error assumption: `!error` is only reachable here if the
 * INSERT actually completed, and a plain INSERT with no ON CONFLICT
 * clause has no way to "succeed" without creating the row. Returns false
 * only for a genuine 23505 (a real duplicate — this event is already,
 * correctly, someone else's claim; skip the legacy increment). Any OTHER
 * error is NOT a duplicate and must never be treated like one: silently
 * returning false here would make the caller respond 200 to Stripe (no
 * retry) while never running the legacy increment — a payment that's
 * quietly never recorded. So an unexpected error is thrown instead,
 * which propagates to this handler's own outer try/catch and produces a
 * 500 — the correct, safe outcome, since Stripe will retry a 500. */
export async function claimPaymentEvent(supabase, event) {
  const { error } = await supabase
    .from('payment_claims')
    .insert({ stripe_event_id: event.id, event_type: event.type });

  if (!error) return true;
  if (error.code === '23505') return false;

  console.error('claimPaymentEvent: unexpected error claiming event', event.id, error);
  throw new Error(
    `claimPaymentEvent: unexpected error claiming ${event.id}${error.message ? `: ${error.message}` : ''}`
  );
}

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
      await syncCheckoutSession(stripe, supabase, sessionSummary.id);

      /* New-CRM-tables sync — this is the moment a Paid ID is created.
       * Fetches the session again (separately from syncCheckoutSession
       * above) so this addition can never risk changing what that
       * existing, already-correct function does. */
      await safely(supabase, 'checkout.session.completed', event, async () => {
        const session = await stripe.checkout.sessions.retrieve(sessionSummary.id, {
          expand: ['subscription', 'customer'],
        });
        await syncCustomerFromCheckoutSession(supabase, session);
      });
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

      /* Atomic at-most-once claim — see claimPaymentEvent() above. Must
       * run BEFORE any legacy increment. If this call didn't win the
       * claim (lost a concurrent race, or this is a genuine Stripe
       * redelivery of an event already processed), skip the legacy
       * increment entirely and return 200 — correct, idempotent
       * behavior either way. A genuine (non-duplicate) database error
       * is intentionally NOT caught here — claimPaymentEvent() throws
       * in that case, deliberately left to propagate to this handler's
       * own outer try/catch below, which responds 500. Stripe treats a
       * 500 as "retry me", which is the correct, safe recovery path for
       * an unexpected infrastructure failure — never a silent 200 that
       * would leave a real payment unrecorded. */
      const claimed = await claimPaymentEvent(supabase, event);
      if (!claimed) {
        return res.status(200).json({ received: true, claimed: false });
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

      await safely(supabase, 'invoice.payment_succeeded', event, () => recordPaymentSucceeded(supabase, event));
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

      await safely(supabase, 'invoice.payment_failed', event, () => recordPaymentFailed(supabase, event));
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

        /* CRM-2A: additive payment_events ledger entry — see
         * sync-customer.js's recordDisputeClosed() comment. Never affects
         * the leads update above or the response Stripe gets. */
        await safely(supabase, 'charge.dispute.closed', event, () =>
          recordDisputeClosed(supabase, event, { stripeCustomerId: lead.stripe_customer_id })
        );
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

        /* CRM-2A: additive payment_events ledger entry — see
         * sync-customer.js's recordRefund() comment. Never affects the
         * leads update above or the response Stripe gets. */
        await safely(supabase, 'refund.created', event, () =>
          recordRefund(supabase, event, { stripeCustomerId: lead.stripe_customer_id })
        );
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

      await safely(supabase, 'customer.subscription.deleted', event, () => recordSubscriptionEnded(supabase, event));
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

        /* CRM-2A: additive payment_events ledger entry — see
         * sync-customer.js's recordDisputeCreated() comment. Never affects
         * the leads update above or the response Stripe gets. */
        await safely(supabase, 'charge.dispute.created', event, () =>
          recordDisputeCreated(supabase, event, { stripeCustomerId: matched.stripe_customer_id })
        );
      }
      console.error(`Dispute raised on charge ${dispute.charge} — check Stripe Dashboard > Disputes.`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe-webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}

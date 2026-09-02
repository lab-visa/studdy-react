/**
 * Mirrors real Stripe activity into the NEW CRM tables (customers,
 * subscriptions, payment_events) — running ALONGSIDE the existing
 * `leads`-table sync in sync-checkout-session.js, never replacing it.
 *
 * Studdy account/seat ASSIGNMENT itself is still fully decided by the
 * legacy `active_customer_count` allocator in sync-checkout-session.js —
 * that remains the sole credential authority. This file's job for
 * allocation is only to MIRROR that decision into the new, concurrency-safe
 * ledger (account_assignments), for CRM/reporting purposes, via
 * mirrorLegacyAllocation() below — see that function's comment for the
 * exact bridge design and why it never independently allocates.
 *
 * Every function here is wrapped in try/catch by its caller
 * (api/stripe-webhook.js) — if anything in here fails, the existing
 * `leads` row (and the customer's dashboard/checkout) is never affected.
 * Worst case, a customer's new-CRM row is a few seconds late instead of
 * something breaking for a real paying customer.
 */
import { findLeadAttribution } from './attribution.js';

/** Looks up an existing customer by Stripe's customer id, if any. */
async function findCustomerByStripeCustomerId(supabase, stripeCustomerId) {
  if (!stripeCustomerId) return null;
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();
  return data;
}

/**
 * BRIDGE (temporary, until a dedicated future cutover phase): mirrors the
 * SAME Studdy account the legacy allocator already chose into
 * account_assignments — it never independently picks an account. Legacy
 * (assignStuddyAccount() in sync-checkout-session.js, via leads.group_name
 * -> get-session.js) remains the sole system that decides which real
 * Studdy credentials a customer receives. This function only records that
 * decision in the new ledger for CRM/reporting, so account_assignments
 * stops being able to silently disagree with reality.
 *
 * Reads leads.group_name fresh, by this exact session's stripe_session_id
 * — by the time this runs, syncCheckoutSession() has already finished and
 * already written that row (see stripe-webhook.js's call order), so this
 * is always reading the just-made decision, never a stale one.
 *
 * Idempotent and mismatch-safe by construction:
 *   - no existing active assignment for this customer -> insert the mirror.
 *   - an existing active assignment already points to the SAME account
 *     legacy just chose -> no-op (e.g. a Stripe webhook retry).
 *   - an existing active assignment points to a DIFFERENT account than
 *     legacy currently says -> NEVER auto-overwritten. Logged as a
 *     reconciliation mismatch for manual review. leads.group_name (legacy)
 *     is still what the customer actually receives either way, so this is
 *     a CRM-record accuracy issue, not a credential-delivery issue.
 * The database's own partial unique index
 * (account_assignments_one_active_per_customer) is the final race-proof
 * safety net for two concurrent webhook deliveries racing each other —
 * handled below by catching that exact constraint violation (23505)
 * rather than assuming the pre-check alone is enough.
 */
async function mirrorLegacyAllocation(supabase, { customerId, sessionId }) {
  const { data: leadRow, error: leadError } = await supabase
    .from('leads')
    .select('group_name')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();

  if (leadError) {
    console.error(`mirrorLegacyAllocation: could not read leads row for session ${sessionId}:`, leadError);
    return;
  }

  const groupName = leadRow?.group_name;
  if (!groupName) {
    console.error(
      `mirrorLegacyAllocation: no legacy group_name for customer ${customerId} (session ${sessionId}) — ` +
      `legacy allocator found no free account, or this lead hasn't synced yet. Skipping mirror, not ` +
      `inventing an allocation.`
    );
    return;
  }

  const { data: account, error: accountError } = await supabase
    .from('studdy_accounts')
    .select('id')
    .eq('group_name', groupName)
    .maybeSingle();

  if (accountError) {
    console.error(`mirrorLegacyAllocation: error looking up studdy_accounts for group_name "${groupName}":`, accountError);
    return;
  }

  if (!account) {
    console.error(
      `mirrorLegacyAllocation: DATA INTEGRITY — legacy group_name "${groupName}" (customer ${customerId}, ` +
      `session ${sessionId}) does not match any row in studdy_accounts. Skipping mirror.`
    );
    return;
  }

  const { data: existingActive, error: existingError } = await supabase
    .from('account_assignments')
    .select('id, studdy_account_id')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .maybeSingle();

  if (existingError) {
    console.error(`mirrorLegacyAllocation: error checking existing assignment for customer ${customerId}:`, existingError);
    return;
  }

  if (existingActive) {
    if (existingActive.studdy_account_id === account.id) {
      return; // already mirrored correctly — idempotent no-op (e.g. webhook retry)
    }
    console.error(
      `mirrorLegacyAllocation: RECONCILIATION MISMATCH — customer ${customerId} already has an active ` +
      `account_assignments row for a different account than legacy's current group_name "${groupName}". ` +
      `Not overwriting; legacy stays authoritative for actual credential delivery. Run the reconciliation ` +
      `query to review.`
    );
    return;
  }

  const { error: insertError } = await supabase
    .from('account_assignments')
    .insert({ studdy_account_id: account.id, customer_id: customerId, status: 'active' });

  if (!insertError) return;

  if (insertError.code === '23505') {
    /* A concurrent webhook delivery raced us and inserted first — re-check
     * what it recorded, same idempotent/mismatch logic as above, just
     * resolved via the database's own unique constraint instead of our
     * earlier read (which is inherently racy on its own). */
    const { data: raceWinner } = await supabase
      .from('account_assignments')
      .select('studdy_account_id')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .maybeSingle();

    if (raceWinner && raceWinner.studdy_account_id !== account.id) {
      console.error(
        `mirrorLegacyAllocation: RECONCILIATION MISMATCH (detected via concurrent insert race) — customer ` +
        `${customerId} already has an active assignment for a different account than legacy's current ` +
        `group_name "${groupName}". Not overwriting.`
      );
    }
    return;
  }

  console.error(`mirrorLegacyAllocation: insert error for customer ${customerId}:`, insertError);
}

/**
 * checkout.session.completed — the moment a trial actually starts (or,
 * rarely, someone pays immediately with no trial). This is the ONLY place
 * a brand-new customers row gets created, and creating it is what
 * generates their Paid ID (customers.paid_id defaults to
 * generate_paid_id() the instant the row is inserted).
 */
export async function syncCustomerFromCheckoutSession(supabase, session) {
  const sub = session.subscription;
  const customerObj = session.customer;
  const stripeCustomerId = typeof customerObj === 'string' ? customerObj : customerObj?.id || null;
  const stripeSubscriptionId = typeof sub === 'string' ? sub : sub?.id || null;
  if (!stripeCustomerId || !stripeSubscriptionId) return;

  const existing = await findCustomerByStripeCustomerId(supabase, stripeCustomerId);

  const priceItem = sub?.items?.data?.[0];
  const planType = priceItem?.price?.recurring?.interval === 'year' ? 'Yearly' : 'Monthly';
  const currency = priceItem?.price?.currency?.toUpperCase() || null;

  const billingAddress = session.customer_details?.address;
  const trackingId = session.client_reference_id || null;

  /* CRM-3A — campaign attribution. Looks up the lead_attribution row the
   * browser wrote at the "Start Free Trial" click (api/track-attribution.js),
   * keyed by the SAME trackingId already used for source_lead_id above.
   * No matching row (e.g. a pre-CRM-3A link, or a link with no UTM tag
   * ever seen) is a normal, expected case — every attribution field below
   * simply stays null, exactly like source_lead_id/attribution_method
   * already degrade to 'none' when there's no tracking id at all. */
  const attribution = trackingId ? await findLeadAttribution(supabase, trackingId) : null;

  const customerFields = {
    name: customerObj?.name || session.customer_details?.name || existing?.name || null,
    email: customerObj?.email || session.customer_details?.email || existing?.email || null,
    phone: session.customer_details?.phone || existing?.phone || null,
    country: existing?.country || billingAddress?.country || null,
    state_province: existing?.state_province || billingAddress?.state || null,
    stripe_customer_id: stripeCustomerId,
    stripe_session_id: session.id,
    source_lead_id: existing?.source_lead_id || trackingId,
    attribution_method: existing?.attribution_method || (trackingId ? 'tracking_id' : 'none'),
    attribution_confidence: existing?.attribution_confidence || (trackingId ? 'exact' : 'none'),
    /* First-touch: existing?.field || value — set once, on this
     * customer's very first sync, and never overwritten by a later
     * resync (identical pattern to attribution_method/source_lead_id
     * immediately above). */
    first_utm_source: existing?.first_utm_source || attribution?.first_utm_source || null,
    first_utm_medium: existing?.first_utm_medium || attribution?.first_utm_medium || null,
    first_utm_campaign: existing?.first_utm_campaign || attribution?.first_utm_campaign || null,
    first_utm_content: existing?.first_utm_content || attribution?.first_utm_content || null,
    first_utm_term: existing?.first_utm_term || attribution?.first_utm_term || null,
    first_ghl_contact_id: existing?.first_ghl_contact_id || attribution?.first_ghl_contact_id || null,
    first_ghl_campaign_id: existing?.first_ghl_campaign_id || attribution?.first_ghl_campaign_id || null,
    first_attribution_at: existing?.first_attribution_at || attribution?.first_touched_at || null,
    /* Latest-touch: free to move forward on a later resync — prefers the
     * freshest lead_attribution row, falling back to whatever this
     * customer already had if the ledger has nothing (e.g. a resync via
     * api/refresh-lead.js after the ledger row was never written). */
    latest_utm_source: attribution?.latest_utm_source ?? existing?.latest_utm_source ?? null,
    latest_utm_medium: attribution?.latest_utm_medium ?? existing?.latest_utm_medium ?? null,
    latest_utm_campaign: attribution?.latest_utm_campaign ?? existing?.latest_utm_campaign ?? null,
    latest_utm_content: attribution?.latest_utm_content ?? existing?.latest_utm_content ?? null,
    latest_utm_term: attribution?.latest_utm_term ?? existing?.latest_utm_term ?? null,
    latest_ghl_contact_id: attribution?.latest_ghl_contact_id ?? existing?.latest_ghl_contact_id ?? null,
    latest_ghl_campaign_id: attribution?.latest_ghl_campaign_id ?? existing?.latest_ghl_campaign_id ?? null,
    latest_attribution_at: attribution?.latest_touched_at ?? existing?.latest_attribution_at ?? null,
    updated_at: new Date().toISOString(),
  };

  let customerId;
  if (existing) {
    customerId = existing.id;
    await supabase.from('customers').update(customerFields).eq('id', existing.id);
  } else {
    const { data: inserted, error } = await supabase
      .from('customers')
      /* sales_owner is deliberately NOT set here — it defaults to NULL
       * ("Unassigned"/"Self-service", per CRM-3A's Sales Owner
       * foundation) for every self-service WhatsApp/website customer.
       * Only a future manual admin action (api/admin/customer-sales-owner.js)
       * ever sets it — never inferred from checkout data. */
      .insert({ ...customerFields, lifecycle: 'trial', access_status: 'active' })
      .select('id')
      .single();
    if (error) throw error;
    customerId = inserted.id;
  }

  /* BRIDGE (temporary): mirror whichever account the legacy allocator just
   * chose into the new account_assignments ledger — never independently
   * allocate one here. See mirrorLegacyAllocation() above for the full
   * design. allocate_studdy_seat() (the independent RPC this replaced) is
   * intentionally left defined in the database, untouched, for the real
   * future cutover — it is simply not called from this live path anymore.
   *
   * Deliberately called on EVERY checkout.session.completed sync — for a
   * brand-new customer AND for one that already existed in this table —
   * not gated to only the "just created" branch above. mirrorLegacyAllocation()
   * is already fully idempotent/mismatch-safe (see its own comment), so
   * re-running it costs nothing when a mirror already exists correctly.
   * Gating this call to only newly-created customers would open a real
   * recovery hole: if the mirror insert fails on a customer's first
   * delivery (network blip, etc.) but the customers row itself was
   * created successfully, a Stripe webhook retry of the same event would
   * find the customer already exists the second time around and would
   * never attempt the mirror again — silently leaving that customer's
   * account_assignments row missing forever. Calling this unconditionally
   * makes a transient first-attempt failure self-healing on the very next
   * retry/resync, without ever risking an incorrect overwrite (still
   * governed entirely by mirrorLegacyAllocation()'s insert/no-op/mismatch-
   * log rules). */
  await mirrorLegacyAllocation(supabase, { customerId, sessionId: session.id });

  const subFields = {
    customer_id: customerId,
    stripe_subscription_id: stripeSubscriptionId,
    stripe_price_id: priceItem?.price?.id || null,
    plan_type: planType,
    currency,
    status: sub?.status === 'trialing' ? 'trialing' : 'active',
    trial_start: sub?.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
    trial_end: sub?.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .maybeSingle();

  if (existingSub) {
    await supabase.from('subscriptions').update(subFields).eq('id', existingSub.id);
  } else {
    await supabase.from('subscriptions').insert(subFields);
  }
}

/**
 * invoice.payment_succeeded — a real payment moved. Flips the customer
 * from "trial" to actually paying, and logs the payment_event (keyed on
 * Stripe's own event id, so if Stripe re-delivers the same webhook twice —
 * which it does sometimes by design — we never double-count it).
 */
export async function recordPaymentSucceeded(supabase, event) {
  const invoice = event.data.object;
  if ((invoice.amount_paid ?? 0) <= 0) return; // $0 invoice, not a real payment

  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, customer_id')
    .eq('stripe_subscription_id', subId)
    .maybeSingle();

  if (!subscription) return; // customer not in the new tables yet — nothing to update

  await supabase
    .from('subscriptions')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', subscription.id);

  const { data: customer } = await supabase
    .from('customers')
    .select('lifecycle')
    .eq('id', subscription.customer_id)
    .maybeSingle();

  if (customer && customer.lifecycle === 'trial') {
    await supabase
      .from('customers')
      .update({ lifecycle: 'converted', access_status: 'active', updated_at: new Date().toISOString() })
      .eq('id', subscription.customer_id);
  } else if (customer && customer.lifecycle === 'converted') {
    await supabase
      .from('customers')
      .update({ lifecycle: 'retained', access_status: 'active', updated_at: new Date().toISOString() })
      .eq('id', subscription.customer_id);
  }

  await logPaymentEvent(supabase, event, {
    customer_id: subscription.customer_id,
    subscription_id: subscription.id,
    invoice_id: invoice.id,
    amount: (invoice.amount_paid ?? 0) / 100,
    currency: invoice.currency,
    status: 'succeeded',
  });
}

/** invoice.payment_failed — card declined. Starts the grace period. */
export async function recordPaymentFailed(supabase, event) {
  const invoice = event.data.object;
  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, customer_id')
    .eq('stripe_subscription_id', subId)
    .maybeSingle();

  if (!subscription) return;

  await supabase.from('subscriptions').update({ status: 'past_due', updated_at: new Date().toISOString() }).eq('id', subscription.id);
  await supabase.from('customers').update({ access_status: 'grace', updated_at: new Date().toISOString() }).eq('id', subscription.customer_id);

  await logPaymentEvent(supabase, event, {
    customer_id: subscription.customer_id,
    subscription_id: subscription.id,
    invoice_id: invoice.id,
    /* CODE-REVIEW FIX (round 2, "complete failed-payment ledger
     * fields"): the attempted amount/currency are now retained for
     * operational visibility (e.g. "how much did this failed attempt
     * total"), NOT for revenue — grossRevenue()/netRevenue() in
     * metrics.js only ever sum rows explicitly filtered to
     * event_type='invoice.payment_succeeded', so a failed row having a
     * numeric amount can never leak into a revenue total. amount_due is
     * the invoice's attempted amount for this flow (the amount Stripe
     * tried to collect and failed), distinct from amount_paid, which is
     * 0 on a failed invoice. */
    amount: (invoice.amount_due ?? 0) / 100,
    currency: invoice.currency || null,
    status: 'failed',
  });
}

/** customer.subscription.deleted — subscription actually ended. */
export async function recordSubscriptionEnded(supabase, event) {
  const sub = event.data.object;
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, customer_id')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();

  if (!subscription) return;

  const now = new Date().toISOString();
  await supabase.from('subscriptions').update({ status: 'cancelled', cancelled_at: now, ended_at: now, updated_at: now }).eq('id', subscription.id);
  await supabase.from('customers').update({ lifecycle: 'churned', access_status: 'ended', updated_at: now }).eq('id', subscription.customer_id);

  /* Free their seat in the new ledger so allocate_studdy_seat can hand it
   * to someone else. Same "reporting only, doesn't touch real Studdy AI
   * credentials" boundary as the allocation call above. */
  const { error: releaseError } = await supabase.rpc('release_studdy_seat', { p_customer_id: subscription.customer_id });
  if (releaseError) console.error('release_studdy_seat error:', releaseError);
}

/**
 * CRM-3A — customer.subscription.updated -> the new subscriptions table.
 *
 * Genuine gap this closes: before this function existed, NOTHING synced
 * customer.subscription.updated into the new subscriptions table at
 * all — the legacy leads-table handler in stripe-webhook.js only ever
 * reacted to a pause (sub.status === 'paused'), so subscriptions.status
 * (for anything other than trial-start/payment-succeeded/payment-failed/
 * deleted), cancel_at_period_end, cancel_at, current_period_start, and
 * current_period_end — all real columns since migration 0006 — were
 * never once written by any code path. Without this, "Cancelling at
 * period end" and "Payment due today" can never be proven from real data
 * (see CRM-3A pre-coding report, point 3).
 *
 * Deliberately does NOT create a subscriptions row if one doesn't already
 * exist — that would invent a subscription this codebase has no other
 * evidence for. A brand-new subscriptions row is created in exactly one
 * place: syncCustomerFromCheckoutSession() above, at
 * checkout.session.completed, which always fires before Stripe can ever
 * send a subscription.updated for the same subscription.
 *
 * Does NOT touch customers.lifecycle/access_status or free/release any
 * Studdy seat — that side-effect logic stays solely with
 * recordSubscriptionEnded() (customer.subscription.deleted), which is its
 * own distinct Stripe event and already handles it. A subscription.updated
 * that happens to carry status:'canceled' (edge case — Stripe usually
 * also sends a matching .deleted) only updates this table's own status
 * column here; it can never re-trigger churn/seat-release logic that
 * belongs to .deleted alone.
 *
 * Status vocabulary: Stripe's own words (trialing/active/past_due/unpaid/
 * incomplete/incomplete_expired) are stored as-is, except 'canceled'
 * (Stripe's US spelling) -> 'cancelled', matching this codebase's existing
 * spelling convention everywhere else (see api/_lib/status.js's mapStatus()
 * and recordSubscriptionEnded() above).
 */
const STRIPE_STATUS_MAP = { canceled: 'cancelled' };

function mapSubscriptionStatus(stripeStatus) {
  return STRIPE_STATUS_MAP[stripeStatus] || stripeStatus;
}

export async function syncSubscriptionUpdated(supabase, event) {
  const sub = event.data.object;
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();

  if (!subscription) return; // no subscriptions row yet — nothing to update, never invent one here

  /* Stripe API versions from 2025 onward moved current_period_start/end
   * off the Subscription object onto each subscription item — same
   * fallback order as api/_lib/status.js's resolveNextBilling(). */
  const item = sub?.items?.data?.[0];
  const currentPeriodStart = item?.current_period_start ?? sub?.current_period_start;
  const currentPeriodEnd = item?.current_period_end ?? sub?.current_period_end;
  const toIso = (unixSeconds) => (unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null);

  await supabase
    .from('subscriptions')
    .update({
      status: mapSubscriptionStatus(sub.status),
      trial_start: toIso(sub.trial_start),
      trial_end: toIso(sub.trial_end),
      current_period_start: toIso(currentPeriodStart),
      current_period_end: toIso(currentPeriodEnd),
      cancel_at: toIso(sub.cancel_at),
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id);
}

/**
 * CRM-2A — payment_events ledger completeness (refunds/disputes).
 *
 * `payment_claims` (api/stripe-webhook.js) is untouched by any of this —
 * it remains solely the atomic at-most-once idempotency gate for the
 * legacy total_months_paid increment. These three functions only extend
 * the SAME best-effort, dedup-on-stripe_event_id `payment_events` ledger
 * that recordPaymentSucceeded()/recordPaymentFailed() above already
 * write to, so refunds and disputes stop being single-slot-overwrite
 * fields on `leads` ONLY (which they still also remain, unchanged, for
 * backward compatibility — this is additive, not a replacement).
 *
 * Amount convention, per design review: every payment_events.amount is
 * the raw, positive/absolute Stripe amount (Stripe itself never returns
 * a negative `amount` for a refund or a dispute) — no sign games. There
 * is deliberately no generic `sum(payment_events.amount)` anywhere;
 * metric functions (api/_lib/metrics.js) always scope by `event_type`
 * explicitly (e.g. gross_revenue sums only 'invoice.payment_succeeded'
 * rows), so a failed-payment or dispute row can never silently leak into
 * a revenue total merely because it happens to have a numeric amount.
 *
 * Each function resolves the new-CRM customer_id from the Stripe
 * customer id the caller already has in hand (stripe-webhook.js's
 * findLeadByChargeId() already fetched the underlying charge to find the
 * matching `leads` row, which itself carries `stripe_customer_id` — so no
 * second Stripe API call is needed here). If no matching `customers` row
 * exists yet (e.g. a legacy pre-CRM-1 customer), the ledger write is
 * skipped — exactly the same "don't invent a row, just skip" rule
 * `mirrorLegacyAllocation()` already follows above.
 */

/** refund.created — a refund was issued (e.g. Vish refunding someone manually in Stripe). */
export async function recordRefund(supabase, event, { stripeCustomerId }) {
  const refund = event.data.object;
  const customer = await findCustomerByStripeCustomerId(supabase, stripeCustomerId);
  if (!customer) return; // no new-CRM customer row for this Stripe customer yet — nothing to ledger

  await logPaymentEvent(supabase, event, {
    customer_id: customer.id,
    invoice_id: null,
    payment_intent_id: typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id || null,
    amount: (refund.amount ?? 0) / 100,
    currency: refund.currency || null,
    status: refund.status || 'refunded',
  });
}

/** charge.dispute.created — customer or bank raised a dispute/chargeback. */
export async function recordDisputeCreated(supabase, event, { stripeCustomerId }) {
  const dispute = event.data.object;
  const customer = await findCustomerByStripeCustomerId(supabase, stripeCustomerId);
  if (!customer) return;

  await logPaymentEvent(supabase, event, {
    customer_id: customer.id,
    invoice_id: null,
    amount: (dispute.amount ?? 0) / 100,
    currency: dispute.currency || null,
    status: dispute.status || 'needs_response',
  });
}

/**
 * charge.dispute.closed — a dispute already flagged is now resolved
 * (won/lost/warning_closed/etc). `amount` mirrors the original disputed
 * amount (Stripe's dispute.closed payload carries the same `amount` as
 * the corresponding dispute.created payload for the same dispute id) —
 * the outcome itself lives in `status` and in the full Stripe object
 * already captured verbatim in `raw_metadata` by logPaymentEvent().
 *
 * Correlation with the matching charge.dispute.created row is by
 * Stripe's own stable dispute id — available at `raw_metadata->>'id'` on
 * BOTH rows, since `logPaymentEvent()` stores `event.data.object`
 * (the dispute object itself, whose own `id` field, format `dp_...`, is
 * identical across the created and closed events for the same dispute —
 * distinct from `raw_metadata->>'charge'`, the underlying charge id).
 */
export async function recordDisputeClosed(supabase, event, { stripeCustomerId }) {
  const dispute = event.data.object;
  const customer = await findCustomerByStripeCustomerId(supabase, stripeCustomerId);
  if (!customer) return;

  await logPaymentEvent(supabase, event, {
    customer_id: customer.id,
    invoice_id: null,
    amount: (dispute.amount ?? 0) / 100,
    currency: dispute.currency || null,
    status: dispute.status || null,
  });
}

/**
 * CODE-REVIEW FIX (round 2, "use Stripe event time for
 * payment_events.occurred_at"): Stripe's own `event.created` (unix
 * seconds — the moment Stripe says the event actually occurred) is the
 * authoritative occurred_at, NOT webhook processing time. Processing time
 * can lag behind the real event (retries, delivery delays, a later
 * backfill/replay) and would otherwise corrupt every date-scoped metric
 * that reads payment_events.occurred_at: revenue-by-day, first-payment
 * date, trial_to_paid_14d, refund date, dispute date, any period
 * comparison. Falls back to current time ONLY defensively, if
 * event.created is missing or not a valid positive number — this should
 * never happen for a real Stripe delivery, but must never throw/break
 * the webhook if it somehow does. Historical rows already written with
 * processing-time timestamps are NOT backfilled by this change.
 */
function eventOccurredAt(event) {
  const created = event?.created;
  if (typeof created === 'number' && Number.isFinite(created) && created > 0) {
    return new Date(created * 1000).toISOString();
  }
  return new Date().toISOString();
}

/** Generic Stripe-event logger, deduplicated on Stripe's own event id. */
async function logPaymentEvent(supabase, event, fields) {
  const { error } = await supabase.from('payment_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    occurred_at: eventOccurredAt(event),
    raw_metadata: event.data.object,
    ...fields,
  });
  /* stripe_event_id is unique — Stripe's occasional duplicate delivery of
   * the exact same event hits this conflict (Postgres code 23505) and is
   * silently ignored here, rather than double-counting a payment. */
  if (error && error.code !== '23505') throw error;
}

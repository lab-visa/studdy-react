/**
 * Mirrors real Stripe activity into the NEW CRM tables (customers,
 * subscriptions, payment_events) — running ALONGSIDE the existing
 * `leads`-table sync in sync-checkout-session.js, never replacing it.
 *
 * Deliberately does NOT touch Studdy account/seat assignment. The old
 * `studdy_accounts.active_customer_count` seat system (in
 * sync-checkout-session.js) keeps running completely unchanged — nobody's
 * actual Studdy login is affected by anything in this file. The new,
 * concurrency-safe seat ledger (account_assignments) is Phase 4 work, not
 * this one — see 0007_account_assignments.sql.
 *
 * Every function here is wrapped in try/catch by its caller
 * (api/stripe-webhook.js) — if anything in here fails, the existing
 * `leads` row (and the customer's dashboard/checkout) is never affected.
 * Worst case, a customer's new-CRM row is a few seconds late instead of
 * something breaking for a real paying customer.
 */

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
    updated_at: new Date().toISOString(),
  };

  let customerId;
  if (existing) {
    customerId = existing.id;
    await supabase.from('customers').update(customerFields).eq('id', existing.id);
  } else {
    const { data: inserted, error } = await supabase
      .from('customers')
      .insert({ ...customerFields, lifecycle: 'trial', access_status: 'active' })
      .select('id')
      .single();
    if (error) throw error;
    customerId = inserted.id;
  }

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
}

/** Generic Stripe-event logger, deduplicated on Stripe's own event id. */
async function logPaymentEvent(supabase, event, fields) {
  const { error } = await supabase.from('payment_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    occurred_at: new Date().toISOString(),
    raw_metadata: event.data.object,
    ...fields,
  });
  /* stripe_event_id is unique — Stripe's occasional duplicate delivery of
   * the exact same event hits this conflict (Postgres code 23505) and is
   * silently ignored here, rather than double-counting a payment. */
  if (error && error.code !== '23505') throw error;
}

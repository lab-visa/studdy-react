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

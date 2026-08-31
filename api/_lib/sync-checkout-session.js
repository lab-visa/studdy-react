/**
 * Shared logic for turning a Stripe Checkout Session into a `leads` row.
 * Used by:
 *   - api/stripe-webhook.js, live, every time checkout.session.completed
 *     actually fires from Stripe.
 *   - api/refresh-lead.js, an admin-only manual "resync" — no new payment,
 *     no new subscription — for fixing a specific customer's row after a
 *     code change, without needing them to pay again.
 *
 * IMPORTANT: if this lead already has a Studdy account group assigned,
 * that assignment is kept exactly as-is — this function never claims a
 * second seat for someone who already has one. A seat is only claimed
 * the first time a lead is synced.
 */
import { mapStatus, toDate, resolveNextBilling } from './status.js';

/* How many times to retry the claim below if we lose a race for a seat.
 * Each retry is a fresh read + a fresh conditional write, so this bounds
 * how many concurrent requests can collide on the exact same account
 * before one of them gives up rather than looping forever. 5 is generous
 * for realistic concurrency (a handful of simultaneous checkouts) without
 * risking a runaway loop under pathological contention. */
const MAX_ALLOCATION_ATTEMPTS = 5;

/* Finds a Studdy account/group with a free seat and atomically claims one
 * seat — safe under concurrent Stripe checkouts.
 *
 * Capacity comes ONLY from studdy_accounts.max_capacity — configurable per
 * row via plain SQL (`update studdy_accounts set max_capacity = ... where
 * group_name = ...`), no code change or redeploy needed for it to take
 * effect, since this queries the table fresh on every call. There is no
 * hardcoded fallback number: a row with a missing/invalid max_capacity is
 * skipped and logged as a data-integrity problem rather than silently
 * treated as some default. Groups are tried in group_name order — first
 * one with room wins, same priority as before.
 *
 * CONCURRENCY: a plain "read the count, then write count+1" is racy — two
 * requests can both read the same active_customer_count before either
 * writes, and both then believe they claimed a seat that only existed
 * once. The fix here is an atomic conditional (compare-and-swap) update:
 * `UPDATE studdy_accounts SET active_customer_count = observed + 1 WHERE
 * id = ... AND active_customer_count = observed`. A single UPDATE
 * statement is always executed atomically by Postgres, and its WHERE
 * clause is re-evaluated against the row's current, correctly-locked
 * value at the moment the statement actually runs — so if another request
 * already changed active_customer_count since our read, this WHERE clause
 * simply matches zero rows instead of the two writers silently
 * overwriting each other. That is what makes this safe without a Postgres
 * RPC/migration or an in-memory lock (which would not even be meaningful
 * across separate serverless invocations): the atomicity comes from a
 * single SQL statement, not from anything in this JS process.
 *
 * If we lose that race (0 rows updated), we do NOT return that account —
 * we retry the whole read+claim from a fresh snapshot, which naturally
 * finds the next eligible account (or discovers none are left). A
 * customer only ever receives an account object here if the conditional
 * update actually affected a row — never assumed. */
async function assignStuddyAccount(supabase) {
  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt++) {
    const { data: groups, error } = await supabase
      .from('studdy_accounts')
      .select('*')
      .order('group_name', { ascending: true });

    if (error) throw error;

    const candidate = (groups || []).find((g) => {
      const capacity = g.max_capacity;
      if (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity <= 0) {
        console.error(
          `studdy_accounts row "${g.group_name}" (${g.id}) has a missing or invalid max_capacity ` +
          `(${JSON.stringify(capacity)}) — skipping it for allocation until fixed in the database. ` +
          `This is never silently treated as 7 or any other default.`
        );
        return false;
      }
      return (g.active_customer_count ?? 0) < capacity;
    });
    if (!candidate) return null; // nothing eligible right now, on a fresh read

    const observedCount = candidate.active_customer_count ?? 0;

    const { data: claimed, error: claimError } = await supabase
      .from('studdy_accounts')
      .update({ active_customer_count: observedCount + 1 })
      .eq('id', candidate.id)
      .eq('active_customer_count', observedCount) // atomic compare-and-swap condition
      .select()
      .maybeSingle();

    if (claimError) throw claimError;

    if (claimed) {
      // The conditional UPDATE actually matched and changed this exact
      // row — we genuinely own this seat. Only now is it safe to return.
      return claimed;
    }

    // 0 rows matched: someone else claimed this exact seat between our
    // read and our write. Never return this account — retry from a fresh
    // read instead, which will see the account's true current state.
    console.error(
      `assignStuddyAccount: lost the race for "${candidate.group_name}" (expected ` +
      `active_customer_count=${observedCount}, but it had already changed) — retrying ` +
      `(attempt ${attempt + 1}/${MAX_ALLOCATION_ATTEMPTS}).`
    );
  }

  console.error('assignStuddyAccount: exhausted retry attempts under contention — no seat claimed this call.');
  return null;
}

export async function findLeadBy(supabase, column, value) {
  if (!value) return null;
  const { data } = await supabase.from('leads').select('*').eq(column, value).maybeSingle();
  return data;
}

/**
 * @returns {Promise<string|null>} the lead_id that was created/updated
 */
export async function syncCheckoutSession(stripe, supabase, sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
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

  const billingAddress = session.customer_details?.address;
  const detectedCountry = billingAddress?.country || null;
  const detectedRegion = billingAddress?.state || null;

  const dashboardUrl = `https://studdylab.com/dashboard?session_id=${session.id}`;

  /* Already exists? Find it first — by lead_id (from client_reference_id)
   * or by this exact stripe_session_id — so we know whether to keep their
   * existing Studdy account assignment or claim a fresh one. */
  const existing = (await findLeadBy(supabase, 'lead_id', leadId)) || (await findLeadBy(supabase, 'stripe_session_id', session.id));

  let account = null;
  if (!existing?.group_name) {
    account = await assignStuddyAccount(supabase);
    if (!account) {
      console.error(`No free Studdy account slot for session ${session.id} — add a new group in studdy_accounts.`);
    }
  }

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
    detected_country: existing?.detected_country || detectedCountry,
    detected_region: existing?.detected_region || detectedRegion,
    studdy_email: existing?.studdy_email || account?.studdy_email || null,
    studdy_password: existing?.studdy_password || account?.studdy_password || null,
    studdy_url: existing?.studdy_url || account?.studdy_url || 'https://studdyai.com',
    group_name: existing?.group_name || account?.group_name || null,
    /* Don't downgrade someone who's already progressed past trial (e.g.
     * already paid, or already asked to cancel) back to 'trial_started'. */
    stage:
      existing && ['paid', 'cancel_requested', 'cancelled'].includes(existing.stage)
        ? existing.stage
        : sub?.status === 'trialing'
          ? 'trial_started'
          : 'paid',
    status: mapStatus(sub?.status),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from('leads').update(record).eq('lead_id', existing.lead_id);
    return existing.lead_id;
  }

  if (leadId) {
    const { data } = await supabase
      .from('leads')
      .insert({ lead_id: leadId, ...record, opened_at: new Date().toISOString() })
      .select('lead_id')
      .single();
    return data?.lead_id ?? leadId;
  }

  /* No lead ID at all — someone paid without ever being tracked on the
   * site. Still record the real customer so nothing is lost. */
  const { data } = await supabase
    .from('leads')
    .insert({ ...record, opened_at: new Date().toISOString() })
    .select('lead_id')
    .single();
  return data?.lead_id ?? null;
}

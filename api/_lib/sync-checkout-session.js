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

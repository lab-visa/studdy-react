/**
 * GET /api/admin/customer-detail?id=<customers.id>
 *
 * CRM-3A — full single-customer view for the Customer & Subscription
 * pipeline: identity, plan/billing, campaign attribution (first + latest
 * touch), Sales Owner, lifecycle (stored/calculated/manual, via
 * api/_lib/lifecycle.js), and a complete activity timeline in IST
 * (payment_events + cancellation_requests + the customer's own creation
 * event, merged and sorted).
 *
 * "Expected payment amount and currency" is not a column anywhere in the
 * new-CRM tables (subscriptions has currency but no amount column — see
 * migration 0006) — it is read, read-only, from the legacy `leads` row
 * for the same stripe_customer_id (already populated there by the
 * existing checkout/payment sync), exactly the same safe cross-read
 * pattern api/_lib/sync-customer.js's mirrorLegacyAllocation() already
 * uses for group_name. Never written back to `leads`.
 */
import { getSupabase } from '../_lib/supabase.js';
import { requireAdminSession } from '../_lib/admin-auth.js';
import { withLifecycle } from '../_lib/customer-pipeline.js';
import { formatIstDateTime } from '../_lib/reporting-timezone.js';

const TIMELINE_ROW_CAP = 500;

/** Merges payment_events + cancellation_requests + the customer's own creation into one chronological (oldest-first) IST-labeled timeline. Exported for direct unit testing. */
export function buildActivityTimeline({ customer, paymentEvents, cancellationRequests }) {
  const entries = [];

  if (customer?.created_at) {
    entries.push({
      type: 'customer_created',
      label: 'Trial started / customer created',
      occurred_at: customer.created_at,
    });
  }

  for (const evt of paymentEvents || []) {
    entries.push({
      type: 'payment_event',
      label: evt.event_type,
      amount: evt.amount,
      currency: evt.currency,
      status: evt.status,
      occurred_at: evt.occurred_at,
    });
  }

  for (const req of cancellationRequests || []) {
    entries.push({
      type: 'cancellation_request',
      label: `Cancellation request: ${req.status}`,
      reason: req.reason,
      occurred_at: req.requested_at,
    });
  }

  entries.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
  return entries.map((e) => ({ ...e, occurred_at_ist: formatIstDateTime(e.occurred_at) }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  const adminUser = await requireAdminSession(req, res, supabase);
  if (!adminUser) return;

  const { id } = req.query || {};
  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  try {
    const { data: customer, error: customerError } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const [joinedArr, allCancellationRequestsRes, paymentEventsRes, legacyLeadRes] = await Promise.all([
      withLifecycle(supabase, [customer]),
      supabase
        .from('cancellation_requests')
        .select('*')
        .eq('customer_id', customer.id)
        .order('requested_at', { ascending: false })
        .limit(TIMELINE_ROW_CAP),
      supabase
        .from('payment_events')
        .select('*')
        .eq('customer_id', customer.id)
        .order('occurred_at', { ascending: false })
        .limit(TIMELINE_ROW_CAP),
      customer.stripe_customer_id
        ? supabase
            .from('leads')
            .select('amount, currency, next_billing_date, group_name')
            .eq('stripe_customer_id', customer.stripe_customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (allCancellationRequestsRes.error) throw allCancellationRequestsRes.error;
    if (paymentEventsRes.error) throw paymentEventsRes.error;
    if (legacyLeadRes.error) throw legacyLeadRes.error;

    const { subscription, openCancellationRequest, groupName, lifecycle } = joinedArr[0];
    const legacyLead = legacyLeadRes.data;

    const timeline = buildActivityTimeline({
      customer,
      paymentEvents: paymentEventsRes.data,
      cancellationRequests: allCancellationRequestsRes.data,
    });

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      customer: {
        id: customer.id,
        paid_id: customer.paid_id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        country: customer.country,
        state_province: customer.state_province,
        sales_owner: customer.sales_owner,
        stripe_customer_id: customer.stripe_customer_id,
        attribution: {
          first_touch: {
            utm_source: customer.first_utm_source,
            utm_medium: customer.first_utm_medium,
            utm_campaign: customer.first_utm_campaign,
            utm_content: customer.first_utm_content,
            utm_term: customer.first_utm_term,
            ghl_contact_id: customer.first_ghl_contact_id,
            ghl_campaign_id: customer.first_ghl_campaign_id,
            at: customer.first_attribution_at,
            at_ist: formatIstDateTime(customer.first_attribution_at),
          },
          latest_touch: {
            utm_source: customer.latest_utm_source,
            utm_medium: customer.latest_utm_medium,
            utm_campaign: customer.latest_utm_campaign,
            utm_content: customer.latest_utm_content,
            utm_term: customer.latest_utm_term,
            ghl_contact_id: customer.latest_ghl_contact_id,
            ghl_campaign_id: customer.latest_ghl_campaign_id,
            at: customer.latest_attribution_at,
            at_ist: formatIstDateTime(customer.latest_attribution_at),
          },
        },
      },
      subscription: subscription
        ? {
            stripe_subscription_id: subscription.stripe_subscription_id,
            plan_type: subscription.plan_type,
            currency: subscription.currency,
            status: subscription.status,
            trial_start: subscription.trial_start,
            trial_start_ist: formatIstDateTime(subscription.trial_start),
            trial_end: subscription.trial_end,
            trial_end_ist: formatIstDateTime(subscription.trial_end),
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            current_period_end_ist: formatIstDateTime(subscription.current_period_end),
            cancel_at: subscription.cancel_at,
            cancel_at_period_end: subscription.cancel_at_period_end,
            cancelled_at: subscription.cancelled_at,
            ended_at: subscription.ended_at,
          }
        : null,
      billing: {
        /* Read-only cross-reference to the legacy funnel record — see
         * module comment. Never written back. */
        expected_amount: legacyLead?.amount ?? null,
        expected_currency: legacyLead?.currency ?? subscription?.currency ?? null,
        next_expected_payment_date: subscription?.current_period_end || legacyLead?.next_billing_date || null,
        next_expected_payment_date_ist: formatIstDateTime(subscription?.current_period_end || legacyLead?.next_billing_date || null),
        source: legacyLead ? 'legacy_leads_record' : 'none',
      },
      access: {
        access_status: customer.access_status,
        group_name: groupName,
      },
      cancellation: {
        open_request: openCancellationRequest,
        history: allCancellationRequestsRes.data || [],
      },
      lifecycle,
      activity_timeline: timeline,
      row_cap: TIMELINE_ROW_CAP,
    });
  } catch (err) {
    console.error('admin/customer-detail error:', err);
    return res.status(500).json({ error: 'Customer detail query failed' });
  }
}

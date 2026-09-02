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

/**
 * CHATGPT REVIEW FIX (round 2, "complete activity history"): this used
 * to be a single TIMELINE_ROW_CAP=500 applied to every source query
 * (payment_events, cancellation_requests, account_assignments) — any
 * customer with more than 500 rows in any ONE of those tables silently
 * lost everything past row 500, with no indication in the response
 * that anything was cut. That cap is gone: every source query below is
 * fetched in full for this ONE customer (a single-customer scope is
 * inherently bounded by real subscription/billing history — the same
 * "not the full population" exemption migration 0017's own header
 * comment already gives this endpoint), and the merged, sorted
 * timeline is paginated in memory instead, via timelinePage/
 * timelinePageSize below, so every stored event stays reachable
 * (just possibly on a later page) instead of some silently vanishing.
 */
export const ALLOWED_TIMELINE_PAGE_SIZES = [25, 50, 100];
const DEFAULT_TIMELINE_PAGE_SIZE = 50;

export function parseTimelinePageSize(raw) {
  const n = Number(raw);
  return ALLOWED_TIMELINE_PAGE_SIZES.includes(n) ? n : DEFAULT_TIMELINE_PAGE_SIZE;
}

export function parseTimelinePage(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n;
}

/**
 * Every payment_events.event_type this codebase actually writes
 * (see api/_lib/sync-customer.js), mapped to a plain-language label.
 * An event type not in this map (should not happen, but never a
 * reason to crash a timeline) falls back to the raw Stripe event
 * type string verbatim — see the fallback in the loop below.
 */
const PAYMENT_EVENT_LABELS = {
  'invoice.payment_succeeded': 'Payment succeeded',
  'invoice.payment_failed': 'Payment failed',
  'refund.created': 'Refund issued',
  'charge.dispute.created': 'Dispute opened',
  'charge.dispute.closed': 'Dispute closed',
};

/**
 * Merges every timeline-worthy, DATABASE-BACKED event for a customer
 * into one chronological (newest-first, stable secondary key) IST-
 * labeled activity timeline. Exported for direct unit testing.
 *
 * Every entry here traces to a real stored column — see the CRM-3A
 * Activity Timeline audit for the full mapping of which lifecycle
 * events do and do not have an authoritative source today:
 *   - checkout_started      <- lead_attribution.first_touched_at
 *   - customer_created      <- customers.created_at
 *   - access_assigned/
 *     access_released       <- account_assignments.assigned_at/released_at
 *   - attribution_recorded/
 *     attribution_updated   <- customers.first_attribution_at/latest_attribution_at
 *   - payment_event         <- payment_events (dedup already guaranteed by
 *                              its stripe_event_id unique constraint, see
 *                              logPaymentEvent() in sync-customer.js — a
 *                              Stripe webhook retry can never produce a
 *                              second payment_events row for the same
 *                              event, so it can never produce a duplicate
 *                              timeline entry either)
 *   - cancellation_request  <- cancellation_requests.requested_at
 *   - subscription_cancelled <- subscriptions.cancelled_at (fallback
 *                              ended_at) — see buildCancellationEntry()
 *
 * Deliberately NOT included (no authoritative timestamped source
 * exists today — see the audit): plan/billing changes, cancellation
 * approved/rejected/reversed (schema supports these statuses but no
 * code path anywhere ever writes them), and Sales Owner change
 * history (no audit table — only the current value + a shared,
 * frequently-overwritten updated_at exists). Adding any of these
 * would need new schema/columns, reported rather than silently built.
 */
export function buildActivityTimeline({
  customer,
  subscription,
  paymentEvents,
  cancellationRequests,
  leadAttribution,
  accountAssignments,
}) {
  const entries = [];

  if (leadAttribution?.first_touched_at) {
    entries.push({
      type: 'checkout_started',
      label: 'Checkout started',
      source: 'lead_attribution.first_touched_at',
      occurred_at: leadAttribution.first_touched_at,
      sortAt: leadAttribution.first_touched_at,
    });
  }

  if (customer?.created_at) {
    entries.push({
      type: 'customer_created',
      label: 'Trial started / customer created',
      source: 'customers.created_at',
      occurred_at: customer.created_at,
      sortAt: customer.created_at,
    });
  }

  for (const a of accountAssignments || []) {
    if (a.assigned_at) {
      entries.push({
        type: 'access_assigned',
        label: `Access assigned${a.group_name ? ` — ${a.group_name}` : ''}`,
        source: 'account_assignments.assigned_at',
        occurred_at: a.assigned_at,
        sortAt: a.assigned_at,
      });
    }
    if (a.released_at) {
      entries.push({
        type: 'access_released',
        label: `Access released${a.group_name ? ` — ${a.group_name}` : ''}`,
        source: 'account_assignments.released_at',
        occurred_at: a.released_at,
        sortAt: a.released_at,
      });
    }
  }

  if (customer?.first_attribution_at) {
    entries.push({
      type: 'attribution_recorded',
      label: 'Campaign attribution recorded (first touch)',
      detail: customer.first_utm_source || customer.first_utm_campaign
        ? [customer.first_utm_source, customer.first_utm_campaign].filter(Boolean).join(' / ')
        : null,
      source: 'customers.first_attribution_at',
      occurred_at: customer.first_attribution_at,
      sortAt: customer.first_attribution_at,
    });
  }
  if (customer?.latest_attribution_at && customer.latest_attribution_at !== customer.first_attribution_at) {
    entries.push({
      type: 'attribution_updated',
      label: 'Campaign attribution updated (latest touch)',
      detail: customer.latest_utm_source || customer.latest_utm_campaign
        ? [customer.latest_utm_source, customer.latest_utm_campaign].filter(Boolean).join(' / ')
        : null,
      source: 'customers.latest_attribution_at',
      occurred_at: customer.latest_attribution_at,
      sortAt: customer.latest_attribution_at,
    });
  }

  for (const evt of paymentEvents || []) {
    entries.push({
      type: 'payment_event',
      label: PAYMENT_EVENT_LABELS[evt.event_type] || evt.event_type,
      source: `payment_events (${evt.event_type})`,
      amount: evt.amount,
      currency: evt.currency,
      status: evt.status,
      occurred_at: evt.occurred_at,
      sortAt: evt.occurred_at,
    });
  }

  for (const req of cancellationRequests || []) {
    entries.push({
      type: 'cancellation_request',
      label: `Cancellation request: ${req.status}`,
      source: 'cancellation_requests.requested_at',
      reason: req.reason,
      occurred_at: req.requested_at,
      sortAt: req.requested_at,
    });
  }

  const cancellationEntry = buildCancellationEntry(subscription);
  if (cancellationEntry) entries.push(cancellationEntry);

  /* Newest first, per CRM-3A's explicit ordering requirement. `type` is
   * the stable secondary key: for two entries that happen to share the
   * exact same timestamp (rare, but possible — e.g. cancelled_at and a
   * same-instant payment_events row), sorting also by `type` means the
   * order is always the same across requests, never re-shuffled. */
  entries.sort((a, b) => {
    const diff = new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime();
    if (diff !== 0) return diff;
    return a.type < b.type ? -1 : a.type > b.type ? 1 : 0;
  });

  return entries.map(({ sortAt: _sortAt, ...e }) => ({ ...e, occurred_at_ist: e.occurred_at ? formatIstDateTime(e.occurred_at) : null }));
}

/**
 * The specific bug this round fixes: a customer whose subscription
 * status is 'cancelled' had NO timeline entry at all showing when
 * that happened, even though subscriptions.cancelled_at/ended_at are
 * real, dedicated, reliably-written columns (see recordSubscriptionEnded()
 * in api/_lib/sync-customer.js) — never derived from the shared,
 * frequently-overwritten customers.updated_at or subscriptions.updated_at.
 *
 * Priority: cancelled_at (the actual moment recordSubscriptionEnded()
 * ran, set from Stripe's own event time) is the primary source;
 * ended_at is written in the exact same statement as a same-value
 * fallback, kept here only for the rare case a row was written by
 * some other path that set one but not the other. `cancel_at` (a
 * FUTURE-scheduled cancellation instant, set by syncSubscriptionUpdated()
 * on customer.subscription.updated) is deliberately NEVER used as the
 * displayed cancellation date here — it is a schedule, not a
 * completed fact, and using it would misrepresent an event that may
 * not have actually happened yet as something that already did.
 *
 * If status is 'cancelled' but BOTH cancelled_at and ended_at are
 * null (a genuinely possible historical/edge case — e.g. a row
 * written before this column was populated, or by any future code
 * path that sets status='cancelled' without setting either timestamp),
 * this returns an entry with occurred_at: null and a label that says
 * so explicitly, rather than inventing a date from updated_at or any
 * other unrelated field. Sort position for this null-date case falls
 * back to the subscription row's own updated_at, used ONLY to decide
 * where the entry lands in the list — it is never returned as, or
 * displayed as, the cancellation date itself.
 */
export function buildCancellationEntry(subscription) {
  if (!subscription || subscription.status !== 'cancelled') return null;

  const occurredAt = subscription.cancelled_at || subscription.ended_at || null;
  if (occurredAt) {
    return {
      type: 'subscription_cancelled',
      label: 'Subscription cancelled',
      source: subscription.cancelled_at ? 'subscriptions.cancelled_at' : 'subscriptions.ended_at',
      occurred_at: occurredAt,
      sortAt: occurredAt,
    };
  }

  return {
    type: 'subscription_cancelled',
    label: 'Cancelled — exact date unavailable',
    source: null,
    occurred_at: null,
    sortAt: subscription.updated_at || subscription.created_at || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  const adminUser = await requireAdminSession(req, res, supabase);
  if (!adminUser) return;

  const q = req.query || {};
  const { id } = q;
  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  try {
    const { data: customer, error: customerError } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const [joinedArr, allCancellationRequestsRes, paymentEventsRes, legacyLeadRes, leadAttributionRes, allAssignmentsRes] = await Promise.all([
      withLifecycle(supabase, [customer]),
      supabase
        .from('cancellation_requests')
        .select('*')
        .eq('customer_id', customer.id)
        .order('requested_at', { ascending: false }),
      supabase
        .from('payment_events')
        .select('*')
        .eq('customer_id', customer.id)
        .order('occurred_at', { ascending: false }),
      customer.stripe_customer_id
        ? supabase
            .from('leads')
            .select('amount, currency, next_billing_date, group_name')
            .eq('stripe_customer_id', customer.stripe_customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      /* CRM-3A Activity Timeline audit — "Checkout started" entry.
       * lead_attribution isn't linked to a customer by a foreign key,
       * only by the same lead_id used as customers.source_lead_id
       * (see migration 0016's own comment) — no row is a normal,
       * expected case (a pre-CRM-3A customer, or one with no tracked
       * link at all), not an error. */
      customer.source_lead_id
        ? supabase.from('lead_attribution').select('first_touched_at').eq('lead_id', customer.source_lead_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      /* ALL account_assignments rows (any status), not just the
       * active one withLifecycle() already resolved above — the
       * timeline needs the full assign/release HISTORY, not just the
       * current state. */
      supabase
        .from('account_assignments')
        .select('studdy_account_id, assigned_at, released_at, status')
        .eq('customer_id', customer.id)
        .order('assigned_at', { ascending: false }),
    ]);

    if (allCancellationRequestsRes.error) throw allCancellationRequestsRes.error;
    if (paymentEventsRes.error) throw paymentEventsRes.error;
    if (legacyLeadRes.error) throw legacyLeadRes.error;
    if (leadAttributionRes.error) throw leadAttributionRes.error;
    if (allAssignmentsRes.error) throw allAssignmentsRes.error;

    const { subscription, openCancellationRequest, groupName, lifecycle } = joinedArr[0];
    const legacyLead = legacyLeadRes.data;

    const assignmentRows = allAssignmentsRes.data || [];
    const accountIds = [...new Set(assignmentRows.map((a) => a.studdy_account_id).filter(Boolean))];
    let accountNamesById = new Map();
    if (accountIds.length) {
      // Bounded by accountIds.length itself (an IN-list) — no separate
      // row cap needed or meaningful here.
      const { data: accounts, error: accountsError } = await supabase
        .from('studdy_accounts')
        .select('id, group_name')
        .in('id', accountIds);
      if (accountsError) throw accountsError;
      accountNamesById = new Map((accounts || []).map((a) => [a.id, a.group_name]));
    }
    const accountAssignments = assignmentRows.map((a) => ({ ...a, group_name: accountNamesById.get(a.studdy_account_id) || null }));

    const fullTimeline = buildActivityTimeline({
      customer,
      subscription,
      paymentEvents: paymentEventsRes.data,
      cancellationRequests: allCancellationRequestsRes.data,
      leadAttribution: leadAttributionRes.data,
      accountAssignments,
    });

    // In-memory pagination of the already-sorted, already-complete
    // (no per-source row cap — see the module comment above) timeline.
    // A single customer's full activity history is bounded by real
    // subscription/billing volume, not by an attacker-controlled
    // population size, so building it in full before paginating is
    // safe here in a way it would not be for the customer LIST view
    // (see migration 0017 / api/admin/customers.js for that scalable,
    // server-side-paginated case).
    const timelinePage = parseTimelinePage(q.timelinePage);
    const timelinePageSize = parseTimelinePageSize(q.timelinePageSize);
    const timelineTotalCount = fullTimeline.length;
    const timelineTotalPages = timelineTotalCount === 0 ? 0 : Math.ceil(timelineTotalCount / timelinePageSize);
    const timelineStart = (timelinePage - 1) * timelinePageSize;
    const timeline = fullTimeline.slice(timelineStart, timelineStart + timelinePageSize);

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
      timeline_page: timelinePage,
      timeline_page_size: timelinePageSize,
      timeline_total_count: timelineTotalCount,
      timeline_total_pages: timelineTotalPages,
      timeline_has_previous: timelinePage > 1,
      timeline_has_next: timelineTotalPages > 0 && timelinePage < timelineTotalPages,
    });
  } catch (err) {
    console.error('admin/customer-detail error:', err);
    return res.status(500).json({ error: 'Customer detail query failed' });
  }
}

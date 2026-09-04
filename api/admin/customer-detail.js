/**
 * GET /api/admin/customer-detail?id=<customers.id>
 *
 * CRM-3A — full single-customer view for the Customer & Subscription
 * pipeline: identity, plan/billing, campaign attribution (first + latest
 * touch), Sales Owner, lifecycle (stored/calculated/manual, via
 * api/_lib/lifecycle.js), and an activity timeline in IST, merged and
 * paginated entirely server-side by migration 0018's
 * search_customer_activity_timeline() function (see that file's own
 * header comment for the full design).
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
 * CHATGPT REVIEW FIX (round 3, "genuine server-side pagination"): round
 * 2 removed the silent TIMELINE_ROW_CAP=500 but still fetched every
 * payment_events/cancellation_requests/account_assignments row for this
 * customer into Node on every request and paginated the merged array in
 * memory — that in-memory fetch-everything step (buildActivityTimeline(),
 * buildCancellationEntry(), and the parallel full-table queries that fed
 * them) is now GONE. This endpoint asks migration 0018's
 * search_customer_activity_timeline() Postgres function for exactly one
 * bounded, already-merged, already-sorted page of events per request —
 * the API layer never holds more than timelinePageSize rows in memory at
 * once, and pagination is cursor/keyset-based (timelineCursorSortAt +
 * timelineCursorEventKey), not OFFSET or an in-memory page slice. See
 * 0018_customer_activity_timeline.sql's own header comment for the full
 * rationale (why cursor pagination, the stable event_key design, the
 * marker-row total_count/has_more technique).
 */
export const ALLOWED_TIMELINE_PAGE_SIZES = [25, 50, 100];
const DEFAULT_TIMELINE_PAGE_SIZE = 50;

export function parseTimelinePageSize(raw) {
  const n = Number(raw);
  return ALLOWED_TIMELINE_PAGE_SIZES.includes(n) ? n : DEFAULT_TIMELINE_PAGE_SIZE;
}

/**
 * A malformed or partial cursor (only one of the pair given, an
 * unparseable timestamp, an empty key) is treated as NO cursor at all —
 * start over from the newest event — never a crash. This is
 * belt-and-braces with the SAME defensive handling
 * search_customer_activity_timeline() itself does for a partial cursor
 * (see 0018's own header comment) — a well-behaved API layer should
 * never actually send a malformed cursor, but neither layer trusts the
 * other alone to be the only caller.
 */
export function parseTimelineCursor(query) {
  const rawSortAt = query?.timelineCursorSortAt;
  const rawEventKey = query?.timelineCursorEventKey;
  if (!rawSortAt || !rawEventKey || typeof rawEventKey !== 'string') {
    return { sortAt: null, eventKey: null };
  }
  const parsed = new Date(rawSortAt);
  if (Number.isNaN(parsed.getTime())) {
    return { sortAt: null, eventKey: null };
  }
  return { sortAt: parsed.toISOString(), eventKey: rawEventKey };
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

    const [joinedArr, allCancellationRequestsRes, legacyLeadRes] = await Promise.all([
      withLifecycle(supabase, [customer]),
      supabase
        .from('cancellation_requests')
        .select('*')
        .eq('customer_id', customer.id)
        .order('requested_at', { ascending: false }),
      customer.stripe_customer_id
        ? supabase
            .from('leads')
            .select('amount, currency, next_billing_date, group_name')
            .eq('stripe_customer_id', customer.stripe_customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (allCancellationRequestsRes.error) throw allCancellationRequestsRes.error;
    if (legacyLeadRes.error) throw legacyLeadRes.error;

    const { subscription, openCancellationRequest, groupName, lifecycle } = joinedArr[0];
    const legacyLead = legacyLeadRes.data;

    // Genuine server-side, cursor-paginated Activity Timeline — see
    // migration 0018_customer_activity_timeline.sql's own header
    // comment. This call never fetches more than timelinePageSize rows;
    // the merge/sort/pagination of every source table (payment_events,
    // cancellation_requests, account_assignments, lead_attribution,
    // the customer/subscription rows themselves) happens entirely in
    // Postgres.
    const timelinePageSize = parseTimelinePageSize(q.timelinePageSize);
    const { sortAt: timelineCursorSortAt, eventKey: timelineCursorEventKey } = parseTimelineCursor(q);

    const { data: timelineRowsRaw, error: timelineError } = await supabase.rpc('search_customer_activity_timeline', {
      p_customer_id: customer.id,
      p_page_size: timelinePageSize,
      p_cursor_sort_at: timelineCursorSortAt,
      p_cursor_event_key: timelineCursorEventKey,
    });
    if (timelineError) throw timelineError;

    const timelineRows = timelineRowsRaw || [];
    // Same "marker row" technique search_customer_pipeline (migration
    // 0017) established: a cursor past the last real event still
    // returns exactly one row, every event field null, so total_count/
    // has_more are always readable in the same round trip. Detect and
    // drop it here rather than showing a single all-blank entry.
    const isMarkerOnly = timelineRows.length === 1 && timelineRows[0].event_key === null;
    const timelineEntries = isMarkerOnly ? [] : timelineRows;
    const timelineTotalCount = timelineRows.length ? Number(timelineRows[0].total_count) : 0;
    const timelineHasMore = timelineRows.length ? Boolean(timelineRows[0].has_more) : false;
    // has_previous is knowable purely from whether THIS request carried
    // a (valid) cursor — a request with no cursor is always the first
    // page, one with a cursor is always some later page.
    const timelineHasPrevious = timelineCursorSortAt !== null && timelineCursorEventKey !== null;
    const lastEntry = timelineEntries.length ? timelineEntries[timelineEntries.length - 1] : null;

    const timeline = timelineEntries.map((r) => ({
      type: r.event_type,
      label: r.label,
      detail: r.detail ?? null,
      source: r.source ?? null,
      amount: r.amount !== null && r.amount !== undefined ? Number(r.amount) : null,
      currency: r.currency ?? null,
      status: r.status ?? null,
      reason: r.reason ?? null,
      occurred_at: r.occurred_at,
      occurred_at_ist: r.occurred_at ? formatIstDateTime(r.occurred_at) : null,
      event_key: r.event_key,
    }));

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
      timeline_page_size: timelinePageSize,
      timeline_total_count: timelineTotalCount,
      timeline_has_previous: timelineHasPrevious,
      timeline_has_next: timelineHasMore,
      // Opaque to the frontend — pass BOTH fields back verbatim as
      // timelineCursorSortAt/timelineCursorEventKey to fetch the next
      // page. null when there is no next page. Built from the RAW RPC
      // row's own sort_at (the internal ordering key, always non-null —
      // see 0018's own header comment), not the possibly-null display
      // `occurred_at`, so a next-page request is correct even when the
      // last row on this page is a "Cancelled — exact date unavailable"
      // entry.
      timeline_next_cursor:
        timelineHasMore && lastEntry ? { sort_at: lastEntry.sort_at, event_key: lastEntry.event_key } : null,
    });
  } catch (err) {
    console.error('admin/customer-detail error:', err);
    return res.status(500).json({ error: 'Customer detail query failed' });
  }
}

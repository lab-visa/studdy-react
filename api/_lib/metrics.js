/**
 * CRM-2A — authoritative metric/query layer.
 *
 * Every function here is the ONE place a given metric's definition lives,
 * per the approved Metric Contract (design review, Sep 2026). No React
 * component, dashboard page, or future Mr. Snoofy tool computes its own
 * SQL/aggregation for any of these — they all call through here.
 *
 * Style: plain supabase-js `.from()` queries + JS-side aggregation,
 * matching api/admin/reconciliation.js's existing pattern exactly (no new
 * Postgres functions, no migration needed — current data volumes are
 * small, same justification reconciliation.js already documents).
 *
 * CODE-REVIEW FIX (round 2, "silent metric row cap"): earlier this file
 * fetched every authoritative KPI with a single `.limit(METRIC_ROW_CAP)`
 * call — once the matching population exceeded that cap, results would
 * silently truncate and every downstream number (Dashboard, later Mr.
 * Snoofy) would quietly go wrong. Fixed two ways, chosen per metric:
 *   - a metric that is a pure COUNT of matching rows (trial_started,
 *     active_trial, active_paid_customer, successful_payment,
 *     failed_payment, cancellation_requested, cancelled_customer) uses
 *     Postgres's own exact COUNT(*) via supabase-js's
 *     `{ count: 'exact', head: true }` — no row transfer, no cap of any
 *     kind, full stop.
 *   - a metric that needs actual ROW DATA (sums by currency, the
 *     trial_to_paid_14d cohort/first-payment population, open-dispute
 *     correlation, churn's per-row voluntary/involuntary classification,
 *     funnel totals) fully paginates via fetchAllRows()/.range() below,
 *     looping until every matching row has been fetched — however many
 *     pages that takes. No DB-side GROUP BY aggregate is used for the sum
 *     functions because that would require a new Postgres function/view,
 *     which is explicitly out of CRM-2A's approved, migration-free scope
 *     — full pagination is the documented fallback for that case.
 * See fetchAllRows()'s own comment for why deterministic ORDER BY is
 * required for this to be correct, not just fast.
 *
 * Every result is tagged `type`:
 *   - 'event_period': counts/sums events whose OWN timestamp falls in the
 *     requested range, independent of any other event's timing.
 *   - 'cohort': groups entities by one defining event's date (trial
 *     start), then measures that group's eventual outcome regardless of
 *     when the outcome happens.
 *   - 'current_state': a live snapshot, no date range.
 * Two 'event_period' results must NEVER be divided by each other to
 * fabricate a rate — see trialToPaid14d() for the one correct cohort
 * calculation this contract defines. There is deliberately no
 * `churn_rate` export anywhere in this file — only event-period churn
 * COUNTS ship in CRM-2A (see churn() below).
 *
 * Currency: revenue-shaped results are always `by_currency` objects,
 * never a single blended number — see grossRevenue()/refundAmount()/
 * netRevenue(). No function anywhere sums payment_events.amount across
 * event types or currencies.
 */
import { todayReportingDay } from './reporting-timezone.js';

const TRIAL_TO_PAID_WINDOW_DAYS = 14;

let METRIC_PAGE_SIZE = 1000;

/**
 * Fully paginates a supabase-js query via .range(), accumulating EVERY
 * matching row — never an arbitrary cap. `buildBaseQuery` must be a
 * function that returns a FRESH, fully-filtered and deterministically
 * ORDERED query each time it's invoked (with .range()/.limit() NOT yet
 * applied) — this helper applies .range() itself, once per page, and
 * keeps paging until a page comes back smaller than the page size.
 *
 * Deterministic ordering (tie-broken by a column unique per row, e.g. a
 * uuid primary key) is required for this to be CORRECT, not just fast:
 * without it, Postgres does not guarantee stable row order across
 * repeated queries with different OFFSETs, and rows could be silently
 * skipped or duplicated across a page boundary. Every caller below orders
 * by the relevant timestamp plus a unique tiebreaker column (or, for
 * site_traffic_daily which has no single id column, its full composite
 * primary key) for exactly this reason.
 */
async function fetchAllRows(buildBaseQuery) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await buildBaseQuery().range(offset, offset + METRIC_PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < METRIC_PAGE_SIZE) break;
    offset += METRIC_PAGE_SIZE;
  }
  return rows;
}

/**
 * TEST-ONLY: override the pagination page size so tests can prove
 * multi-page correctness (a real page boundary actually crossed) without
 * needing to seed thousands of rows. Never called from production code —
 * only test/cases/metrics.test.mjs uses this, and always resets it
 * afterward so it can never leak into another test's expectations.
 */
export function __setMetricPageSizeForTests(n) {
  METRIC_PAGE_SIZE = n;
}
export function __resetMetricPageSizeForTests() {
  METRIC_PAGE_SIZE = 1000;
}

/** customer_id -> earliest 'invoice.payment_succeeded' occurred_at (ISO string), across ALL matching rows, however many pages. */
async function fetchFirstSuccessfulPaymentByCustomer(supabase) {
  const rows = await fetchAllRows(() =>
    supabase
      .from('payment_events')
      .select('customer_id, occurred_at, id')
      .eq('event_type', 'invoice.payment_succeeded')
      .not('customer_id', 'is', null)
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true })
  );

  const firstByCustomer = new Map();
  for (const row of rows) {
    if (!firstByCustomer.has(row.customer_id)) firstByCustomer.set(row.customer_id, row.occurred_at);
  }
  return firstByCustomer;
}

/* ───────────────────────── trial / conversion ───────────────────────── */

/** event-period: exact COUNT of customers rows created (trial started) in [from, to). No cap — Postgres COUNT(*), never a fetched/truncated row set. */
export async function trialStarted(supabase, { from, to } = {}) {
  let q = supabase.from('customers').select('id', { count: 'exact', head: true });
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lt('created_at', to);
  const { count, error } = await q;
  if (error) throw error;
  return { metric: 'trial_started', type: 'event_period', from: from ?? null, to: to ?? null, count: count ?? 0 };
}

/** current-state: exact COUNT of customers currently in trial with active access. */
export async function activeTrial(supabase) {
  const { count, error } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('lifecycle', 'trial')
    .eq('access_status', 'active');
  if (error) throw error;
  return { metric: 'active_trial', type: 'current_state', count: count ?? 0 };
}

/**
 * cohort: of trials that STARTED in [cohortFrom, cohortTo), what
 * percentage received their FIRST-EVER successful payment within
 * TRIAL_TO_PAID_WINDOW_DAYS days of trial start. This is the approved
 * headline conversion KPI — see the design review corrections:
 *   - numerator/denominator are NOT customers.lifecycle (which moves on
 *     to 'churned' and would wrongly zero out a real past conversion) —
 *     "ever converted" is determined from the payment_events ledger.
 *   - a cohort only gets a published percentage once its full 14-day
 *     window has elapsed (still_maturing=false); a still-maturing cohort
 *     returns conversion_pct: null and must never silently depress a
 *     blended headline number.
 *   - a customer who converted (per lifecycle) but has NO payment_events
 *     row (a legacy, pre-ledger customer) cannot be dated precisely and
 *     is excluded from both numerator and denominator, reported
 *     separately as legacy_excluded — never fabricated a date.
 * The cohort population itself is fully paginated (fetchAllRows) — a
 * cohort window can never silently drop customers past a row cap.
 */
export async function trialToPaid14d(supabase, { cohortFrom, cohortTo }) {
  if (!cohortFrom || !cohortTo) {
    throw new Error('trialToPaid14d requires an explicit cohortFrom/cohortTo range');
  }

  const cohortCustomers = await fetchAllRows(() =>
    supabase
      .from('customers')
      .select('id, created_at, lifecycle')
      .gte('created_at', cohortFrom)
      .lt('created_at', cohortTo)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
  );

  const firstByCustomer = await fetchFirstSuccessfulPaymentByCustomer(supabase);

  const windowMs = TRIAL_TO_PAID_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const cohortEndMs = new Date(cohortTo).getTime();
  const stillMaturing = Date.now() < cohortEndMs + windowMs;

  let measurableCohortSize = 0;
  let convertedWithin14d = 0;
  const legacyExcludedIds = [];

  for (const c of cohortCustomers) {
    const firstPaidAt = firstByCustomer.get(c.id);

    if (!firstPaidAt) {
      if (c.lifecycle === 'converted' || c.lifecycle === 'retained' || c.lifecycle === 'churned') {
        // Ever converted (per lifecycle) but no dated payment_events row —
        // legacy/pre-ledger customer. Exclude entirely, never guess a date.
        legacyExcludedIds.push(c.id);
        continue;
      }
      // Genuinely never converted as of now — a real, dated non-conversion.
      measurableCohortSize += 1;
      continue;
    }

    measurableCohortSize += 1;
    const trialStartMs = new Date(c.created_at).getTime();
    const paidMs = new Date(firstPaidAt).getTime();
    if (paidMs - trialStartMs <= windowMs) convertedWithin14d += 1;
  }

  return {
    metric: 'trial_to_paid_14d',
    type: 'cohort',
    cohort_from: cohortFrom,
    cohort_to: cohortTo,
    window_days: TRIAL_TO_PAID_WINDOW_DAYS,
    still_maturing: stillMaturing,
    measurable_cohort_size: measurableCohortSize,
    converted_within_14d: convertedWithin14d,
    conversion_pct: !stillMaturing && measurableCohortSize > 0
      ? Number(((convertedWithin14d / measurableCohortSize) * 100).toFixed(2))
      : null,
    legacy_excluded_count: legacyExcludedIds.length,
    legacy_excluded_customer_ids: legacyExcludedIds,
    note: stillMaturing
      ? 'still maturing — this cohort’s full 14-day observation window has not elapsed yet; excluded from the headline KPI, must be shown separately, never blended into a mature-cohort percentage'
      : 'mature cohort — eligible for the headline trial_to_paid_14d KPI',
  };
}

/** event-period: customers whose FIRST-EVER successful payment fell in [from, to). Never a renewal. Built from the fully-paginated first-payment map above — no cap. */
export async function newPaidCustomer(supabase, { from, to } = {}) {
  const firstByCustomer = await fetchFirstSuccessfulPaymentByCustomer(supabase);
  let count = 0;
  // occurred_at comes back from the DB as a timestamptz — the pg driver
  // parses that into a JS Date, not an ISO string. Comparing a Date
  // directly against an ISO-string boundary with < / >= would coerce via
  // Date.prototype.toString() (not toISOString()), silently producing
  // wrong results — so every side is normalized to epoch ms first.
  const fromMs = from ? new Date(from).getTime() : null;
  const toMs = to ? new Date(to).getTime() : null;
  for (const occurredAt of firstByCustomer.values()) {
    const occurredMs = new Date(occurredAt).getTime();
    if (fromMs !== null && occurredMs < fromMs) continue;
    if (toMs !== null && occurredMs >= toMs) continue;
    count += 1;
  }
  return { metric: 'new_paid_customer', type: 'event_period', from: from ?? null, to: to ?? null, count };
}

/** current-state: exact COUNT of customers currently paying with active access. */
export async function activePaidCustomer(supabase) {
  const { count, error } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .in('lifecycle', ['converted', 'retained'])
    .eq('access_status', 'active');
  if (error) throw error;
  return { metric: 'active_paid_customer', type: 'current_state', count: count ?? 0 };
}

/* ───────────────────────────── payments ─────────────────────────────── */

/** event-period: exact COUNT of successful-payment ledger rows in [from, to). */
export async function successfulPayment(supabase, { from, to } = {}) {
  let q = supabase.from('payment_events').select('id', { count: 'exact', head: true }).eq('event_type', 'invoice.payment_succeeded');
  if (from) q = q.gte('occurred_at', from);
  if (to) q = q.lt('occurred_at', to);
  const { count, error } = await q;
  if (error) throw error;
  return { metric: 'successful_payment', type: 'event_period', from: from ?? null, to: to ?? null, count: count ?? 0 };
}

/** event-period: exact COUNT of failed-payment ledger rows in [from, to). */
export async function failedPayment(supabase, { from, to } = {}) {
  let q = supabase.from('payment_events').select('id', { count: 'exact', head: true }).eq('event_type', 'invoice.payment_failed');
  if (from) q = q.gte('occurred_at', from);
  if (to) q = q.lt('occurred_at', to);
  const { count, error } = await q;
  if (error) throw error;
  return { metric: 'failed_payment', type: 'event_period', from: from ?? null, to: to ?? null, count: count ?? 0 };
}

/** Fully paginated — needs the actual amount/currency of every matching row, so a COUNT alone isn't enough. No DB-side SUM/GROUP BY available without a new Postgres function, which is out of CRM-2A's migration-free scope. */
async function sumAmountByCurrency(supabase, eventType, { from, to } = {}) {
  const rows = await fetchAllRows(() => {
    let q = supabase
      .from('payment_events')
      .select('amount, currency, occurred_at, id')
      .eq('event_type', eventType)
      .not('amount', 'is', null)
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true });
    if (from) q = q.gte('occurred_at', from);
    if (to) q = q.lt('occurred_at', to);
    return q;
  });

  const byCurrency = {};
  for (const row of rows) {
    const currency = row.currency || 'unknown';
    byCurrency[currency] = (byCurrency[currency] || 0) + Number(row.amount);
  }
  return byCurrency;
}

/** event-period, BY CURRENCY: sum of 'invoice.payment_succeeded' amounts only. Never blended across currencies. */
export async function grossRevenue(supabase, range = {}) {
  const byCurrency = await sumAmountByCurrency(supabase, 'invoice.payment_succeeded', range);
  return { metric: 'gross_revenue', type: 'event_period', from: range.from ?? null, to: range.to ?? null, by_currency: byCurrency };
}

/** event-period, BY CURRENCY: sum of 'refund.created' amounts only. */
export async function refundAmount(supabase, range = {}) {
  const byCurrency = await sumAmountByCurrency(supabase, 'refund.created', range);
  return { metric: 'refund_amount', type: 'event_period', from: range.from ?? null, to: range.to ?? null, by_currency: byCurrency };
}

/** event-period, BY CURRENCY: gross_revenue - refund_amount, currency by currency. Never a blended total. */
export async function netRevenue(supabase, range = {}) {
  const gross = (await grossRevenue(supabase, range)).by_currency;
  const refunds = (await refundAmount(supabase, range)).by_currency;
  const currencies = new Set([...Object.keys(gross), ...Object.keys(refunds)]);
  const byCurrency = {};
  for (const currency of currencies) {
    byCurrency[currency] = (gross[currency] || 0) - (refunds[currency] || 0);
  }
  return { metric: 'net_revenue', type: 'event_period', from: range.from ?? null, to: range.to ?? null, by_currency: byCurrency };
}

/**
 * current-state: disputes with a 'charge.dispute.created' row but no
 * matching 'charge.dispute.closed' row, correlated by Stripe's own stable
 * dispute id (raw_metadata->>'id' on both rows — see
 * sync-customer.js's recordDisputeClosed() for why this is the right
 * key, not the underlying charge id). Both sides are fully paginated —
 * an open dispute must never be silently dropped just because the total
 * dispute history exceeds one page.
 */
export async function openDispute(supabase) {
  const created = await fetchAllRows(() =>
    supabase
      .from('payment_events')
      .select('raw_metadata, customer_id, amount, currency, occurred_at, id')
      .eq('event_type', 'charge.dispute.created')
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true })
  );

  const closed = await fetchAllRows(() =>
    supabase
      .from('payment_events')
      .select('raw_metadata, occurred_at, id')
      .eq('event_type', 'charge.dispute.closed')
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true })
  );

  const closedDisputeIds = new Set(closed.map((r) => r.raw_metadata?.id).filter(Boolean));
  const open = created.filter((r) => {
    const disputeId = r.raw_metadata?.id;
    return disputeId && !closedDisputeIds.has(disputeId);
  });

  return {
    metric: 'open_dispute',
    type: 'current_state',
    count: open.length,
    items: open.map((r) => ({
      dispute_id: r.raw_metadata?.id ?? null,
      customer_id: r.customer_id,
      amount: r.amount,
      currency: r.currency,
      occurred_at: r.occurred_at,
    })),
  };
}

/* ─────────────────────────── cancellation ────────────────────────────── */

/** event-period: exact COUNT of leads.cancel_requested_at (authoritative, always present) in [from, to). */
export async function cancellationRequested(supabase, { from, to } = {}) {
  let q = supabase.from('leads').select('lead_id', { count: 'exact', head: true }).not('cancel_requested_at', 'is', null);
  if (from) q = q.gte('cancel_requested_at', from);
  if (to) q = q.lt('cancel_requested_at', to);
  const { count, error } = await q;
  if (error) throw error;
  return { metric: 'cancellation_requested', type: 'event_period', from: from ?? null, to: to ?? null, count: count ?? 0 };
}

/**
 * event-period: exact COUNT of leads whose subscription actually ended,
 * by leads.cancelled_at.
 *
 * CODE-REVIEW FIX (round 2, "historical churn/cancelled metrics"): this
 * used to also require leads.status = 'Cancelled'. status is MUTABLE — a
 * later refund, dispute, or other status update on the same lead row
 * would silently erase a real historical cancellation from this count.
 * cancelled_at is the durable, never-overwritten historical signal that
 * "this subscription ended on this date" — that alone is now the basis,
 * so a later status change (e.g. 'Refunded', 'Disputed') can never remove
 * a customer from historical counts here. See churn() below for the same
 * fix applied to voluntary/involuntary classification.
 */
export async function cancelledCustomer(supabase, { from, to } = {}) {
  let q = supabase.from('leads').select('lead_id', { count: 'exact', head: true }).not('cancelled_at', 'is', null);
  if (from) q = q.gte('cancelled_at', from);
  if (to) q = q.lt('cancelled_at', to);
  const { count, error } = await q;
  if (error) throw error;
  return { metric: 'cancelled_customer', type: 'event_period', from: from ?? null, to: to ?? null, count: count ?? 0 };
}

/**
 * event-period COUNTS ONLY — voluntary_churn / involuntary_churn /
 * total_churn. Classified from leads (authoritative, always present):
 *   - the durable historical event basis is cancelled_at IS NOT NULL (see
 *     cancelledCustomer()'s comment above — status is mutable and must
 *     never be able to erase a real historical churn event; a later
 *     status='Refunded'/'Disputed' still counts here).
 *   - voluntary: cancel_requested_at IS NOT NULL.
 *   - involuntary: cancel_requested_at IS NULL.
 * IMPORTANT, stated in the result itself, not just here: "no
 * cancel_requested_at" is the best currently-available classifier, not a
 * confirmed statement that every such loss was payment-failure-driven —
 * the precise Stripe termination reason isn't separately captured
 * anywhere in this schema. There is deliberately no churn_rate here —
 * only counts. Fully paginated — per-row classification needs the actual
 * cancel_requested_at value, so a COUNT alone isn't enough here.
 */
export async function churn(supabase, { from, to } = {}) {
  const rows = await fetchAllRows(() =>
    supabase
      .from('leads')
      .select('lead_id, cancel_requested_at, cancelled_at')
      .not('cancelled_at', 'is', null)
      .order('cancelled_at', { ascending: true })
      .order('lead_id', { ascending: true })
  );

  // Same Date-vs-ISO-string pitfall as newPaidCustomer() above:
  // leads.cancelled_at is a timestamptz and comes back as a JS Date, so
  // every boundary is normalized to epoch ms before comparing.
  const fromMs = from ? new Date(from).getTime() : null;
  const toMs = to ? new Date(to).getTime() : null;
  const inRange = rows.filter((l) => {
    const cancelledMs = new Date(l.cancelled_at).getTime();
    if (fromMs !== null && cancelledMs < fromMs) return false;
    if (toMs !== null && cancelledMs >= toMs) return false;
    return true;
  });

  const voluntaryChurn = inRange.filter((l) => l.cancel_requested_at != null).length;
  const involuntaryChurn = inRange.filter((l) => l.cancel_requested_at == null).length;

  return {
    metric: 'churn',
    type: 'event_period',
    from: from ?? null,
    to: to ?? null,
    voluntary_churn: voluntaryChurn,
    involuntary_churn: involuntaryChurn,
    total_churn: voluntaryChurn + involuntaryChurn,
    limitation:
      'involuntary_churn uses "no cancel_requested_at on file" as a best-available classifier, not a confirmed payment-failure diagnosis — the exact Stripe termination reason is not separately captured in this schema. churn_rate is intentionally not computed here; only event-period counts ship in CRM-2A.',
  };
}

/* ──────────────────────────── allocation ─────────────────────────────── */

/** current-state: live seat capacity, matching assignStuddyAccount()'s own eligibility rule (positive, finite max_capacity). No cap — the number of Studdy WhatsApp groups is small and operationally bounded, and this query never used .limit() in the first place. */
export async function allocatedSeats(supabase) {
  const { data, error } = await supabase.from('studdy_accounts').select('group_name, max_capacity, active_customer_count');
  if (error) throw error;

  const valid = (data || []).filter((a) => Number.isFinite(a.max_capacity) && a.max_capacity > 0);
  const allocated = valid.reduce((sum, a) => sum + (a.active_customer_count || 0), 0);
  const totalCapacity = valid.reduce((sum, a) => sum + a.max_capacity, 0);

  return {
    metric: 'allocated_seats',
    type: 'current_state',
    allocated_seats: allocated,
    total_capacity: totalCapacity,
    remaining_capacity: totalCapacity - allocated,
    by_group: valid.map((a) => ({
      group_name: a.group_name,
      max_capacity: a.max_capacity,
      active_customer_count: a.active_customer_count,
      remaining: a.max_capacity - a.active_customer_count,
    })),
  };
}

/* ─────────────────── anonymous funnel (aggregate only) ────────────────── */

/**
 * event-period, aggregate only: website_visit / CTA / checkout counts
 * from site_traffic_daily. NEVER attributes to an individual visitor.
 * `day` is Asia/Kolkata from the CRM-2A cutover forward; rows written
 * before that are legacy UTC-bucketed — see reporting-timezone.js and
 * api/track-event.js's own comment. This function does not attempt to
 * distinguish the two eras in its output; callers spanning the cutover
 * date must treat the boundary as approximate for `day`-level precision.
 * Fully paginated (site_traffic_daily has no single id column, so the
 * tiebreak orders by its full composite primary key) — a funnel total
 * must never silently truncate once the table has more than one page of
 * day/event/campaign/country/device rows.
 */
export async function funnelTraffic(supabase, { from, to } = {}) {
  const rows = await fetchAllRows(() => {
    let q = supabase
      .from('site_traffic_daily')
      .select('event, visit_count, day, campaign_code, country, device_type')
      .order('day', { ascending: true })
      .order('event', { ascending: true })
      .order('campaign_code', { ascending: true })
      .order('country', { ascending: true })
      .order('device_type', { ascending: true });
    if (from) q = q.gte('day', from);
    if (to) q = q.lt('day', to);
    return q;
  });

  const byEvent = {};
  for (const row of rows) {
    byEvent[row.event] = (byEvent[row.event] || 0) + (row.visit_count || 0);
  }

  return {
    metric: 'funnel_traffic',
    type: 'event_period',
    from: from ?? null,
    to: to ?? null,
    website_visit: byEvent.opened || 0,
    checkout: byEvent.checkout_viewed || 0,
    cta: byEvent.trial_clicked || 0,
  };
}

export const REPORTING_TODAY = todayReportingDay;

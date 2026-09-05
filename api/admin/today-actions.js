/**
 * GET /api/admin/today-actions
 *
 * CRM-3A build item 6 — "Today's Actions" foundation. Every date/boundary
 * here is Asia/Kolkata (reporting-timezone.js), per the explicit
 * requirement that all dates and operational timing display in IST.
 *
 * Sections, each labeled with what kind of fact it is (never blurred):
 *   trials_ending_today        — CALCULATED (trial_end vs today, IST)
 *   payments_expected_today    — CALCULATED (current_period_end vs today, IST)
 *   failed_payments            — STORED (subscriptions.status='past_due')
 *   cancellation_requests      — STORED (open cancellation_requests rows)
 *   access_removal_pending     — MANUAL task flag, not a completion status
 *                                 (see api/_lib/lifecycle.js's own comment
 *                                 for why this can never be a stored
 *                                 completion field)
 *   password_change_tasks      — FOUNDATION ONLY. There is no automatic
 *                                 password-changing integration (explicitly
 *                                 out of this round's scope) and no field
 *                                 anywhere records "this customer's Studdy
 *                                 password needs rotating" — this section
 *                                 always returns an empty list with that
 *                                 note, rather than inventing a signal.
 *   overdue                    — cancellation requests open more than 2
 *                                 days, and grace-period customers past the
 *                                 configured failed_payment_grace_days
 *                                 (settings table, migration 0008) — an
 *                                 approximation, caveated in the response,
 *                                 since customers.updated_at is reused for
 *                                 other writes too, not a dedicated
 *                                 "grace started at" column.
 *   checkout_started            — a lead_attribution row (created at the
 *                                 "Start Free Trial" click) with no
 *                                 matching customers row yet — the one
 *                                 real per-lead "checkout started, not yet
 *                                 converted" signal (see migration 0016's
 *                                 own comment). Scoped to the last 7 days
 *                                 so this stays a short, actionable list,
 *                                 not an ever-growing one.
 */
import { getSupabase } from '../_lib/supabase.js';
import { requireAdminSession } from '../_lib/admin-auth.js';
import { withLifecycle, PIPELINE_ROW_CAP } from '../_lib/customer-pipeline.js';
import { reportingDayFor, formatIstDateTime } from '../_lib/reporting-timezone.js';

const OVERDUE_CANCELLATION_DAYS = 2;
const DEFAULT_GRACE_DAYS = 3;
const CHECKOUT_STARTED_LOOKBACK_DAYS = 7;

async function getGracePeriodDays(supabase) {
  const { data } = await supabase.from('settings').select('value').eq('key', 'failed_payment_grace_days').maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_GRACE_DAYS;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  const adminUser = await requireAdminSession(req, res, supabase);
  if (!adminUser) return;

  const now = new Date();

  try {
    const { data: customers, error: customersError } = await supabase.from('customers').select('*').limit(PIPELINE_ROW_CAP);
    if (customersError) throw customersError;

    const joined = await withLifecycle(supabase, customers || [], { now });
    const gracePeriodDays = await getGracePeriodDays(supabase);
    const graceCutoffMs = now.getTime() - gracePeriodDays * 24 * 60 * 60 * 1000;
    const cancellationCutoffMs = now.getTime() - OVERDUE_CANCELLATION_DAYS * 24 * 60 * 60 * 1000;

    const trialsEndingToday = [];
    const paymentsExpectedToday = [];
    const failedPayments = [];
    const cancellationRequests = [];
    const accessRemovalPending = [];
    const overdueCancellations = [];
    const overdueGrace = [];

    for (const row of joined) {
      const { customer, subscription, openCancellationRequest, lifecycle } = row;
      const summary = {
        customer_id: customer.id,
        paid_id: customer.paid_id,
        name: customer.name,
        email: customer.email,
        sales_owner: customer.sales_owner,
      };

      if (lifecycle.calculated.trial_ending_today) {
        trialsEndingToday.push({ ...summary, trial_end_ist: formatIstDateTime(subscription?.trial_end) });
      }
      if (lifecycle.calculated.payment_due_today) {
        paymentsExpectedToday.push({
          ...summary,
          currency: subscription?.currency ?? null,
          current_period_end_ist: formatIstDateTime(subscription?.current_period_end),
        });
      }
      if (subscription?.status === 'past_due') {
        failedPayments.push({ ...summary, currency: subscription?.currency ?? null });
        if (customer.access_status === 'grace' && new Date(customer.updated_at).getTime() <= graceCutoffMs) {
          overdueGrace.push({ ...summary, grace_period_days: gracePeriodDays });
        }
      }
      if (openCancellationRequest) {
        cancellationRequests.push({
          ...summary,
          status: openCancellationRequest.status,
          requested_at_ist: formatIstDateTime(openCancellationRequest.requested_at),
        });
        if (new Date(openCancellationRequest.requested_at).getTime() <= cancellationCutoffMs) {
          overdueCancellations.push({
            ...summary,
            requested_at_ist: formatIstDateTime(openCancellationRequest.requested_at),
            overdue_threshold_days: OVERDUE_CANCELLATION_DAYS,
          });
        }
      }
      if (lifecycle.flags.access_removal_pending) {
        accessRemovalPending.push(summary);
      }
    }

    /* checkout_started — lead_attribution rows with no matching customer,
     * from the last CHECKOUT_STARTED_LOOKBACK_DAYS days. Left-join done in
     * JS (small volume, same convention as the rest of this endpoint). */
    const lookbackDay = reportingDayFor(new Date(now.getTime() - CHECKOUT_STARTED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000));
    const { data: recentAttribution, error: attributionError } = await supabase
      .from('lead_attribution')
      .select('lead_id, latest_utm_source, latest_utm_campaign, latest_touched_at')
      .gte('latest_touched_at', `${lookbackDay}T00:00:00.000Z`)
      .limit(PIPELINE_ROW_CAP);
    if (attributionError) throw attributionError;

    const { data: recentCustomers, error: recentCustomersError } = await supabase
      .from('customers')
      .select('source_lead_id')
      .not('source_lead_id', 'is', null)
      .limit(PIPELINE_ROW_CAP);
    if (recentCustomersError) throw recentCustomersError;
    const convertedLeadIds = new Set((recentCustomers || []).map((c) => c.source_lead_id));

    const checkoutStarted = (recentAttribution || [])
      .filter((a) => !convertedLeadIds.has(a.lead_id))
      .map((a) => ({
        lead_id: a.lead_id,
        latest_utm_source: a.latest_utm_source,
        latest_utm_campaign: a.latest_utm_campaign,
        clicked_at_ist: formatIstDateTime(a.latest_touched_at),
      }));

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      today_ist: reportingDayFor(now),
      row_cap: PIPELINE_ROW_CAP,
      trials_ending_today: trialsEndingToday,
      payments_expected_today: paymentsExpectedToday,
      failed_payments: failedPayments,
      cancellation_requests: cancellationRequests,
      access_removal_pending: {
        items: accessRemovalPending,
        note: 'Manual task flag, not an automated completion status — Studdy access is a shared per-group login, not a per-customer credential, so no field anywhere confirms it was actually revoked.',
      },
      password_change_tasks: {
        items: [],
        note: 'Foundation only — no automatic password-changing integration exists (explicitly out of CRM-3A scope), and no stored field indicates a password-rotation need. Always empty until a future round adds a real signal.',
      },
      overdue: {
        cancellation_requests: overdueCancellations,
        grace_period_payments: overdueGrace,
        note: `Approximate: uses customers.updated_at as a proxy for "grace period started at" (no dedicated column exists) and cancellation_requests.requested_at directly. Thresholds: cancellations over ${OVERDUE_CANCELLATION_DAYS} days old, grace period over ${gracePeriodDays} days (from settings.failed_payment_grace_days).`,
      },
      checkout_started: {
        items: checkoutStarted,
        lookback_days: CHECKOUT_STARTED_LOOKBACK_DAYS,
        note: 'Leads that clicked "Start Free Trial" (lead_attribution row exists) with no matching customer yet — checkout started but not completed/converted.',
      },
    });
  } catch (err) {
    console.error('admin/today-actions error:', err);
    return res.status(500).json({ error: 'Today\'s actions query failed' });
  }
}

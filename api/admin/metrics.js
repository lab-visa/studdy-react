/**
 * GET /api/admin/metrics
 *
 * CRM-2A — protected, read-only reporting endpoint. Every number returned
 * here comes from api/_lib/metrics.js, the one authoritative place each
 * metric's definition lives — this handler does no calculation of its own
 * beyond wiring query params through and assembling the response.
 *
 * Auth: identical pattern to api/admin/reconciliation.js —
 * requireAdminSession() gates every request; an unauthenticated caller
 * gets 401 with no data.
 *
 * Query params (all optional, ISO 8601 date/datetime strings):
 *   from, to           — event-period window applied to every
 *                         event-period metric below.
 *   cohortFrom, cohortTo — cohort window for trial_to_paid_14d. If
 *                         omitted, trial_to_paid_14d is left out of the
 *                         response entirely (never computed with a
 *                         guessed range) rather than defaulting silently.
 *
 * No dashboard UI reads this yet — CRM-2A ships the foundation only, per
 * the approved scope. Field selection here is deliberately explicit and
 * narrow: no raw Stripe/Studdy secrets, no card data, no Studdy
 * passwords, no service-role exposure — every value is either a count, a
 * currency-labeled sum, or an already-safe identifier (customer_id,
 * dispute_id, group_name), matching reconciliation.js's own safety bar.
 */
import { getSupabase } from '../_lib/supabase.js';
import { requireAdminSession } from '../_lib/admin-auth.js';
import {
  trialStarted,
  activeTrial,
  trialToPaid14d,
  newPaidCustomer,
  activePaidCustomer,
  successfulPayment,
  failedPayment,
  grossRevenue,
  refundAmount,
  netRevenue,
  openDispute,
  cancellationRequested,
  cancelledCustomer,
  churn,
  allocatedSeats,
  funnelTraffic,
} from '../_lib/metrics.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  const adminUser = await requireAdminSession(req, res, supabase);
  if (!adminUser) return; // requireAdminSession already sent 401

  const { from, to, cohortFrom, cohortTo } = req.query || {};
  const range = { from: from || undefined, to: to || undefined };

  try {
    const [
      trialStartedResult,
      activeTrialResult,
      newPaidCustomerResult,
      activePaidCustomerResult,
      successfulPaymentResult,
      failedPaymentResult,
      grossRevenueResult,
      refundAmountResult,
      netRevenueResult,
      openDisputeResult,
      cancellationRequestedResult,
      cancelledCustomerResult,
      churnResult,
      allocatedSeatsResult,
      funnelTrafficResult,
    ] = await Promise.all([
      trialStarted(supabase, range),
      activeTrial(supabase),
      newPaidCustomer(supabase, range),
      activePaidCustomer(supabase),
      successfulPayment(supabase, range),
      failedPayment(supabase, range),
      grossRevenue(supabase, range),
      refundAmount(supabase, range),
      netRevenue(supabase, range),
      openDispute(supabase),
      cancellationRequested(supabase, range),
      cancelledCustomer(supabase, range),
      churn(supabase, range),
      allocatedSeats(supabase),
      funnelTraffic(supabase, range),
    ]);

    const trialToPaid14dResult =
      cohortFrom && cohortTo ? await trialToPaid14d(supabase, { cohortFrom, cohortTo }) : null;

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      range,
      metrics: {
        trial_started: trialStartedResult,
        active_trial: activeTrialResult,
        trial_to_paid_14d: trialToPaid14dResult,
        new_paid_customer: newPaidCustomerResult,
        active_paid_customer: activePaidCustomerResult,
        successful_payment: successfulPaymentResult,
        failed_payment: failedPaymentResult,
        gross_revenue: grossRevenueResult,
        refund_amount: refundAmountResult,
        net_revenue: netRevenueResult,
        open_dispute: openDisputeResult,
        cancellation_requested: cancellationRequestedResult,
        cancelled_customer: cancelledCustomerResult,
        churn: churnResult,
        allocated_seats: allocatedSeatsResult,
        funnel_traffic: funnelTrafficResult,
      },
    });
  } catch (err) {
    console.error('metrics error:', err);
    return res.status(500).json({ error: 'Metrics query failed' });
  }
}

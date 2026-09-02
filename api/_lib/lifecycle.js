/**
 * CRM-3A — Customer & Subscription lifecycle derivation.
 *
 * The single place that decides what a customer's lifecycle "looks like"
 * on the pipeline view, kept strictly separate into three kinds — per the
 * explicit requirement this round: never blur stored fact, a same-turn
 * calculation, and a human task into one invented status.
 *
 *   stored     — read directly off subscriptions/customers/
 *                cancellation_requests/payment_events, verbatim. Never
 *                computed, never guessed.
 *   calculated — derived HERE, at read time, from stored fields + "today"
 *                (Asia/Kolkata, via reporting-timezone.js) — e.g. "trial
 *                ending today" is never its own persisted column; it's
 *                trial_end compared to today's IST date, recomputed every
 *                time this function runs.
 *   manual     — an operational task this system has no automated way to
 *                confirm was actually completed (e.g. Studdy access is a
 *                shared per-group login, not a per-customer credential —
 *                there is no field anywhere that proves a customer's
 *                access was actually revoked). Surfaced as a flag to
 *                review, never as a fabricated "done"/"not done" status.
 *
 * `stage` is the single primary, mutually-exclusive position in the
 * subscription lifecycle (what most of the required list actually is:
 * Checkout started / Trial active / Trial ending today / Payment due
 * today / Active paid / Payment failed / Retry-grace period / Cancelling
 * at period end / Cancelled / Access removed). `flags` are independent
 * facts that can co-occur with any stage — a customer can be "Active
 * paid" AND have an open dispute on one charge at the same time; forcing
 * those into one mutually-exclusive stage would misrepresent reality, so
 * they are not.
 */
import { reportingDayFor } from './reporting-timezone.js';

/**
 * @param {object} params
 * @param {object|null} params.customer - a `customers` row (lifecycle, access_status, sales_owner, ...)
 * @param {object|null} params.subscription - a `subscriptions` row, or null if none synced yet
 * @param {object|null} params.openCancellationRequest - an open `cancellation_requests` row, or null
 * @param {boolean} params.hasOpenDispute - a charge.dispute.created with no matching charge.dispute.closed
 * @param {boolean} params.hasAnyRefund - at least one refund.created payment_events row
 * @param {Date} [params.now]
 */
export function deriveCustomerLifecycle({
  customer,
  subscription,
  openCancellationRequest,
  hasOpenDispute = false,
  hasAnyRefund = false,
  now = new Date(),
}) {
  /* reportingDayFor(now), NOT todayReportingDay() — the latter always
   * reads the real wall clock (new Date()) and ignores any injected
   * `now`, which would make this function's IST-boundary behavior
   * untestable/non-deterministic. Defaults to "really now" the same way,
   * since `now` itself defaults to `new Date()` above. */
  const today = reportingDayFor(now);

  const storedSubscriptionStatus = subscription?.status ?? null;
  const storedAccessStatus = customer?.access_status ?? null;
  const storedLifecycle = customer?.lifecycle ?? null;
  const storedCancelAtPeriodEnd = Boolean(subscription?.cancel_at_period_end);

  const trialEndingToday =
    storedSubscriptionStatus === 'trialing' && subscription?.trial_end
      ? reportingDayFor(new Date(subscription.trial_end)) === today
      : false;

  /* Only provable once current_period_end is actually populated — that
   * only happens going forward, from the CRM-3A customer.subscription.updated
   * sync (see sync-customer.js's syncSubscriptionUpdated()). A trialing
   * or brand-new subscription with no current_period_end yet correctly
   * shows false here, never a guess. */
  const paymentDueToday =
    (storedSubscriptionStatus === 'active' || storedSubscriptionStatus === 'past_due') && subscription?.current_period_end
      ? reportingDayFor(new Date(subscription.current_period_end)) === today
      : false;

  const cancellingAtPeriodEnd =
    storedCancelAtPeriodEnd && storedSubscriptionStatus !== 'cancelled';

  let stage;
  if (!subscription) {
    stage = 'No subscription synced';
  } else if (storedSubscriptionStatus === 'cancelled') {
    stage = storedAccessStatus === 'ended' ? 'Access removed' : 'Cancelled';
  } else if (cancellingAtPeriodEnd) {
    stage = 'Cancelling at period end';
  } else if (storedAccessStatus === 'grace') {
    stage = 'Retry / grace period';
  } else if (storedSubscriptionStatus === 'past_due') {
    stage = 'Payment failed';
  } else if (trialEndingToday) {
    stage = 'Trial ending today';
  } else if (storedSubscriptionStatus === 'trialing') {
    stage = 'Trial active';
  } else if (paymentDueToday) {
    stage = 'Payment due today';
  } else if (storedSubscriptionStatus === 'active') {
    stage = 'Active paid';
  } else {
    /* A real Stripe status this codebase doesn't yet map to a display
     * stage (e.g. unpaid/incomplete) — shown verbatim, never guessed. */
    stage = storedSubscriptionStatus ? `Unmapped (${storedSubscriptionStatus})` : 'Unknown';
  }

  return {
    stage,
    stored: {
      subscription_status: storedSubscriptionStatus,
      access_status: storedAccessStatus,
      lifecycle: storedLifecycle,
      cancel_at_period_end: storedCancelAtPeriodEnd,
    },
    calculated: {
      trial_ending_today: trialEndingToday,
      payment_due_today: paymentDueToday,
      cancelling_at_period_end: cancellingAtPeriodEnd,
    },
    flags: {
      cancellation_requested: Boolean(openCancellationRequest),
      disputed: Boolean(hasOpenDispute),
      refunded: Boolean(hasAnyRefund),
      /* MANUAL task — see module comment. Flagged whenever access has
       * ended, since there is no field anywhere proving the shared
       * Studdy group access was actually pulled for this one customer;
       * this is a to-review flag, never a completion status. */
      access_removal_pending: storedAccessStatus === 'ended',
    },
  };
}

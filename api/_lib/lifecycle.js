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
 *   manual     — an operational task with no fully automated confirmation
 *                that the real-world action happened (e.g. Studdy access
 *                is a shared per-group login, not a per-customer
 *                credential, so nothing here can verify from Studdy's own
 *                side that one specific person can no longer log in).
 *                account_assignments.released_at (migration 0007) IS a
 *                real, stored, per-customer record that an operator
 *                actually did the seat-removal step, though — the flag
 *                below uses it as confirmation, so it clears once that
 *                step is done, rather than staying flagged forever.
 *                Surfaced as a flag to review, never a fabricated
 *                "done"/"not done" status invented from nothing.
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
 * @param {boolean} [params.hasUnreleasedAssignment] - true if this customer still has an
 *   `active`/`reserved` account_assignments row (migration 0007) — i.e. the manual
 *   seat-removal task genuinely has not been done yet. Defaults to true (fail-safe:
 *   with no signal, assume the task is still open, never assume it's done) — every
 *   real caller (api/_lib/customer-pipeline.js's withLifecycle()) always passes the
 *   real value. See the access_removal_pending flag below for why this must gate it.
 * @param {Date} [params.now]
 */
export function deriveCustomerLifecycle({
  customer,
  subscription,
  openCancellationRequest,
  hasOpenDispute = false,
  hasAnyRefund = false,
  hasUnreleasedAssignment = true,
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
       * ended AND the manual removal itself hasn't actually happened yet.
       *
       * PRODUCTION BUG FIX (Sep 2026): this used to be
       * `storedAccessStatus === 'ended'` alone, which never clears once
       * access ends — access_status is correctly a terminal value, so a
       * customer stayed "pending" in Today's Actions forever, even after
       * the removal was actually done (e.g. Puneet Sharma: access_status
       * 'ended', subscription 'cancelled', and an "Access released —
       * Group 1" Activity Timeline entry already proving it happened).
       * That entry comes from account_assignments.released_at
       * (migration 0007) — a real, already-existing, per-customer
       * confirmation field, contrary to what this comment used to claim.
       * hasUnreleasedAssignment (true when an `active`/`reserved`
       * account_assignments row still exists for this customer) is now
       * required too, so the flag clears once the seat is actually
       * reclaimed — still never a fabricated "done" the other direction:
       * a customer never assigned a seat at all also correctly reads
       * not-pending (hasUnreleasedAssignment is false), since there was
       * never anything to remove. */
      access_removal_pending: storedAccessStatus === 'ended' && hasUnreleasedAssignment,
    },
  };
}

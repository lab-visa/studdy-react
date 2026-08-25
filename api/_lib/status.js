/**
 * Shared status/stage helpers so the webhook (which writes status) and
 * get-session (which reads it back, or computes it directly from Stripe
 * as a fallback) always agree on the exact same values. Before this file
 * existed, the webhook wrote "Active" for a trialing subscription while
 * the dashboard checked for the raw Stripe word "trialing" — they never
 * matched, so the trial banner never showed. Everything reads through
 * here now so that can't drift apart again.
 */

/** Stripe subscription.status -> the status word we store/display. */
export function mapStatus(subStatus) {
  switch (subStatus) {
    case 'trialing':
      return 'Trialing';
    case 'active':
      return 'Active';
    case 'past_due':
    case 'unpaid':
      return 'Failed';
    case 'canceled':
      return 'Cancelled';
    case 'paused':
      return 'Paused';
    default:
      return 'Active';
  }
}

export const toDate = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : null);

export const fmtDate = (isoDate) =>
  isoDate
    ? new Date(isoDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';

/**
 * Stripe API versions from 2025 onward moved current_period_start/end off
 * the Subscription object and onto each subscription item (because a sub
 * can now have items on different billing cycles). Older code that reads
 * sub.current_period_end silently gets undefined -> next billing date
 * shows blank. This checks the item first, falls back to the old spot for
 * safety, and finally falls back to trial_end (their first real charge
 * date, which is also "next billing" for a brand new trial).
 */
export function resolveNextBilling(sub) {
  const item = sub?.items?.data?.[0];
  const currentPeriodEnd = item?.current_period_end ?? sub?.current_period_end;
  return toDate(currentPeriodEnd) || toDate(sub?.trial_end);
}

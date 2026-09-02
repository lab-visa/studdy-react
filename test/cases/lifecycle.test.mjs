/**
 * CRM-3A — api/_lib/lifecycle.js's deriveCustomerLifecycle(). Pure-function
 * tests, no database needed — proves the stored/calculated/manual
 * distinction is honored exactly, and that "today" (IST) boundaries are
 * computed correctly, including the same UTC-vs-IST divergence case
 * reporting-timezone.test.mjs already proves for the underlying utility.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveCustomerLifecycle } from '../../api/_lib/lifecycle.js';

test('no subscription synced yet -> "No subscription synced", never a guessed stage', () => {
  const result = deriveCustomerLifecycle({ customer: { access_status: 'pending', lifecycle: 'trial' }, subscription: null, openCancellationRequest: null });
  assert.equal(result.stage, 'No subscription synced');
  assert.equal(result.stored.subscription_status, null);
});

test('trialing subscription, trial_end far in the future -> "Trial active", trial_ending_today is false', () => {
  const now = new Date('2026-09-02T10:00:00.000Z'); // midday UTC, well inside IST 2026-09-02
  const result = deriveCustomerLifecycle({
    customer: { access_status: 'active', lifecycle: 'trial' },
    subscription: { status: 'trialing', trial_end: '2026-09-10T00:00:00.000Z' },
    openCancellationRequest: null,
    now,
  });
  assert.equal(result.stage, 'Trial active');
  assert.equal(result.calculated.trial_ending_today, false);
  assert.equal(result.stored.subscription_status, 'trialing');
});

test('IST boundary: trial_end at 2026-09-02T19:00:00Z is already IST 2026-09-03 — "now" on IST 2026-09-02 does NOT count as trial ending today', () => {
  // Mirrors reporting-timezone.test.mjs's own UTC-vs-IST divergence case:
  // 19:00 UTC is 00:30 IST the NEXT day (IST = UTC+5:30).
  const now = new Date('2026-09-02T10:00:00.000Z'); // IST 2026-09-02, 15:30
  const trialEnd = '2026-09-02T19:00:00.000Z'; // IST 2026-09-03, 00:30 — a DIFFERENT IST day
  const result = deriveCustomerLifecycle({
    customer: { access_status: 'active', lifecycle: 'trial' },
    subscription: { status: 'trialing', trial_end: trialEnd },
    openCancellationRequest: null,
    now,
  });
  assert.equal(result.calculated.trial_ending_today, false, 'a naive UTC-day comparison would wrongly say today; IST correctly says tomorrow');
  assert.equal(result.stage, 'Trial active');
});

test('IST boundary: trial_end within the SAME IST day as "now" -> trial_ending_today is true, stage is "Trial ending today"', () => {
  const now = new Date('2026-09-02T10:00:00.000Z'); // IST 2026-09-02, 15:30
  const trialEnd = '2026-09-02T15:00:00.000Z'; // IST 2026-09-02, 20:30 — same IST day
  const result = deriveCustomerLifecycle({
    customer: { access_status: 'active', lifecycle: 'trial' },
    subscription: { status: 'trialing', trial_end: trialEnd },
    openCancellationRequest: null,
    now,
  });
  assert.equal(result.calculated.trial_ending_today, true);
  assert.equal(result.stage, 'Trial ending today');
});

test('payment_due_today is only calculated once current_period_end exists — a trialing subscription with none set never guesses', () => {
  const now = new Date('2026-09-02T10:00:00.000Z');
  const result = deriveCustomerLifecycle({
    customer: { access_status: 'active', lifecycle: 'trial' },
    subscription: { status: 'trialing', trial_end: '2026-09-20T00:00:00.000Z', current_period_end: null },
    openCancellationRequest: null,
    now,
  });
  assert.equal(result.calculated.payment_due_today, false);
});

test('active subscription with current_period_end today (IST) -> "Payment due today"', () => {
  const now = new Date('2026-09-02T10:00:00.000Z'); // IST 2026-09-02
  const result = deriveCustomerLifecycle({
    customer: { access_status: 'active', lifecycle: 'converted' },
    subscription: { status: 'active', current_period_end: '2026-09-02T12:00:00.000Z' },
    openCancellationRequest: null,
    now,
  });
  assert.equal(result.calculated.payment_due_today, true);
  assert.equal(result.stage, 'Payment due today');
});

test('active subscription, current_period_end not today -> "Active paid"', () => {
  const now = new Date('2026-09-02T10:00:00.000Z');
  const result = deriveCustomerLifecycle({
    customer: { access_status: 'active', lifecycle: 'converted' },
    subscription: { status: 'active', current_period_end: '2026-10-02T12:00:00.000Z' },
    openCancellationRequest: null,
    now,
  });
  assert.equal(result.stage, 'Active paid');
});

test('past_due subscription -> "Payment failed" stage; grace access_status -> "Retry / grace period" takes priority', () => {
  const failed = deriveCustomerLifecycle({
    customer: { access_status: 'active', lifecycle: 'converted' },
    subscription: { status: 'past_due' },
    openCancellationRequest: null,
  });
  assert.equal(failed.stage, 'Payment failed');

  const grace = deriveCustomerLifecycle({
    customer: { access_status: 'grace', lifecycle: 'converted' },
    subscription: { status: 'past_due' },
    openCancellationRequest: null,
  });
  assert.equal(grace.stage, 'Retry / grace period');
});

test('cancel_at_period_end true, subscription still active -> "Cancelling at period end"', () => {
  const result = deriveCustomerLifecycle({
    customer: { access_status: 'active', lifecycle: 'converted' },
    subscription: { status: 'active', cancel_at_period_end: true },
    openCancellationRequest: null,
  });
  assert.equal(result.stage, 'Cancelling at period end');
  assert.equal(result.calculated.cancelling_at_period_end, true);
  assert.equal(result.stored.cancel_at_period_end, true);
});

test('subscription status cancelled -> "Cancelled", or "Access removed" once access_status is ended', () => {
  const cancelled = deriveCustomerLifecycle({
    customer: { access_status: 'active', lifecycle: 'churned' },
    subscription: { status: 'cancelled' },
    openCancellationRequest: null,
  });
  assert.equal(cancelled.stage, 'Cancelled');

  const removed = deriveCustomerLifecycle({
    customer: { access_status: 'ended', lifecycle: 'churned' },
    subscription: { status: 'cancelled' },
    openCancellationRequest: null,
  });
  assert.equal(removed.stage, 'Access removed');
});

test('cancel_at_period_end is ignored once the subscription is actually cancelled — never shows "Cancelling" for an already-ended sub', () => {
  const result = deriveCustomerLifecycle({
    customer: { access_status: 'ended', lifecycle: 'churned' },
    subscription: { status: 'cancelled', cancel_at_period_end: true },
    openCancellationRequest: null,
  });
  assert.equal(result.calculated.cancelling_at_period_end, false);
  assert.equal(result.stage, 'Access removed');
});

test('an unmapped real Stripe status is shown verbatim, never guessed into an existing stage', () => {
  const result = deriveCustomerLifecycle({
    customer: { access_status: 'active', lifecycle: 'trial' },
    subscription: { status: 'incomplete' },
    openCancellationRequest: null,
  });
  assert.equal(result.stage, 'Unmapped (incomplete)');
});

test('flags are independent of stage — an active paid customer can simultaneously be disputed/refunded/cancellation-requested', () => {
  const result = deriveCustomerLifecycle({
    customer: { access_status: 'active', lifecycle: 'converted' },
    subscription: { status: 'active' },
    openCancellationRequest: { id: 'req-1', status: 'pending_discussion' },
    hasOpenDispute: true,
    hasAnyRefund: true,
  });
  assert.equal(result.stage, 'Active paid', 'the primary stage must not be forced into Disputed/Refunded/Cancellation requested');
  assert.equal(result.flags.cancellation_requested, true);
  assert.equal(result.flags.disputed, true);
  assert.equal(result.flags.refunded, true);
});

test('access_removal_pending flag is set purely from access_status=ended — a MANUAL task flag, not a stored completion field', () => {
  const ended = deriveCustomerLifecycle({
    customer: { access_status: 'ended', lifecycle: 'churned' },
    subscription: { status: 'cancelled' },
    openCancellationRequest: null,
  });
  assert.equal(ended.flags.access_removal_pending, true);

  const active = deriveCustomerLifecycle({
    customer: { access_status: 'active', lifecycle: 'converted' },
    subscription: { status: 'active' },
    openCancellationRequest: null,
  });
  assert.equal(active.flags.access_removal_pending, false);
});

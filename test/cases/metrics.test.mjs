/**
 * CRM-2A — authoritative metric/query layer (api/_lib/metrics.js) and the
 * protected api/admin/metrics endpoint.
 *
 * Also covers the CRM-2A fix to api/admin/reconciliation.js's
 * checkAllocationMirror() (a released/churned customer's missing active
 * mirror is healthy, not a gap — only a customer whose access is still
 * meant to be active is checked).
 *
 * Requires --experimental-test-module-mocks, same pattern as
 * auth.test.mjs / tracking-http.test.mjs.
 */
import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { fakeReq, fakeRes } from '../helpers/fake-http.mjs';
import * as metrics from '../../api/_lib/metrics.js';
import { checkAllocationMirror } from '../../api/admin/reconciliation.js';
import { recordPaymentSucceeded } from '../../api/_lib/sync-customer.js';

process.env.ADMIN_PIN_PEPPER = 'test-suite-pepper-do-not-use-in-production';
process.env.NODE_ENV = 'test';

const repoRoot = join(new URL('.', import.meta.url).pathname, '..', '..');
const supabaseModUrl = pathToFileURL(join(repoRoot, 'api/_lib/supabase.js')).href;

let pool;
let supabase;
let metricsHandler;
let adminAuth;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
  mock.module(supabaseModUrl, { namedExports: { getSupabase: () => supabase } });
  ({ default: metricsHandler } = await import(pathToFileURL(join(repoRoot, 'api/admin/metrics.js')).href));
  adminAuth = await import(pathToFileURL(join(repoRoot, 'api/_lib/admin-auth.js')).href);
});

after(async () => {
  await closeTestPool();
});

const isoDaysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

async function seedCustomer({ createdAt, lifecycle = 'trial', accessStatus = 'active', stripeCustomerId } = {}) {
  const res = await pool.query(
    `INSERT INTO customers (created_at, lifecycle, access_status, stripe_customer_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [createdAt ?? new Date().toISOString(), lifecycle, accessStatus, stripeCustomerId ?? `cus_${randomUUID()}`]
  );
  return res.rows[0].id;
}

async function seedSuccessfulPayment(customerId, occurredAt, { amount = 1000, currency = 'inr' } = {}) {
  await pool.query(
    `INSERT INTO payment_events (stripe_event_id, event_type, customer_id, occurred_at, amount, currency)
     VALUES ($1, 'invoice.payment_succeeded', $2, $3, $4, $5)`,
    [`evt_${randomUUID()}`, customerId, occurredAt, amount, currency]
  );
}

async function seedRefund(customerId, occurredAt, { amount = 100, currency = 'inr' } = {}) {
  await pool.query(
    `INSERT INTO payment_events (stripe_event_id, event_type, customer_id, occurred_at, amount, currency)
     VALUES ($1, 'refund.created', $2, $3, $4, $5)`,
    [`evt_${randomUUID()}`, customerId, occurredAt, amount, currency]
  );
}

async function seedLead({ groupName = null, cancelRequestedAt = null, cancelledAt = null, status = 'lead', stripeCustomerId = null, stripeSubscriptionId = null } = {}) {
  const res = await pool.query(
    `INSERT INTO leads (group_name, cancel_requested_at, cancelled_at, status, stripe_customer_id, stripe_subscription_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING lead_id`,
    [groupName, cancelRequestedAt, cancelledAt, status, stripeCustomerId, stripeSubscriptionId]
  );
  return res.rows[0].lead_id;
}

async function seedStuddyAccount(groupName, { maxCapacity = 7, activeCount = 0 } = {}) {
  const res = await pool.query(
    `INSERT INTO studdy_accounts (group_name, max_capacity, active_customer_count) VALUES ($1, $2, $3) RETURNING id`,
    [groupName, maxCapacity, activeCount]
  );
  return res.rows[0].id;
}

async function seedSubscription(customerId, stripeSubscriptionId, { status = 'trialing' } = {}) {
  await pool.query(
    `INSERT INTO subscriptions (customer_id, stripe_subscription_id, status) VALUES ($1, $2, $3)`,
    [customerId, stripeSubscriptionId, status]
  );
}

async function seedSiteTraffic({ day, event, campaignCode = 'none', country = 'unknown', deviceType = 'unknown', visitCount = 1 }) {
  await pool.query(
    `INSERT INTO site_traffic_daily (day, event, campaign_code, country, device_type, visit_count)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (day, event, campaign_code, country, device_type) DO UPDATE SET visit_count = site_traffic_daily.visit_count + EXCLUDED.visit_count`,
    [day, event, campaignCode, country, deviceType, visitCount]
  );
}

async function seedDisputeCreated(customerId, occurredAt, disputeId, { amount = 500, currency = 'usd' } = {}) {
  await pool.query(
    `INSERT INTO payment_events (stripe_event_id, event_type, customer_id, occurred_at, amount, currency, raw_metadata)
     VALUES ($1, 'charge.dispute.created', $2, $3, $4, $5, $6::jsonb)`,
    [`evt_${randomUUID()}`, customerId, occurredAt, amount, currency, JSON.stringify({ id: disputeId })]
  );
}

/* ─────────────────────── trial_to_paid_14d (cohort) ─────────────────────── */

test('trial_to_paid_14d: a MATURE cohort computes the correct percentage, excluding legacy and late conversions from the numerator correctly', async () => {
  const cohortFrom = isoDaysAgo(40);
  const cohortTo = isoDaysAgo(30); // 10-day cohort window, fully elapsed (30+14=44 days ago... wait: elapsed means today >= cohortTo + 14d)

  // Customer A: converts within 14 days of trial start.
  const trialStartA = isoDaysAgo(35);
  const custA = await seedCustomer({ createdAt: trialStartA, lifecycle: 'converted', accessStatus: 'active' });
  await seedSuccessfulPayment(custA, isoDaysAgo(32)); // 3 days after trial start

  // Customer B: converts, but AFTER the 14-day window — counts in denominator, not numerator.
  const trialStartB = isoDaysAgo(35);
  const custB = await seedCustomer({ createdAt: trialStartB, lifecycle: 'converted', accessStatus: 'active' });
  await seedSuccessfulPayment(custB, isoDaysAgo(10)); // 25 days after trial start — outside the 14-day window

  // Customer C: never converted. Its id is never referenced afterward —
  // it only needs to exist so it's counted in measurable_cohort_size.
  const _custC = await seedCustomer({ createdAt: isoDaysAgo(34), lifecycle: 'trial', accessStatus: 'active' });

  // Customer D: LEGACY — lifecycle says converted, but no payment_events row at all. Must be excluded entirely.
  const custD = await seedCustomer({ createdAt: isoDaysAgo(33), lifecycle: 'retained', accessStatus: 'active' });

  const result = await metrics.trialToPaid14d(supabase, { cohortFrom, cohortTo });

  assert.equal(result.type, 'cohort');
  assert.equal(result.still_maturing, false, 'a cohort ending 30 days ago is well past its 14-day window');
  assert.equal(result.measurable_cohort_size, 3, 'A, B, C are measurable; D is legacy-excluded');
  assert.equal(result.converted_within_14d, 1, 'only customer A converted within the 14-day window');
  assert.equal(result.conversion_pct, Number(((1 / 3) * 100).toFixed(2)));
  assert.equal(result.legacy_excluded_count, 1);
  assert.ok(result.legacy_excluded_customer_ids.includes(custD));
  assert.ok(!result.legacy_excluded_customer_ids.includes(custA));
});

test('trial_to_paid_14d: a cohort whose 14-day window has NOT elapsed is marked still_maturing, with conversion_pct null', async () => {
  const cohortFrom = isoDaysAgo(2);
  const cohortTo = new Date().toISOString(); // ends "now" — its 14-day window clearly hasn't elapsed

  await seedCustomer({ createdAt: isoDaysAgo(1), lifecycle: 'trial', accessStatus: 'active' });

  const result = await metrics.trialToPaid14d(supabase, { cohortFrom, cohortTo });

  assert.equal(result.still_maturing, true);
  assert.equal(result.conversion_pct, null, 'a still-maturing cohort must never publish a percentage that could depress a blended headline number');
});

test('trial_to_paid_14d requires an explicit cohort range — never silently defaults one', async () => {
  await assert.rejects(() => metrics.trialToPaid14d(supabase, {}));
});

/* ─────────────────────────── new_paid_customer ─────────────────────────── */

test('new_paid_customer counts only the FIRST-EVER successful payment per customer, never a renewal', async () => {
  const custId = await seedCustomer({ createdAt: isoDaysAgo(60), lifecycle: 'retained' });
  const firstPaymentAt = isoDaysAgo(55);
  const renewalAt = isoDaysAgo(25);
  await seedSuccessfulPayment(custId, firstPaymentAt);
  await seedSuccessfulPayment(custId, renewalAt);

  // A window covering only the renewal must NOT count this customer as new.
  const renewalWindow = await metrics.newPaidCustomer(supabase, { from: isoDaysAgo(30), to: isoDaysAgo(20) });
  assert.equal(renewalWindow.count, 0, 'a renewal must never be counted as a new_paid_customer');

  // A window covering the first payment DOES count them.
  const firstWindow = await metrics.newPaidCustomer(supabase, { from: isoDaysAgo(56), to: isoDaysAgo(54) });
  assert.equal(firstWindow.count, 1);
});

/**
 * CODE-REVIEW FIX (round 2, "use Stripe event time for
 * payment_events.occurred_at") — end-to-end proof that the REAL
 * recordPaymentSucceeded() code path (not a hand-inserted test row)
 * derives occurred_at from Stripe's event.created, and that
 * newPaidCustomer()/trialToPaid14d() correctly key off that event-time
 * value rather than whenever the test happened to run ("processing
 * time"). See payment-ledger.test.mjs for the same fix proven directly
 * against logPaymentEvent()'s output for refund/dispute events.
 */
test('newPaidCustomer/trialToPaid14d reflect Stripe event.created (event time), not webhook processing time ("today")', async () => {
  const trialStart = isoDaysAgo(21);
  const custId = await seedCustomer({ createdAt: trialStart, lifecycle: 'trial', accessStatus: 'active' });
  const subId = `sub_${randomUUID()}`;
  await seedSubscription(custId, subId);

  // The Stripe event says this payment occurred 5 days after trial start
  // (well within the 14-day window) — a fixed point in the past, entirely
  // independent of whatever moment this test actually executes ("today").
  const eventCreatedUnixSeconds = Math.floor((new Date(trialStart).getTime() + 5 * 24 * 60 * 60 * 1000) / 1000);
  // Stripe's event.created is always whole-second precision (an integer
  // unix timestamp) — so the expected occurred_at is the same
  // second-truncated instant, not the sub-second-precision value it was
  // derived from above.
  const eventOccurredAt = new Date(eventCreatedUnixSeconds * 1000);

  const event = {
    id: `evt_${randomUUID()}`,
    type: 'invoice.payment_succeeded',
    created: eventCreatedUnixSeconds,
    data: { object: { id: `in_${randomUUID()}`, subscription: subId, amount_paid: 150000, currency: 'inr' } },
  };

  await recordPaymentSucceeded(supabase, event);

  const { rows } = await pool.query('SELECT occurred_at FROM payment_events WHERE stripe_event_id=$1', [event.id]);
  assert.equal(
    new Date(rows[0].occurred_at).toISOString(),
    eventOccurredAt.toISOString(),
    'occurred_at must equal the Stripe event.created time, regardless of when the webhook was actually processed'
  );

  // newPaidCustomer, windowed exactly around the event-time date, must
  // count this customer — it would NOT if occurred_at had instead been
  // stamped with "now" (today), since today is far outside this window.
  const window = await metrics.newPaidCustomer(supabase, {
    from: new Date(eventOccurredAt.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    to: new Date(eventOccurredAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  });
  assert.equal(window.count, 1, 'newPaidCustomer must key off the real event time, not processing time');

  // trialToPaid14d must likewise classify this as converted-within-14d
  // using the real event time.
  const cohort = await metrics.trialToPaid14d(supabase, {
    cohortFrom: isoDaysAgo(22),
    cohortTo: isoDaysAgo(20),
  });
  assert.equal(cohort.converted_within_14d, 1);
  assert.equal(cohort.measurable_cohort_size, 1);
});

/* ──────────────────── no silent truncation beyond one page ──────────────────── */

test('sumAmountByCurrency (gross_revenue): sums EVERY matching row across multiple pages, never truncates at the page boundary', async () => {
  metrics.__setMetricPageSizeForTests(2);
  try {
    const custId = await seedCustomer({ createdAt: isoDaysAgo(10) });
    const from = isoDaysAgo(5);
    const to = new Date().toISOString();
    // A currency used nowhere else in this file, so this test's total is
    // never accidentally combined with another test's 'inr'/'usd' rows
    // that happen to share an overlapping date window (grossRevenue is a
    // GLOBAL sum, not scoped to one customer).
    // 5 rows against a page size of 2 — forces 3 pages.
    for (let i = 0; i < 5; i++) {
      await seedSuccessfulPayment(custId, isoDaysAgo(4 - i * 0.1), { amount: 100, currency: 'jpy' });
    }

    const gross = await metrics.grossRevenue(supabase, { from, to });
    assert.equal(gross.by_currency.jpy, 500, 'all 5 rows (3 pages at page size 2) must be summed, not just the first page');
  } finally {
    metrics.__resetMetricPageSizeForTests();
  }
});

test('trial_to_paid_14d: the cohort population is NOT truncated at a page boundary', async () => {
  metrics.__setMetricPageSizeForTests(2);
  try {
    // A cohort window used nowhere else in this file, so pre-existing
    // customers seeded by other tests can never leak into this count.
    const cohortFrom = isoDaysAgo(90);
    const cohortTo = isoDaysAgo(85);
    // 5 trial customers in the cohort window against a page size of 2.
    for (let i = 0; i < 5; i++) {
      await seedCustomer({ createdAt: isoDaysAgo(87 - i * 0.1), lifecycle: 'trial', accessStatus: 'active' });
    }

    const result = await metrics.trialToPaid14d(supabase, { cohortFrom, cohortTo });
    assert.equal(result.measurable_cohort_size, 5, 'all 5 cohort customers must be counted, not just the first page');
  } finally {
    metrics.__resetMetricPageSizeForTests();
  }
});

test('new_paid_customer: the first-payment-per-customer population is NOT truncated at a page boundary', async () => {
  metrics.__setMetricPageSizeForTests(2);
  try {
    // A window far from every other test's isoDaysAgo(...) range in this
    // file (newPaidCustomer is a GLOBAL metric, not scoped to one
    // customer, so an overlapping window would silently inflate or
    // corrupt another test's count).
    const from = isoDaysAgo(200);
    const to = isoDaysAgo(199);
    for (let i = 0; i < 5; i++) {
      const custId = await seedCustomer({ createdAt: isoDaysAgo(205) });
      await seedSuccessfulPayment(custId, isoDaysAgo(199.5 - i * 0.05));
    }

    const result = await metrics.newPaidCustomer(supabase, { from, to });
    assert.equal(result.count, 5, 'all 5 first-payment customers must be counted, not just the first page');
  } finally {
    metrics.__resetMetricPageSizeForTests();
  }
});

test('open_dispute: every open dispute is returned, not just the first page', async () => {
  metrics.__setMetricPageSizeForTests(1);
  try {
    const custId = await seedCustomer({ createdAt: isoDaysAgo(5) });
    for (let i = 0; i < 3; i++) {
      await seedDisputeCreated(custId, isoDaysAgo(1 - i * 0.01), `dp_${randomUUID()}`);
    }

    const result = await metrics.openDispute(supabase);
    assert.equal(result.count, 3, 'all 3 open disputes must be returned, not just the first page');
    assert.equal(result.items.length, 3);
  } finally {
    metrics.__resetMetricPageSizeForTests();
  }
});

test('funnel_traffic: totals are NOT truncated once site_traffic_daily has more rows than one page', async () => {
  metrics.__setMetricPageSizeForTests(2);
  try {
    const day = '2026-03-01';
    // 5 distinct rows (distinct campaign_code keeps each row separate
    // under the composite primary key) against a page size of 2.
    for (let i = 0; i < 5; i++) {
      await seedSiteTraffic({ day, event: 'opened', campaignCode: `camp-${i}`, visitCount: 1 });
    }

    const result = await metrics.funnelTraffic(supabase, { from: '2026-03-01', to: '2026-03-02' });
    assert.equal(result.website_visit, 5, 'all 5 rows must be summed, not just the first page');
  } finally {
    metrics.__resetMetricPageSizeForTests();
  }
});

test('churn: per-row voluntary/involuntary classification is NOT truncated at a page boundary', async () => {
  metrics.__setMetricPageSizeForTests(2);
  try {
    // A fixed, isolated historical instant (churn() is a GLOBAL metric —
    // an overlapping window with the "now"-relative churn test above
    // would silently inflate its count).
    const cancelledAt = '2020-01-15T00:00:00.000Z';
    for (let i = 0; i < 5; i++) {
      await seedLead({ status: 'Cancelled', cancelRequestedAt: i % 2 === 0 ? cancelledAt : null, cancelledAt });
    }

    const result = await metrics.churn(supabase, { from: '2020-01-14T00:00:00.000Z', to: '2020-01-16T00:00:00.000Z' });
    assert.equal(result.total_churn, 5, 'all 5 churned leads must be classified and counted, not just the first page');
  } finally {
    metrics.__resetMetricPageSizeForTests();
  }
});

/* ────────────────────────────── currency ────────────────────────────────── */

test('gross_revenue / refund_amount / net_revenue are always BY CURRENCY, never blended into one number', async () => {
  const custId = await seedCustomer({ createdAt: isoDaysAgo(10) });
  const from = isoDaysAgo(5);
  const to = new Date().toISOString();

  await seedSuccessfulPayment(custId, isoDaysAgo(3), { amount: 1000, currency: 'inr' });
  await seedSuccessfulPayment(custId, isoDaysAgo(2), { amount: 50, currency: 'usd' });
  await seedRefund(custId, isoDaysAgo(1), { amount: 200, currency: 'inr' });
  await seedRefund(custId, isoDaysAgo(1), { amount: 10, currency: 'gbp' }); // no corresponding gross in gbp at all

  const gross = await metrics.grossRevenue(supabase, { from, to });
  const refunds = await metrics.refundAmount(supabase, { from, to });
  const net = await metrics.netRevenue(supabase, { from, to });

  assert.equal(gross.by_currency.inr, 1000);
  assert.equal(gross.by_currency.usd, 50);
  assert.equal(gross.by_currency.gbp, undefined, 'no gross gbp revenue exists — must not appear as 0 or be fabricated');
  assert.equal(refunds.by_currency.inr, 200);
  assert.equal(refunds.by_currency.gbp, 10);
  assert.equal(net.by_currency.inr, 800);
  assert.equal(net.by_currency.usd, 50, 'usd has no refunds, so net usd equals gross usd');
  assert.equal(net.by_currency.gbp, -10, 'a currency with only a refund and no gross correctly nets negative, not blended into another currency');

  // No blended/summed total field anywhere on these results.
  assert.equal('total' in gross, false);
  assert.equal('amount' in gross, false);
});

/* ─────────────────────────────── churn ──────────────────────────────────── */

test('churn(): voluntary vs involuntary classification, and total_churn = their sum; NO churn_rate is ever computed', async () => {
  const now = new Date().toISOString();
  const yesterday = isoDaysAgo(1);

  await seedLead({ status: 'Cancelled', cancelRequestedAt: yesterday, cancelledAt: now }); // voluntary
  await seedLead({ status: 'Cancelled', cancelRequestedAt: null, cancelledAt: now }); // involuntary
  await seedLead({ status: 'Active', cancelRequestedAt: null, cancelledAt: null }); // not cancelled — irrelevant

  const result = await metrics.churn(supabase, { from: isoDaysAgo(2), to: isoDaysAgo(-1) });

  assert.equal(result.voluntary_churn, 1);
  assert.equal(result.involuntary_churn, 1);
  assert.equal(result.total_churn, 2);
  assert.match(result.limitation, /best-available classifier/i);
  assert.equal('churn_rate' in result, false, 'churn() must never return a rate, only counts');
});

test('there is no churn_rate export anywhere in the metrics module', () => {
  assert.equal(typeof metrics.churnRate, 'undefined');
  assert.equal(Object.keys(metrics).some((k) => /churnrate/i.test(k)), false);
});

/**
 * CODE-REVIEW FIX (round 2, "fix historical churn/cancelled metrics"):
 * leads.status is MUTABLE — a later refund/dispute/other status update on
 * an already-cancelled lead must never be able to erase a real
 * historical churn/cancellation event. cancelledCustomer() and churn()
 * now use cancelled_at IS NOT NULL as the sole durable historical
 * signal, dropping the old `status = 'Cancelled'` requirement. Uses a
 * fixed, isolated date range (2021-06-*) — both metrics are GLOBAL, so a
 * "now"-relative window here would risk colliding with the other churn
 * tests in this file.
 */
test('cancelledCustomer/churn: a later status change (Refunded/Disputed) never removes a customer from historical churn counts', async () => {
  const cancelledAt = '2021-06-15T00:00:00.000Z';
  const from = '2021-06-14T00:00:00.000Z';
  const to = '2021-06-16T00:00:00.000Z';

  // A) cancelled_at set, status='Cancelled' -> counted.
  await seedLead({ status: 'Cancelled', cancelRequestedAt: cancelledAt, cancelledAt });
  // B) cancelled_at set, status LATER changed to 'Refunded' -> STILL counted.
  await seedLead({ status: 'Refunded', cancelRequestedAt: cancelledAt, cancelledAt });
  // C) cancelled_at set, status LATER changed to 'Disputed' -> STILL counted.
  await seedLead({ status: 'Disputed', cancelRequestedAt: null, cancelledAt });
  // D) no cancelled_at at all -> NOT counted, regardless of status.
  await seedLead({ status: 'Cancelled', cancelRequestedAt: null, cancelledAt: null });

  const cancelledResult = await metrics.cancelledCustomer(supabase, { from, to });
  assert.equal(cancelledResult.count, 3, 'A, B, and C all have cancelled_at set and must all count, regardless of their current status; D has no cancelled_at and must not');

  const churnResult = await metrics.churn(supabase, { from, to });
  assert.equal(churnResult.total_churn, 3, 'churn() must use the same durable cancelled_at signal, immune to a later status change');
  assert.equal(churnResult.voluntary_churn, 2, 'A and B both have cancel_requested_at set');
  assert.equal(churnResult.involuntary_churn, 1, 'C has no cancel_requested_at');
});

/* ────────────────────────────── allocation ──────────────────────────────── */

test('allocated_seats excludes accounts with invalid/non-positive max_capacity, matching assignStuddyAccount()\'s own rule', async () => {
  await seedStuddyAccount(`Group-Valid-${randomUUID()}`, { maxCapacity: 5, activeCount: 2 });
  await seedStuddyAccount(`Group-Invalid-${randomUUID()}`, { maxCapacity: 0, activeCount: 0 });

  const result = await metrics.allocatedSeats(supabase);
  assert.ok(result.total_capacity >= 5);
  assert.ok(result.by_group.every((g) => g.max_capacity > 0));
});

/* ───────────── reconciliation.js checkAllocationMirror fix ───────────── */

test('a released/churned customer with no active assignment is NOT flagged as an allocation mirror gap', async () => {
  const groupName = `Group-Churned-${randomUUID()}`;
  await seedStuddyAccount(groupName, { maxCapacity: 7, activeCount: 0 });
  const stripeCustomerId = `cus_${randomUUID()}`;
  await seedCustomer({ stripeCustomerId, lifecycle: 'churned', accessStatus: 'ended' });
  await seedLead({ groupName, status: 'Cancelled', stripeCustomerId, stripeSubscriptionId: `sub_${randomUUID()}` });
  // Deliberately no active account_assignments row — this IS the healthy, released state.

  const result = await checkAllocationMirror(supabase);
  // None of the flagged items should reference this stripeCustomerId's lead.
  const { rows } = await pool.query('SELECT lead_id FROM leads WHERE stripe_customer_id=$1', [stripeCustomerId]);
  const thisLeadId = rows[0].lead_id;
  assert.equal(
    result.items.some((i) => i.lead_id === thisLeadId),
    false,
    'a legitimately released/churned customer must not be flagged — this is healthy, not a gap'
  );
});

test('an ACTIVE customer with no active assignment IS still flagged as a genuine allocation mirror gap', async () => {
  const groupName = `Group-Active-${randomUUID()}`;
  await seedStuddyAccount(groupName, { maxCapacity: 7, activeCount: 1 });
  const stripeCustomerId = `cus_${randomUUID()}`;
  await seedCustomer({ stripeCustomerId, lifecycle: 'converted', accessStatus: 'active' });
  const leadId = await seedLead({ groupName, status: 'Active', stripeCustomerId, stripeSubscriptionId: `sub_${randomUUID()}` });
  // No active account_assignments row for this genuinely-active customer — a REAL gap.

  const result = await checkAllocationMirror(supabase);
  const flagged = result.items.find((i) => i.lead_id === leadId);
  assert.ok(flagged, 'an active customer with no active assignment mirror must still be flagged');
  assert.equal(flagged.issue, 'no_active_assignment');
});

/* ─────────────────────── protected admin metrics endpoint ─────────────────────── */

async function seedAdminSession() {
  const salt = adminAuth.generateSalt();
  const hash = adminAuth.deriveHash('1234', salt);
  const res = await pool.query(
    `INSERT INTO admin_users (display_name, pin_hash, pin_salt) VALUES ($1, $2, $3) RETURNING id`,
    [`Metrics Test Admin ${randomUUID()}`, hash, salt]
  );
  const { token } = await adminAuth.createSession(supabase, res.rows[0].id);
  return token;
}

test('GET /api/admin/metrics with no session returns 401 and no metrics data', async () => {
  const res = fakeRes();
  await metricsHandler(fakeReq({ method: 'GET', headers: {}, query: {} }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res._json.metrics, undefined);
});

test('GET /api/admin/metrics with a valid session returns the expected metric keys, no churn_rate, no secrets', async () => {
  const token = await seedAdminSession();
  const res = fakeRes();
  await metricsHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` }, query: {} }), res);

  assert.equal(res.statusCode, 200);
  const { metrics: m } = res._json;
  for (const key of [
    'trial_started', 'active_trial', 'new_paid_customer', 'active_paid_customer',
    'successful_payment', 'failed_payment', 'gross_revenue', 'refund_amount', 'net_revenue',
    'open_dispute', 'cancellation_requested', 'cancelled_customer', 'churn',
    'allocated_seats', 'funnel_traffic',
  ]) {
    assert.ok(key in m, `expected metrics.${key} in the response`);
  }
  assert.equal(m.trial_to_paid_14d, null, 'omitted without an explicit cohortFrom/cohortTo — never guessed');

  const serialized = JSON.stringify(res._json);
  // churn()'s own `limitation` prose legitimately explains, by name, that
  // churn_rate is NOT computed — so this must assert there is no churn_rate
  // *field* (a JSON key), not merely that the substring never appears.
  assert.doesNotMatch(serialized, /"churn_rate"\s*:/i, 'response must never contain a churn_rate field');
  for (const forbidden of ['pin_hash', 'pin_salt', 'studdy_password', 'service_role', 'ADMIN_PIN_PEPPER']) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, 'i'), `response must never contain "${forbidden}"`);
  }
});

test('GET /api/admin/metrics with cohortFrom/cohortTo returns a computed trial_to_paid_14d', async () => {
  const token = await seedAdminSession();
  const res = fakeRes();
  await metricsHandler(
    fakeReq({
      method: 'GET',
      headers: { cookie: `sl_admin_session=${token}` },
      query: { cohortFrom: isoDaysAgo(40), cohortTo: isoDaysAgo(30) },
    }),
    res
  );
  assert.equal(res.statusCode, 200);
  assert.ok(res._json.metrics.trial_to_paid_14d, 'expected a computed cohort result when both cohort params are given');
  assert.equal(res._json.metrics.trial_to_paid_14d.type, 'cohort');
});

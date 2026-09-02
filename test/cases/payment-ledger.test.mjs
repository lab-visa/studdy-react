/**
 * CRM-2A — payment_events ledger completeness (refunds/disputes).
 *
 * Tests recordRefund()/recordDisputeCreated()/recordDisputeClosed()
 * (exported, unmodified in shape from api/_lib/sync-customer.js) directly
 * against the real payment_events table — proving: positive/absolute
 * amount convention, dispute-id correlation via raw_metadata->>'id',
 * idempotency (dedup on stripe_event_id, same mechanism
 * recordPaymentSucceeded/recordPaymentFailed already use), a missing
 * customer degrading to a safe no-op, and — critically —
 * payment_claims/claimPaymentEvent() being completely untouched by any
 * of this (see payment.test.mjs for that table's own, separate,
 * unmodified tests).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { recordRefund, recordDisputeCreated, recordDisputeClosed, recordPaymentFailed } from '../../api/_lib/sync-customer.js';
import { grossRevenue, netRevenue } from '../../api/_lib/metrics.js';

let pool;
let supabase;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
});

after(async () => {
  await closeTestPool();
});

async function seedCustomer() {
  const stripeCustomerId = `cus_test_${randomUUID()}`;
  const res = await pool.query(
    `INSERT INTO customers (stripe_customer_id) VALUES ($1) RETURNING id`,
    [stripeCustomerId]
  );
  return { customerId: res.rows[0].id, stripeCustomerId };
}

async function seedCustomerWithSubscription() {
  const { customerId, stripeCustomerId } = await seedCustomer();
  const stripeSubscriptionId = `sub_test_${randomUUID()}`;
  await pool.query(
    `INSERT INTO subscriptions (customer_id, stripe_subscription_id, status) VALUES ($1, $2, 'active')`,
    [customerId, stripeSubscriptionId]
  );
  return { customerId, stripeCustomerId, stripeSubscriptionId };
}

function paymentFailedEvent({ id, stripeSubscriptionId, amountDueCents = 250000, currency = 'inr', created }) {
  return {
    id,
    type: 'invoice.payment_failed',
    created,
    data: {
      object: {
        id: `in_${randomUUID()}`,
        subscription: stripeSubscriptionId,
        amount_due: amountDueCents,
        amount_paid: 0,
        currency,
      },
    },
  };
}

function refundEvent({ id, chargeId, amountCents = 150000, currency = 'inr', reason = 'requested_by_customer' }) {
  return {
    id,
    type: 'refund.created',
    data: { object: { id: `re_${randomUUID()}`, charge: chargeId, amount: amountCents, currency, reason, status: 'succeeded' } },
  };
}

function disputeCreatedEvent({ id, disputeId, chargeId, amountCents = 200000, currency = 'usd' }) {
  return {
    id,
    type: 'charge.dispute.created',
    data: { object: { id: disputeId, charge: chargeId, amount: amountCents, currency, status: 'needs_response' } },
  };
}

function disputeClosedEvent({ id, disputeId, chargeId, amountCents = 200000, currency = 'usd', status = 'won' }) {
  return {
    id,
    type: 'charge.dispute.closed',
    data: { object: { id: disputeId, charge: chargeId, amount: amountCents, currency, status } },
  };
}

test('recordRefund writes a payment_events row with a POSITIVE, absolute amount (no sign games)', async () => {
  const { customerId, stripeCustomerId } = await seedCustomer();
  const event = refundEvent({ id: `evt_${randomUUID()}`, chargeId: 'ch_test_1', amountCents: 150000, currency: 'inr' });

  await recordRefund(supabase, event, { stripeCustomerId });

  const { rows } = await pool.query('SELECT * FROM payment_events WHERE stripe_event_id=$1', [event.id]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event_type, 'refund.created');
  assert.equal(rows[0].customer_id, customerId);
  assert.equal(Number(rows[0].amount), 1500, 'amount must be the positive, absolute rupee amount (150000 cents / 100)');
  assert.equal(rows[0].currency, 'inr');
});

test('recordDisputeCreated then recordDisputeClosed correlate via the SAME stable Stripe dispute id (raw_metadata->>id)', async () => {
  const { stripeCustomerId } = await seedCustomer();
  const disputeId = `dp_${randomUUID()}`;
  const chargeId = 'ch_test_2';

  const createdEvent = disputeCreatedEvent({ id: `evt_${randomUUID()}`, disputeId, chargeId, amountCents: 200000 });
  await recordDisputeCreated(supabase, createdEvent, { stripeCustomerId });

  const closedEvent = disputeClosedEvent({ id: `evt_${randomUUID()}`, disputeId, chargeId, amountCents: 200000, status: 'won' });
  await recordDisputeClosed(supabase, closedEvent, { stripeCustomerId });

  const { rows: createdRows } = await pool.query(
    `SELECT * FROM payment_events WHERE event_type='charge.dispute.created' AND raw_metadata->>'id' = $1`,
    [disputeId]
  );
  const { rows: closedRows } = await pool.query(
    `SELECT * FROM payment_events WHERE event_type='charge.dispute.closed' AND raw_metadata->>'id' = $1`,
    [disputeId]
  );

  assert.equal(createdRows.length, 1);
  assert.equal(closedRows.length, 1);
  assert.equal(
    createdRows[0].raw_metadata.id,
    closedRows[0].raw_metadata.id,
    'created and closed rows for the same dispute must correlate by the identical Stripe dispute id'
  );
  assert.equal(closedRows[0].status, 'won');
  assert.equal(Number(createdRows[0].amount), 2000);
  assert.equal(Number(closedRows[0].amount), 2000, 'closed row mirrors the original disputed amount');
});

test('a duplicate delivery of the same refund event does not double-insert (same dedup mechanism as existing payment events)', async () => {
  const { stripeCustomerId } = await seedCustomer();
  const event = refundEvent({ id: `evt_${randomUUID()}`, chargeId: 'ch_test_3' });

  await recordRefund(supabase, event, { stripeCustomerId });
  await recordRefund(supabase, event, { stripeCustomerId }); // Stripe redelivery

  const { rows } = await pool.query('SELECT * FROM payment_events WHERE stripe_event_id=$1', [event.id]);
  assert.equal(rows.length, 1, 'a redelivered refund.created event must not create a second ledger row');
});

test('no matching customers row (e.g. legacy pre-CRM-1 customer) is a safe no-op, never throws, never fabricates a row', async () => {
  const event = refundEvent({ id: `evt_${randomUUID()}`, chargeId: 'ch_test_4' });
  await assert.doesNotReject(() => recordRefund(supabase, event, { stripeCustomerId: `cus_unknown_${randomUUID()}` }));

  const { rows } = await pool.query('SELECT * FROM payment_events WHERE stripe_event_id=$1', [event.id]);
  assert.equal(rows.length, 0, 'no ledger row should be created when no matching customer exists');
});

test('payment_claims is completely untouched by refund/dispute ledger writes', async () => {
  const { stripeCustomerId } = await seedCustomer();
  const before = await pool.query('SELECT count(*)::int AS c FROM payment_claims');

  await recordRefund(supabase, refundEvent({ id: `evt_${randomUUID()}`, chargeId: 'ch_test_5' }), { stripeCustomerId });
  const disputeId = `dp_${randomUUID()}`;
  await recordDisputeCreated(supabase, disputeCreatedEvent({ id: `evt_${randomUUID()}`, disputeId, chargeId: 'ch_test_6' }), {
    stripeCustomerId,
  });
  await recordDisputeClosed(supabase, disputeClosedEvent({ id: `evt_${randomUUID()}`, disputeId, chargeId: 'ch_test_6' }), {
    stripeCustomerId,
  });

  const after = await pool.query('SELECT count(*)::int AS c FROM payment_claims');
  assert.equal(after.rows[0].c, before.rows[0].c, 'payment_claims row count must be unaffected by any refund/dispute ledger write');
});

test('dispute/refund amounts never leak into a generic sum — event_type scoping is what keeps them out of revenue', async () => {
  // This is a documentation-level assertion that the metrics layer (see
  // metrics.test.mjs for the full currency-separation tests) can only
  // ever sum payment_events.amount when explicitly filtered by
  // event_type='invoice.payment_succeeded' — proven here by confirming a
  // refund/dispute row's event_type is never that value.
  const { stripeCustomerId } = await seedCustomer();
  const event = refundEvent({ id: `evt_${randomUUID()}`, chargeId: 'ch_test_7' });
  await recordRefund(supabase, event, { stripeCustomerId });

  const { rows } = await pool.query('SELECT event_type FROM payment_events WHERE stripe_event_id=$1', [event.id]);
  assert.notEqual(rows[0].event_type, 'invoice.payment_succeeded');
});

/* ──────── CODE-REVIEW FIX: complete failed-payment ledger fields ──────── */

test('recordPaymentFailed now stores the attempted amount and currency (invoice.amount_due), not just status', async () => {
  const { stripeSubscriptionId } = await seedCustomerWithSubscription();
  const event = paymentFailedEvent({
    id: `evt_${randomUUID()}`,
    stripeSubscriptionId,
    amountDueCents: 250000,
    currency: 'inr',
    created: Math.floor(Date.now() / 1000),
  });

  await recordPaymentFailed(supabase, event);

  const { rows } = await pool.query('SELECT * FROM payment_events WHERE stripe_event_id=$1', [event.id]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event_type, 'invoice.payment_failed');
  assert.equal(rows[0].status, 'failed');
  assert.equal(Number(rows[0].amount), 2500, 'the attempted amount must be positive and stored (250000 cents / 100), for operational visibility');
  assert.equal(rows[0].currency, 'inr');
});

test('a failed payment amount is retained for visibility but NEVER counted in gross_revenue or net_revenue', async () => {
  // A window unique to this test file/date range — grossRevenue/netRevenue
  // are GLOBAL sums, so an isolated currency avoids any risk of collision
  // with amounts seeded by other tests in this process.
  const { stripeSubscriptionId } = await seedCustomerWithSubscription();
  const now = Math.floor(Date.now() / 1000);
  const event = paymentFailedEvent({
    id: `evt_${randomUUID()}`,
    stripeSubscriptionId,
    amountDueCents: 999900,
    currency: 'kwd', // a currency used nowhere else in this test process
    created: now,
  });

  await recordPaymentFailed(supabase, event);

  const from = new Date(Date.now() - 60 * 1000).toISOString();
  const to = new Date(Date.now() + 60 * 1000).toISOString();
  const gross = await grossRevenue(supabase, { from, to });
  const net = await netRevenue(supabase, { from, to });

  assert.equal(gross.by_currency.kwd, undefined, 'a failed payment must never appear in gross_revenue, positive amount or not');
  assert.equal(net.by_currency.kwd, undefined, 'a failed payment must never appear in net_revenue either');
});

/* ──────── CODE-REVIEW FIX: use Stripe event time, not processing time ──────── */

test('payment_events.occurred_at uses Stripe event.created (event time), not webhook processing time — proven with event.created on a fixed past day regardless of when this test actually runs', async () => {
  const { stripeCustomerId } = await seedCustomer();
  // A fixed "Day 1" instant, entirely independent of whatever "today" is
  // when this test suite happens to execute (its own "Day 2", so to
  // speak) — occurred_at must reflect Day 1, never the processing moment.
  const day1 = new Date('2026-01-01T10:00:00.000Z');
  const event = refundEvent({ id: `evt_${randomUUID()}`, chargeId: 'ch_test_event_time' });
  event.created = Math.floor(day1.getTime() / 1000);

  await recordRefund(supabase, event, { stripeCustomerId });

  const { rows } = await pool.query('SELECT occurred_at FROM payment_events WHERE stripe_event_id=$1', [event.id]);
  assert.equal(new Date(rows[0].occurred_at).toISOString(), day1.toISOString());
  assert.notEqual(
    new Date(rows[0].occurred_at).toDateString(),
    new Date().toDateString(),
    'occurred_at must not be stamped with today\'s date just because processing happened today'
  );
});

test('a missing/invalid event.created falls back to current time defensively, rather than throwing', async () => {
  const { stripeCustomerId } = await seedCustomer();
  const event = refundEvent({ id: `evt_${randomUUID()}`, chargeId: 'ch_test_no_created' });
  event.created = undefined; // malformed/absent — should never happen for a real Stripe delivery, but must not break the webhook

  const before = Date.now();
  await assert.doesNotReject(() => recordRefund(supabase, event, { stripeCustomerId }));
  const after = Date.now();

  const { rows } = await pool.query('SELECT occurred_at FROM payment_events WHERE stripe_event_id=$1', [event.id]);
  const occurredMs = new Date(rows[0].occurred_at).getTime();
  assert.ok(occurredMs >= before - 1000 && occurredMs <= after + 1000, 'falls back to "now" only when event.created is unusable');
});

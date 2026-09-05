/**
 * CRM-3A ChatGPT review round 2 — "cancellation timestamp precedence".
 *
 * Proves recordSubscriptionEnded() (customer.subscription.deleted) and
 * syncSubscriptionUpdated() (customer.subscription.updated with
 * status=canceled), both in api/_lib/sync-customer.js, resolve
 * subscriptions.cancelled_at/ended_at with the exact required
 * precedence — Stripe's own Subscription-object canceled_at first,
 * then its own ended_at, and only for .deleted does a missing pair
 * fall back to event.created (never wall-clock "now", never
 * updated_at) — and that both are idempotent under Stripe's
 * occasional duplicate webhook delivery.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { recordSubscriptionEnded, syncSubscriptionUpdated } from '../../api/_lib/sync-customer.js';

let pool;
let supabase;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
});

after(async () => {
  await closeTestPool();
});

beforeEach(async () => {
  await pool.query('TRUNCATE customers, subscriptions, account_assignments RESTART IDENTITY CASCADE');
});

async function seedCustomerAndSubscription({ status = 'active' } = {}) {
  const custRes = await pool.query(`INSERT INTO customers (stripe_customer_id) VALUES ($1) RETURNING id`, [`cus_${randomUUID()}`]);
  const customerId = custRes.rows[0].id;
  const stripeSubId = `sub_${randomUUID()}`;
  await pool.query(`INSERT INTO subscriptions (customer_id, stripe_subscription_id, status) VALUES ($1, $2, $3)`, [
    customerId,
    stripeSubId,
    status,
  ]);
  return { customerId, stripeSubId };
}

function deletedEvent({ stripeSubId, canceled_at, ended_at, created }) {
  return {
    id: `evt_${randomUUID()}`,
    type: 'customer.subscription.deleted',
    created,
    data: { object: { id: stripeSubId, canceled_at, ended_at } },
  };
}

async function fetchSub(customerId) {
  const { rows } = await pool.query('SELECT cancelled_at, ended_at, status FROM subscriptions WHERE customer_id=$1', [customerId]);
  return rows[0];
}

/* ─────────────────────── customer.subscription.deleted precedence ─────────────────────── */

test('recordSubscriptionEnded: both canceled_at and ended_at present and DIFFERENT — each DB column gets its own precise Stripe field, not one value copied onto both', async () => {
  const { customerId, stripeSubId } = await seedCustomerAndSubscription();
  const canceledAt = Math.floor(new Date('2026-08-10T00:00:00.000Z').getTime() / 1000);
  const endedAt = Math.floor(new Date('2026-08-20T00:00:00.000Z').getTime() / 1000); // a real scheduled-cancellation gap
  const eventCreated = Math.floor(new Date('2026-08-21T00:00:00.000Z').getTime() / 1000); // webhook processed even later — must NOT be used

  await recordSubscriptionEnded(supabase, deletedEvent({ stripeSubId, canceled_at: canceledAt, ended_at: endedAt, created: eventCreated }));

  const row = await fetchSub(customerId);
  assert.equal(row.cancelled_at.toISOString(), '2026-08-10T00:00:00.000Z', "cancelled_at must come from Stripe's own canceled_at, not ended_at or event.created");
  assert.equal(row.ended_at.toISOString(), '2026-08-20T00:00:00.000Z', "ended_at must come from Stripe's own ended_at, not canceled_at or event.created");
});

test('recordSubscriptionEnded: only canceled_at present — ended_at falls back to canceled_at, not event.created', async () => {
  const { customerId, stripeSubId } = await seedCustomerAndSubscription();
  const canceledAt = Math.floor(new Date('2026-08-10T00:00:00.000Z').getTime() / 1000);
  const eventCreated = Math.floor(new Date('2026-08-21T00:00:00.000Z').getTime() / 1000);

  await recordSubscriptionEnded(supabase, deletedEvent({ stripeSubId, canceled_at: canceledAt, ended_at: null, created: eventCreated }));

  const row = await fetchSub(customerId);
  assert.equal(row.cancelled_at.toISOString(), '2026-08-10T00:00:00.000Z');
  assert.equal(row.ended_at.toISOString(), '2026-08-10T00:00:00.000Z', 'ended_at must fall back to canceled_at, never straight to event.created while a genuine Stripe field is available');
});

test('recordSubscriptionEnded: only ended_at present — cancelled_at falls back to ended_at, not event.created', async () => {
  const { customerId, stripeSubId } = await seedCustomerAndSubscription();
  const endedAt = Math.floor(new Date('2026-08-10T00:00:00.000Z').getTime() / 1000);
  const eventCreated = Math.floor(new Date('2026-08-21T00:00:00.000Z').getTime() / 1000);

  await recordSubscriptionEnded(supabase, deletedEvent({ stripeSubId, canceled_at: null, ended_at: endedAt, created: eventCreated }));

  const row = await fetchSub(customerId);
  assert.equal(row.ended_at.toISOString(), '2026-08-10T00:00:00.000Z');
  assert.equal(row.cancelled_at.toISOString(), '2026-08-10T00:00:00.000Z', 'cancelled_at must fall back to ended_at, never straight to event.created while a genuine Stripe field is available');
});

test('recordSubscriptionEnded: NEITHER canceled_at nor ended_at present — both fall back to event.created (the documented last resort), never to wall-clock "now"', async () => {
  const { customerId, stripeSubId } = await seedCustomerAndSubscription();
  const eventCreated = Math.floor(new Date('2026-08-15T00:00:00.000Z').getTime() / 1000);

  const before = Date.now();
  await recordSubscriptionEnded(supabase, deletedEvent({ stripeSubId, canceled_at: null, ended_at: null, created: eventCreated }));
  void before;

  const row = await fetchSub(customerId);
  assert.equal(row.cancelled_at.toISOString(), '2026-08-15T00:00:00.000Z', 'must fall back to event.created, not the moment this test ran');
  assert.equal(row.ended_at.toISOString(), '2026-08-15T00:00:00.000Z');
});

test('recordSubscriptionEnded: idempotent under a redelivered identical event — same stored timestamps every time, no wall-clock drift', async () => {
  const { customerId, stripeSubId } = await seedCustomerAndSubscription();
  const event = deletedEvent({
    stripeSubId,
    canceled_at: Math.floor(new Date('2026-08-10T00:00:00.000Z').getTime() / 1000),
    ended_at: Math.floor(new Date('2026-08-12T00:00:00.000Z').getTime() / 1000),
    created: Math.floor(new Date('2026-08-13T00:00:00.000Z').getTime() / 1000),
  });

  await recordSubscriptionEnded(supabase, event);
  const first = await fetchSub(customerId);

  await recordSubscriptionEnded(supabase, event); // Stripe redelivers the SAME event
  const second = await fetchSub(customerId);

  assert.equal(second.cancelled_at.getTime(), first.cancelled_at.getTime());
  assert.equal(second.ended_at.getTime(), first.ended_at.getTime());
  assert.equal(first.cancelled_at.toISOString(), '2026-08-10T00:00:00.000Z');
});

/* ─────────────────────── customer.subscription.updated (status=canceled) ─────────────────────── */

function updatedEvent({ stripeSubId, status, canceled_at, ended_at, created }) {
  return {
    id: `evt_${randomUUID()}`,
    type: 'customer.subscription.updated',
    created,
    data: { object: { id: stripeSubId, status, canceled_at, ended_at, cancel_at_period_end: false } },
  };
}

test('syncSubscriptionUpdated: status=canceled with genuine canceled_at/ended_at persists them, same precedence as .deleted', async () => {
  const { customerId, stripeSubId } = await seedCustomerAndSubscription({ status: 'active' });
  const canceledAt = Math.floor(new Date('2026-08-05T00:00:00.000Z').getTime() / 1000);
  const endedAt = Math.floor(new Date('2026-08-06T00:00:00.000Z').getTime() / 1000);

  await syncSubscriptionUpdated(supabase, updatedEvent({ stripeSubId, status: 'canceled', canceled_at: canceledAt, ended_at: endedAt, created: Math.floor(Date.now() / 1000) }));

  const row = await fetchSub(customerId);
  assert.equal(row.status, 'cancelled');
  assert.equal(row.cancelled_at.toISOString(), '2026-08-05T00:00:00.000Z');
  assert.equal(row.ended_at.toISOString(), '2026-08-06T00:00:00.000Z');
});

test('syncSubscriptionUpdated: status=canceled but NEITHER genuine Stripe timestamp present — cancelled_at/ended_at are left untouched, never invented from event.created or wall-clock', async () => {
  const { customerId, stripeSubId } = await seedCustomerAndSubscription({ status: 'active' });

  await syncSubscriptionUpdated(supabase, updatedEvent({ stripeSubId, status: 'canceled', canceled_at: null, ended_at: null, created: Math.floor(Date.now() / 1000) }));

  const row = await fetchSub(customerId);
  assert.equal(row.status, 'cancelled', 'status itself is still synced — only the timestamp columns stay untouched');
  assert.equal(row.cancelled_at, null, 'must never invent a cancellation date on this secondary/defensive path — event.created is deliberately NOT used here');
  assert.equal(row.ended_at, null);
});

test('syncSubscriptionUpdated: idempotent under a redelivered identical status=canceled event', async () => {
  const { customerId, stripeSubId } = await seedCustomerAndSubscription({ status: 'active' });
  const event = updatedEvent({
    stripeSubId,
    status: 'canceled',
    canceled_at: Math.floor(new Date('2026-08-05T00:00:00.000Z').getTime() / 1000),
    ended_at: null,
    created: Math.floor(Date.now() / 1000),
  });

  await syncSubscriptionUpdated(supabase, event);
  const first = await fetchSub(customerId);

  await syncSubscriptionUpdated(supabase, event);
  const second = await fetchSub(customerId);

  assert.equal(second.cancelled_at.getTime(), first.cancelled_at.getTime());
  assert.equal(first.cancelled_at.toISOString(), '2026-08-05T00:00:00.000Z');
  assert.equal(first.ended_at.toISOString(), '2026-08-05T00:00:00.000Z', 'ended_at falls back to canceled_at, same precedence rule as .deleted');
});

test('syncSubscriptionUpdated: a non-canceled status update never touches cancelled_at/ended_at at all', async () => {
  const { customerId, stripeSubId } = await seedCustomerAndSubscription({ status: 'active' });
  // Pre-seed a real cancelled_at, as if set by an earlier event, to prove
  // an unrelated later update genuinely leaves it alone (not merely "null stays null").
  await pool.query(`UPDATE subscriptions SET cancelled_at = '2026-08-01T00:00:00.000Z', ended_at = '2026-08-01T00:00:00.000Z' WHERE customer_id = $1`, [customerId]);

  await syncSubscriptionUpdated(supabase, updatedEvent({ stripeSubId, status: 'past_due', canceled_at: null, ended_at: null, created: Math.floor(Date.now() / 1000) }));

  const row = await fetchSub(customerId);
  assert.equal(row.status, 'past_due');
  assert.equal(row.cancelled_at.toISOString(), '2026-08-01T00:00:00.000Z', 'an unrelated status update must never clear or alter a previously-recorded cancellation date');
  assert.equal(row.ended_at.toISOString(), '2026-08-01T00:00:00.000Z');
});

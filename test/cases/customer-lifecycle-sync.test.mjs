/**
 * CRM-3A — proves the sync-customer.js changes this round actually wire
 * up correctly against the real schema:
 *   1. syncCustomerFromCheckoutSession() copies a lead_attribution row
 *      onto the new customer (first-touch AND latest-touch), and never
 *      overwrites first-touch on a resync.
 *   2. syncSubscriptionUpdated() (new function, wired to
 *      customer.subscription.updated in api/stripe-webhook.js) actually
 *      populates cancel_at_period_end/current_period_end/status — the
 *      exact gap identified in the CRM-3A pre-coding report — and never
 *      invents a subscriptions row that doesn't already exist.
 *   3. Existing stripe_customer_id-keyed duplicate-customer prevention
 *      still holds with attribution copy-in added (a resync for the same
 *      Stripe customer updates the one existing row, never inserts a
 *      second one).
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { syncCustomerFromCheckoutSession, syncSubscriptionUpdated } from '../../api/_lib/sync-customer.js';
import { captureAttribution } from '../../api/_lib/attribution.js';

const repoRoot = join(new URL('.', import.meta.url).pathname, '..', '..');

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
  await pool.query('TRUNCATE customers, subscriptions, lead_attribution, account_assignments RESTART IDENTITY CASCADE');
});

function buildSession({ sessionId, leadId, customerId, subStatus = 'trialing' }) {
  return {
    id: sessionId,
    client_reference_id: leadId || null,
    customer: { id: customerId, email: `${customerId}@example.test`, name: 'Test Parent' },
    customer_details: { email: `${customerId}@example.test`, name: 'Test Parent', address: { country: 'US', state: 'CA' } },
    subscription: {
      id: `sub_${customerId}`,
      status: subStatus,
      trial_start: Math.floor(Date.now() / 1000),
      trial_end: Math.floor(Date.now() / 1000) + 7 * 86400,
      items: { data: [{ price: { recurring: { interval: 'month' }, currency: 'usd', unit_amount: 4099 } }] },
    },
  };
}

/* ─────────────────────── attribution copy-in ─────────────────────── */

test('checkout.session.completed copies first + latest attribution from lead_attribution onto the new customer', async () => {
  const leadId = `lead-${randomUUID()}`;
  await captureAttribution(supabase, {
    leadId,
    first: { utmSource: 'whatsapp', utmCampaign: 'WA-260901-IN-01' },
    latest: { utmSource: 'whatsapp', utmCampaign: 'WA-260901-IN-01' },
  });

  const customerId = `cus_${randomUUID()}`;
  const session = buildSession({ sessionId: `cs_${randomUUID()}`, leadId, customerId });
  await syncCustomerFromCheckoutSession(supabase, session);

  const { rows } = await pool.query('SELECT * FROM customers WHERE stripe_customer_id=$1', [customerId]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].first_utm_source, 'whatsapp');
  assert.equal(rows[0].first_utm_campaign, 'WA-260901-IN-01');
  assert.equal(rows[0].latest_utm_source, 'whatsapp');
  assert.ok(rows[0].first_attribution_at);
});

test('a resync (e.g. a webhook retry) never overwrites first-touch attribution, but does move latest-touch forward', async () => {
  const leadId = `lead-${randomUUID()}`;
  await captureAttribution(supabase, { leadId, first: { utmSource: 'whatsapp' }, latest: { utmSource: 'whatsapp' } });

  const customerId = `cus_${randomUUID()}`;
  const sessionId = `cs_${randomUUID()}`;
  const session = buildSession({ sessionId, leadId, customerId });

  await syncCustomerFromCheckoutSession(supabase, session); // first sync

  // A later visit under a different campaign updates latest-touch in the ledger...
  await captureAttribution(supabase, { leadId, first: {}, latest: { utmSource: 'retarget-fb', utmCampaign: 'FB-99' } });
  // ...and a resync of the SAME session (e.g. Stripe redelivering the webhook) picks it up.
  await syncCustomerFromCheckoutSession(supabase, session);

  const { rows } = await pool.query('SELECT * FROM customers WHERE stripe_customer_id=$1', [customerId]);
  assert.equal(rows.length, 1, 'a resync must update the existing customer row, never create a second one');
  assert.equal(rows[0].first_utm_source, 'whatsapp', 'first-touch must never change on a resync');
  assert.equal(rows[0].latest_utm_source, 'retarget-fb', 'latest-touch is free to move forward');
  assert.equal(rows[0].latest_utm_campaign, 'FB-99');
});

test('no lead_attribution row for this trackingId (a link never tagged, or attribution capture failed) degrades to null attribution — never throws, never blocks customer creation', async () => {
  const customerId = `cus_${randomUUID()}`;
  const session = buildSession({ sessionId: `cs_${randomUUID()}`, leadId: `untagged-${randomUUID()}`, customerId });

  await syncCustomerFromCheckoutSession(supabase, session);

  const { rows } = await pool.query('SELECT * FROM customers WHERE stripe_customer_id=$1', [customerId]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].first_utm_source, null);
  assert.equal(rows[0].latest_utm_source, null);
});

test('a customer with no client_reference_id at all (no tracking id) still creates successfully, with null attribution', async () => {
  const customerId = `cus_${randomUUID()}`;
  const session = buildSession({ sessionId: `cs_${randomUUID()}`, leadId: null, customerId });
  await syncCustomerFromCheckoutSession(supabase, session);

  const { rows } = await pool.query('SELECT * FROM customers WHERE stripe_customer_id=$1', [customerId]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source_lead_id, null);
});

/* ───────────────── duplicate-customer prevention (unchanged) ───────────────── */

test('duplicate-customer prevention still holds: two checkout.session.completed syncs for the same stripe_customer_id never create two rows', async () => {
  const customerId = `cus_${randomUUID()}`;
  const leadId = `lead-${randomUUID()}`;
  await captureAttribution(supabase, { leadId, first: { utmSource: 'whatsapp' }, latest: { utmSource: 'whatsapp' } });

  const session1 = buildSession({ sessionId: `cs_${randomUUID()}`, leadId, customerId });
  const session2 = buildSession({ sessionId: `cs_${randomUUID()}`, leadId, customerId }); // a second session, same Stripe customer

  await syncCustomerFromCheckoutSession(supabase, session1);
  await syncCustomerFromCheckoutSession(supabase, session2);

  const { rows } = await pool.query('SELECT count(*)::int AS c FROM customers WHERE stripe_customer_id=$1', [customerId]);
  assert.equal(rows[0].c, 1, 'stripe_customer_id must remain the sole dedup key — attribution copy-in must not weaken this');
});

/* ───────────────────── customer.subscription.updated sync ───────────────────── */

async function seedCustomerWithSubscription(status = 'trialing') {
  const stripeCustomerId = `cus_test_${randomUUID()}`;
  const custRes = await pool.query('INSERT INTO customers (stripe_customer_id) VALUES ($1) RETURNING id', [stripeCustomerId]);
  const customerId = custRes.rows[0].id;
  const stripeSubscriptionId = `sub_test_${randomUUID()}`;
  await pool.query(
    `INSERT INTO subscriptions (customer_id, stripe_subscription_id, status, cancel_at_period_end) VALUES ($1, $2, $3, false)`,
    [customerId, stripeSubscriptionId, status]
  );
  return { customerId, stripeCustomerId, stripeSubscriptionId };
}

function subscriptionUpdatedEvent({ stripeSubscriptionId, status, cancelAtPeriodEnd = false, currentPeriodEnd }) {
  return {
    id: `evt_${randomUUID()}`,
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: stripeSubscriptionId,
        status,
        cancel_at_period_end: cancelAtPeriodEnd,
        cancel_at: cancelAtPeriodEnd ? Math.floor(Date.now() / 1000) + 86400 : null,
        trial_start: null,
        trial_end: null,
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: currentPeriodEnd,
        items: { data: [] },
      },
    },
  };
}

test('syncSubscriptionUpdated populates cancel_at_period_end/current_period_end — the exact gap this round closes', async () => {
  const { stripeSubscriptionId } = await seedCustomerWithSubscription('active');
  const periodEndUnix = Math.floor(Date.now() / 1000) + 20 * 86400;

  const event = subscriptionUpdatedEvent({ stripeSubscriptionId, status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: periodEndUnix });
  await syncSubscriptionUpdated(supabase, event);

  const { rows } = await pool.query('SELECT * FROM subscriptions WHERE stripe_subscription_id=$1', [stripeSubscriptionId]);
  assert.equal(rows[0].cancel_at_period_end, true);
  assert.ok(rows[0].current_period_end, 'current_period_end must now actually be populated — previously never written by any code path');
  assert.ok(rows[0].cancel_at);
});

test('syncSubscriptionUpdated maps Stripe\'s "canceled" spelling to this codebase\'s "cancelled" convention', async () => {
  const { stripeSubscriptionId } = await seedCustomerWithSubscription('active');
  const event = subscriptionUpdatedEvent({ stripeSubscriptionId, status: 'canceled', currentPeriodEnd: null });
  await syncSubscriptionUpdated(supabase, event);

  const { rows } = await pool.query('SELECT status FROM subscriptions WHERE stripe_subscription_id=$1', [stripeSubscriptionId]);
  assert.equal(rows[0].status, 'cancelled');
});

test('syncSubscriptionUpdated never invents a subscriptions row for an event whose subscription was never synced', async () => {
  const unknownSubId = `sub_never_synced_${randomUUID()}`;
  const event = subscriptionUpdatedEvent({ stripeSubscriptionId: unknownSubId, status: 'active', currentPeriodEnd: null });

  await syncSubscriptionUpdated(supabase, event); // must not throw

  const { rows } = await pool.query('SELECT * FROM subscriptions WHERE stripe_subscription_id=$1', [unknownSubId]);
  assert.equal(rows.length, 0, 'no subscriptions row should ever be created by this function — only checkout.session.completed creates one');
});

test('api/stripe-webhook.js actually wires customer.subscription.updated to syncSubscriptionUpdated (not just defined, but called)', () => {
  const src = readFileSync(join(repoRoot, 'api/stripe-webhook.js'), 'utf8');
  const block = src.slice(src.indexOf("event.type === 'customer.subscription.updated'"));
  const firstEventBlockEnd = block.indexOf("event.type === 'customer.subscription.trial_will_end'");
  const updatedBlock = block.slice(0, firstEventBlockEnd);
  assert.match(updatedBlock, /safely\(supabase, 'customer\.subscription\.updated', event, \(\) => syncSubscriptionUpdated\(supabase, event\)\)/);
});

test('syncSubscriptionUpdated does not touch customers.lifecycle/access_status — that stays recordSubscriptionEnded()\'s job alone', async () => {
  const { customerId, stripeSubscriptionId } = await seedCustomerWithSubscription('active');
  await pool.query(`UPDATE customers SET lifecycle='converted', access_status='active' WHERE id=$1`, [customerId]);

  const event = subscriptionUpdatedEvent({ stripeSubscriptionId, status: 'canceled', currentPeriodEnd: null });
  await syncSubscriptionUpdated(supabase, event);

  const { rows } = await pool.query('SELECT lifecycle, access_status FROM customers WHERE id=$1', [customerId]);
  assert.equal(rows[0].lifecycle, 'converted', 'lifecycle must remain untouched by subscription.updated alone');
  assert.equal(rows[0].access_status, 'active');
});

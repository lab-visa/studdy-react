/**
 * CRM-3A Activity Timeline — end-to-end coverage of the real HTTP
 * handler (api/admin/customer-detail.js) wired to the real Postgres
 * migration 0018 function (search_customer_activity_timeline), plus
 * the duplicate-Stripe-webhook idempotency guarantees the timeline
 * depends on.
 *
 * ChatGPT review round 3 note: the pure-JS buildActivityTimeline()/
 * buildCancellationEntry() functions this file used to unit-test
 * directly no longer exist — that in-memory merge/sort logic moved
 * into migration 0018's search_customer_activity_timeline() SQL
 * function (see that file's own header comment for why: the API layer
 * must never fetch a whole source table into Node again). Every
 * assertion those pure-function tests used to make is preserved, just
 * relocated to where the logic actually lives now:
 *   - the per-event-type/label/source matrix, sort order, stable
 *     tie-break, and "exact date unavailable" honesty ->
 *     test/cases/customer-activity-timeline-function.test.mjs
 *     (SQL-level, direct RPC calls)
 *   - reachability beyond the old TIMELINE_ROW_CAP=500, cursor
 *     pagination, 1,200+ event volume ->
 *     test/cases/customer-detail-timeline-pagination.test.mjs
 *     (HTTP-level, the real handler)
 * This file keeps only what genuinely needs the full HTTP-handler +
 * real-Postgres-joins wiring (checkout_started/access_assigned via
 * lead_attribution/account_assignments, which the handler resolves via
 * customer.id/source_lead_id lookups before calling the RPC) and the
 * duplicate-webhook-delivery idempotency guarantees.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { fakeReq, fakeRes } from '../helpers/fake-http.mjs';
import { recordSubscriptionEnded } from '../../api/_lib/sync-customer.js';

process.env.ADMIN_PIN_PEPPER = 'test-suite-pepper-do-not-use-in-production';
process.env.NODE_ENV = 'test';

const repoRoot = join(new URL('.', import.meta.url).pathname, '..', '..');
const supabaseModUrl = pathToFileURL(join(repoRoot, 'api/_lib/supabase.js')).href;

let pool;
let supabase;
let customerDetailHandler;
let adminAuth;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
  mock.module(supabaseModUrl, { namedExports: { getSupabase: () => supabase } });
  ({ default: customerDetailHandler } = await import(pathToFileURL(join(repoRoot, 'api/admin/customer-detail.js')).href));
  adminAuth = await import(pathToFileURL(join(repoRoot, 'api/_lib/admin-auth.js')).href);
});

after(async () => {
  await closeTestPool();
});

beforeEach(async () => {
  await pool.query(
    'TRUNCATE customers, subscriptions, payment_events, cancellation_requests, account_assignments, lead_attribution, studdy_accounts RESTART IDENTITY CASCADE'
  );
});

async function seedAdminSession() {
  const salt = adminAuth.generateSalt();
  const hash = adminAuth.deriveHash('1234', salt);
  const res = await pool.query(
    `INSERT INTO admin_users (display_name, pin_hash, pin_salt) VALUES ($1, $2, $3) RETURNING id`,
    [`Owner_${randomUUID()}`, hash, salt]
  );
  const { token } = await adminAuth.createSession(supabase, res.rows[0].id);
  return token;
}

/* ─────────────────────── end-to-end: real handler, real Postgres ─────────────────────── */

test('end-to-end: a cancelled customer\'s timeline shows the real cancellation date from the actual handler + real Postgres', async () => {
  const token = await seedAdminSession();
  const custRes = await pool.query(
    `INSERT INTO customers (stripe_customer_id, name, email, access_status, lifecycle, source_lead_id)
     VALUES ($1, 'Test Parent', 'parent@example.test', 'ended', 'churned', $2) RETURNING id`,
    [`cus_${randomUUID()}`, `lead-${randomUUID()}`]
  );
  const customerId = custRes.rows[0].id;
  await pool.query(
    `INSERT INTO subscriptions (customer_id, stripe_subscription_id, status, cancelled_at, ended_at)
     VALUES ($1, $2, 'cancelled', '2026-08-20T12:00:00.000Z', '2026-08-20T12:00:00.000Z')`,
    [customerId, `sub_${randomUUID()}`]
  );

  const res = fakeRes();
  await customerDetailHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` }, query: { id: customerId } }), res);
  assert.equal(res.statusCode, 200);

  const cancelEntry = res._json.activity_timeline.find((e) => e.type === 'subscription_cancelled');
  assert.ok(cancelEntry, 'the fetched customer detail must include a subscription_cancelled timeline entry');
  assert.equal(cancelEntry.label, 'Subscription cancelled');
  assert.equal(cancelEntry.occurred_at, '2026-08-20T12:00:00.000Z');
  assert.ok(cancelEntry.occurred_at_ist, 'must carry a real IST-formatted date, not just the raw ISO string');
  assert.ok(cancelEntry.event_key, 'every entry must carry a stable event_key for the React list key');
});

test('end-to-end: checkout_started and access_assigned/released entries are wired through the real handler and real Postgres joins', async () => {
  const token = await seedAdminSession();
  const leadId = `lead-${randomUUID()}`;
  await pool.query(
    `INSERT INTO lead_attribution (lead_id, first_touched_at, latest_touched_at) VALUES ($1, '2026-08-01T08:00:00.000Z', '2026-08-01T08:00:00.000Z')`,
    [leadId]
  );
  const custRes = await pool.query(
    `INSERT INTO customers (stripe_customer_id, email, access_status, lifecycle, source_lead_id, created_at)
     VALUES ($1, 'e@example.test', 'active', 'trial', $2, '2026-08-01T09:00:00.000Z') RETURNING id`,
    [`cus_${randomUUID()}`, leadId]
  );
  const customerId = custRes.rows[0].id;

  const accountRes = await pool.query(`INSERT INTO studdy_accounts (group_name, max_capacity) VALUES ('Group-Z', 10) RETURNING id`);
  await pool.query(
    `INSERT INTO account_assignments (studdy_account_id, customer_id, status, assigned_at, released_at)
     VALUES ($1, $2, 'released', '2026-08-01T09:05:00.000Z', '2026-08-10T00:00:00.000Z')`,
    [accountRes.rows[0].id, customerId]
  );

  const res = fakeRes();
  await customerDetailHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` }, query: { id: customerId } }), res);
  assert.equal(res.statusCode, 200);

  const types = res._json.activity_timeline.map((e) => e.type);
  assert.ok(types.includes('checkout_started'));
  assert.ok(types.includes('access_assigned'));
  assert.ok(types.includes('access_released'));

  const assigned = res._json.activity_timeline.find((e) => e.type === 'access_assigned');
  assert.equal(assigned.label, 'Access assigned — Group-Z');
});

test('end-to-end: a customer with no source_lead_id/lead_attribution row never errors (checkout_started simply absent)', async () => {
  const token = await seedAdminSession();
  const custRes = await pool.query(`INSERT INTO customers (stripe_customer_id) VALUES ($1) RETURNING id`, [`cus_${randomUUID()}`]);
  const res = fakeRes();
  await customerDetailHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` }, query: { id: custRes.rows[0].id } }), res);
  assert.equal(res.statusCode, 200);
  assert.ok(!res._json.activity_timeline.some((e) => e.type === 'checkout_started'));
});

/* ─────────────────────── duplicate Stripe webhook delivery ─────────────────────── */

test('duplicate webhook delivery: redelivering customer.subscription.deleted for the same event never creates a second timeline-visible change, and is idempotent', async () => {
  const custRes = await pool.query(`INSERT INTO customers (stripe_customer_id) VALUES ($1) RETURNING id`, [`cus_${randomUUID()}`]);
  const customerId = custRes.rows[0].id;
  const stripeSubId = `sub_${randomUUID()}`;
  await pool.query(`INSERT INTO subscriptions (customer_id, stripe_subscription_id, status) VALUES ($1, $2, 'active')`, [customerId, stripeSubId]);

  const event = {
    id: `evt_${randomUUID()}`,
    type: 'customer.subscription.deleted',
    created: Math.floor(new Date('2026-08-20T12:00:00.000Z').getTime() / 1000),
    data: { object: { id: stripeSubId } },
  };

  await recordSubscriptionEnded(supabase, event);

  const { rows: subRows1 } = await pool.query('SELECT id, cancelled_at, ended_at, status FROM subscriptions WHERE customer_id=$1', [customerId]);
  assert.equal(subRows1.length, 1, 'still exactly one subscriptions row — no duplicate insert');
  assert.equal(subRows1[0].status, 'cancelled');
  assert.ok(subRows1[0].cancelled_at);

  // Stripe redelivers the SAME event (it does this by design sometimes).
  await recordSubscriptionEnded(supabase, event);

  const { rows: subRows2 } = await pool.query('SELECT id, cancelled_at, ended_at, status FROM subscriptions WHERE customer_id=$1', [customerId]);
  assert.equal(subRows2.length, 1, 'a redelivered event must never create a second subscriptions row');
  assert.equal(subRows2[0].cancelled_at.getTime(), subRows1[0].cancelled_at.getTime(), 'the timestamp is derived from the Stripe event itself, so a retry reproduces the exact same value, not a later wall-clock time');

  // The timeline the real RPC builds from this state still shows exactly
  // ONE "subscription_cancelled" entry, not two — structurally
  // guaranteed by search_customer_activity_timeline()'s
  // latest_subscription CTE (at most one row per customer), not by any
  // JS-side dedup logic.
  const { data: timelineRows } = await supabase.rpc('search_customer_activity_timeline', { p_customer_id: customerId });
  const cancelEntries = (timelineRows || []).filter((e) => e.event_type === 'subscription_cancelled');
  assert.equal(cancelEntries.length, 1);
});

test('duplicate webhook delivery: a payment_events row can never be duplicated by a retried event id, so the timeline never shows the same payment twice', async () => {
  const custRes = await pool.query(`INSERT INTO customers (stripe_customer_id) VALUES ($1) RETURNING id`, [`cus_${randomUUID()}`]);
  const customerId = custRes.rows[0].id;
  const eventId = `evt_${randomUUID()}`;

  const insertOnce = () =>
    pool.query(
      `INSERT INTO payment_events (stripe_event_id, event_type, customer_id, amount, currency, status, occurred_at)
       VALUES ($1, 'invoice.payment_succeeded', $2, 40.99, 'usd', 'succeeded', now())
       ON CONFLICT (stripe_event_id) DO NOTHING`,
      [eventId, customerId]
    );

  await insertOnce();
  await insertOnce(); // simulated Stripe redelivery of the identical event

  const { rows } = await pool.query('SELECT count(*)::int AS c FROM payment_events WHERE stripe_event_id=$1', [eventId]);
  assert.equal(rows[0].c, 1);

  const { data: timelineRows } = await supabase.rpc('search_customer_activity_timeline', { p_customer_id: customerId });
  const paymentEntries = (timelineRows || []).filter((e) => e.event_type === 'payment_event');
  assert.equal(paymentEntries.length, 1, 'the timeline must never show the same payment_events row twice');
});

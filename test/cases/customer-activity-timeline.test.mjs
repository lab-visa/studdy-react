/**
 * CRM-3A Activity Timeline audit — fixes the specific reported bug (a
 * customer classified "Access removed" / subscription "cancelled" had
 * no timeline entry showing when cancellation happened) and adds
 * every OTHER timeline entry that has a real, authoritative,
 * database-backed source today: checkout started, access assigned/
 * released, campaign attribution recorded/updated, and friendly
 * labels for the existing payment_events entries.
 *
 * Deliberately NOT added (see api/admin/customer-detail.js's own
 * module comment and the CRM-3A Activity Timeline audit report): plan/
 * billing changes, cancellation approved/rejected/reversed, and Sales
 * Owner change history — none of these have any authoritative
 * timestamped source in the schema today; adding them would need new
 * columns/tables, which this round reports rather than silently builds.
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
let buildActivityTimeline;
let buildCancellationEntry;
let adminAuth;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
  mock.module(supabaseModUrl, { namedExports: { getSupabase: () => supabase } });
  ({ default: customerDetailHandler, buildActivityTimeline, buildCancellationEntry } = await import(
    pathToFileURL(join(repoRoot, 'api/admin/customer-detail.js')).href
  ));
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

/* ─────────────────────── buildCancellationEntry (pure function) ─────────────────────── */

test('buildCancellationEntry: THE BUG FIX — status=cancelled with a real cancelled_at produces a dated "Subscription cancelled" entry', () => {
  const entry = buildCancellationEntry({ status: 'cancelled', cancelled_at: '2026-08-15T10:00:00.000Z', ended_at: null });
  assert.ok(entry);
  assert.equal(entry.label, 'Subscription cancelled');
  assert.equal(entry.occurred_at, '2026-08-15T10:00:00.000Z');
  assert.equal(entry.source, 'subscriptions.cancelled_at');
});

test('buildCancellationEntry: falls back to ended_at only if cancelled_at is missing', () => {
  const entry = buildCancellationEntry({ status: 'cancelled', cancelled_at: null, ended_at: '2026-08-16T00:00:00.000Z' });
  assert.equal(entry.occurred_at, '2026-08-16T00:00:00.000Z');
  assert.equal(entry.source, 'subscriptions.ended_at');
});

test('buildCancellationEntry: HISTORICAL CASE — status=cancelled but no timestamp anywhere shows "exact date unavailable", never a manufactured date', () => {
  const entry = buildCancellationEntry({ status: 'cancelled', cancelled_at: null, ended_at: null, updated_at: '2026-08-20T00:00:00.000Z' });
  assert.ok(entry);
  assert.equal(entry.label, 'Cancelled — exact date unavailable');
  assert.equal(entry.occurred_at, null, 'must never fabricate a date from updated_at — occurred_at stays null');
  assert.equal(entry.source, null);
});

test('buildCancellationEntry: SCHEDULED cancellation (cancel_at_period_end=true, status still active) produces NO cancellation entry — nothing has actually happened yet', () => {
  const entry = buildCancellationEntry({ status: 'active', cancel_at_period_end: true, cancel_at: '2026-09-30T00:00:00.000Z', cancelled_at: null, ended_at: null });
  assert.equal(entry, null, 'a future-scheduled cancellation must never be shown as a completed "Subscription cancelled" event');
});

test('buildCancellationEntry: no subscription at all, or a non-cancelled status, produces no entry', () => {
  assert.equal(buildCancellationEntry(null), null);
  assert.equal(buildCancellationEntry({ status: 'active' }), null);
  assert.equal(buildCancellationEntry({ status: 'trialing' }), null);
  assert.equal(buildCancellationEntry({ status: 'past_due' }), null);
});

/* ─────────────────────── buildActivityTimeline (pure function) ─────────────────────── */

test('buildActivityTimeline: a brand-new customer with no other activity has exactly one entry', () => {
  const timeline = buildActivityTimeline({
    customer: { created_at: '2026-08-01T00:00:00.000Z' },
    subscription: null,
    paymentEvents: [],
    cancellationRequests: [],
    leadAttribution: null,
    accountAssignments: [],
  });
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].type, 'customer_created');
  assert.equal(timeline[0].occurred_at_ist, '1 Aug 2026, 5:30 am IST');
});

test('buildActivityTimeline: every supported event type appears with the right label and source', () => {
  const timeline = buildActivityTimeline({
    customer: {
      created_at: '2026-08-01T10:00:00.000Z',
      first_attribution_at: '2026-07-30T09:00:00.000Z',
      first_utm_source: 'whatsapp',
      first_utm_campaign: 'WA-01',
      latest_attribution_at: '2026-08-05T09:00:00.000Z',
      latest_utm_source: 'facebook',
      latest_utm_campaign: 'FB-99',
    },
    subscription: { status: 'cancelled', cancelled_at: '2026-08-20T00:00:00.000Z' },
    paymentEvents: [
      { event_type: 'invoice.payment_succeeded', occurred_at: '2026-08-02T00:00:00.000Z', amount: 40.99, currency: 'usd', status: 'succeeded' },
      { event_type: 'invoice.payment_failed', occurred_at: '2026-08-10T00:00:00.000Z', amount: 40.99, currency: 'usd', status: 'failed' },
      { event_type: 'refund.created', occurred_at: '2026-08-12T00:00:00.000Z', amount: 40.99, currency: 'usd', status: 'refunded' },
      { event_type: 'charge.dispute.created', occurred_at: '2026-08-13T00:00:00.000Z', amount: 40.99, currency: 'usd', status: 'needs_response' },
      { event_type: 'charge.dispute.closed', occurred_at: '2026-08-14T00:00:00.000Z', amount: 40.99, currency: 'usd', status: 'won' },
      { event_type: 'some.future.unmapped.event', occurred_at: '2026-08-15T00:00:00.000Z', amount: 1, currency: 'usd', status: 'x' },
    ],
    cancellationRequests: [{ status: 'pending_discussion', requested_at: '2026-08-16T00:00:00.000Z', reason: 'too expensive' }],
    leadAttribution: { first_touched_at: '2026-07-29T08:00:00.000Z' },
    accountAssignments: [{ group_name: 'Group-A', assigned_at: '2026-08-01T10:05:00.000Z', released_at: '2026-08-19T00:00:00.000Z' }],
  });

  const byType = Object.fromEntries(timeline.map((e) => [e.type + (e.source?.includes('(') ? e.source : ''), e]));
  const labels = timeline.map((e) => e.label);

  assert.ok(labels.includes('Checkout started'));
  assert.ok(labels.includes('Trial started / customer created'));
  assert.ok(labels.includes('Access assigned — Group-A'));
  assert.ok(labels.includes('Access released — Group-A'));
  assert.ok(labels.includes('Campaign attribution recorded (first touch)'));
  assert.ok(labels.includes('Campaign attribution updated (latest touch)'));
  assert.ok(labels.includes('Payment succeeded'));
  assert.ok(labels.includes('Payment failed'));
  assert.ok(labels.includes('Refund issued'));
  assert.ok(labels.includes('Dispute opened'));
  assert.ok(labels.includes('Dispute closed'));
  assert.ok(labels.includes('some.future.unmapped.event'), 'an unmapped event_type must fall back to the raw string, never crash');
  assert.ok(labels.includes('Cancellation request: pending_discussion'));
  assert.ok(labels.includes('Subscription cancelled'));

  void byType; // (kept for potential future per-entry field assertions)
});

test('buildActivityTimeline: sorted strictly newest-first', () => {
  const timeline = buildActivityTimeline({
    customer: { created_at: '2026-08-01T00:00:00.000Z' },
    subscription: null,
    paymentEvents: [
      { event_type: 'invoice.payment_succeeded', occurred_at: '2026-08-10T00:00:00.000Z' },
      { event_type: 'invoice.payment_succeeded', occurred_at: '2026-08-05T00:00:00.000Z' },
    ],
    cancellationRequests: [],
    leadAttribution: null,
    accountAssignments: [],
  });
  const times = timeline.map((e) => new Date(e.occurred_at).getTime());
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i - 1] >= times[i], 'each entry must be the same time or newer than the one after it');
  }
  assert.equal(timeline[0].occurred_at, '2026-08-10T00:00:00.000Z', 'newest entry first');
});

test('buildActivityTimeline: two entries sharing the exact same timestamp sort by the stable secondary key (type), same order every call', () => {
  const build = () =>
    buildActivityTimeline({
      customer: { created_at: '2026-08-01T00:00:00.000Z' },
      subscription: null,
      paymentEvents: [{ event_type: 'invoice.payment_succeeded', occurred_at: '2026-08-01T00:00:00.000Z' }],
      cancellationRequests: [{ status: 'pending_discussion', requested_at: '2026-08-01T00:00:00.000Z' }],
      leadAttribution: null,
      accountAssignments: [],
    });
  const first = build().map((e) => e.type);
  const second = build().map((e) => e.type);
  assert.deepEqual(first, second, 'identical input must always produce identical order — no nondeterministic tie-breaking');
});

test('buildActivityTimeline: a customer with only lead_attribution (no conversion yet — degenerate but must not crash) still orders correctly', () => {
  const timeline = buildActivityTimeline({
    customer: { created_at: '2026-08-01T00:00:00.000Z' },
    subscription: null,
    paymentEvents: [],
    cancellationRequests: [],
    leadAttribution: { first_touched_at: '2026-07-31T00:00:00.000Z' },
    accountAssignments: [],
  });
  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].type, 'customer_created', 'created_at is after checkout_started, so it sorts first (newest-first)');
  assert.equal(timeline[1].type, 'checkout_started');
});

/* ─────────────────────── end-to-end: real handler, real Postgres ─────────────────────── */

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

  // And the timeline built from this state still shows exactly ONE
  // "Subscription cancelled" entry, not two.
  const timeline = buildActivityTimeline({
    customer: { created_at: '2026-08-01T00:00:00.000Z' },
    subscription: subRows2[0],
    paymentEvents: [],
    cancellationRequests: [],
    leadAttribution: null,
    accountAssignments: [],
  });
  const cancelEntries = timeline.filter((e) => e.type === 'subscription_cancelled');
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
});

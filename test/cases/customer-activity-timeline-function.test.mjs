/**
 * CRM-3A migration 0018 (ChatGPT review round 3) — proves
 * search_customer_activity_timeline()'s SQL-level contract directly
 * against real Postgres, independent of the HTTP handler:
 *
 *   1. Privilege lockdown is real: PUBLIC/anon/authenticated denied,
 *      service_role allowed, a bare non-privileged role denied — same
 *      SET ROLE probe pattern as
 *      customer-pipeline-function-privileges.test.mjs.
 *   2. Catalog-level: SECURITY INVOKER (prosecdef=false), search_path
 *      pinned to the exact empty string (not merely "some value").
 *   3. Raises when the customer does not exist, rather than silently
 *      returning an empty/wrong result.
 *   4. Defense-in-depth AT THE SQL BOUNDARY itself (not merely trusting
 *      the Node API layer to always send well-formed input): a partial
 *      cursor (only one of the two params) is treated as no cursor;
 *      p_page_size is clamped to [1, 100] regardless of what is passed.
 *   5. Two events sharing the exact same instant sort deterministically
 *      by the stable (sort_at, event_key) secondary key, every call,
 *      and a keyset cursor built from a row exactly AT that tie never
 *      skips or repeats its sibling.
 *   6. The "Cancelled — exact date unavailable" case: occurred_at stays
 *      genuinely null (never a fabricated date from updated_at), the
 *      entry is still counted and still reachable.
 *
 * test/cases/customer-detail-timeline-pagination.test.mjs is the
 * companion HTTP-level file (the real handler, cursor query params,
 * 1,200+ event reachability). This file is the SQL-level counterpart —
 * same split as customer-pipeline-function-privileges.test.mjs vs.
 * customer-pipeline-pagination.test.mjs for migration 0017.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';

const { Pool } = pg;

let pool;
let dbName;

before(async () => {
  pool = await getTestPool();
  const { rows } = await pool.query('SELECT current_database() AS db');
  dbName = rows[0].db;
});

after(async () => {
  await closeTestPool();
});

beforeEach(async () => {
  await pool.query(
    'TRUNCATE customers, subscriptions, payment_events, cancellation_requests, account_assignments, lead_attribution, studdy_accounts RESTART IDENTITY CASCADE'
  );
});

async function insertCustomer(overrides = {}) {
  const res = await pool.query(
    `INSERT INTO customers (stripe_customer_id, name, created_at) VALUES ($1, $2, coalesce($3, now())) RETURNING id`,
    [overrides.stripe_customer_id ?? `cus_${randomUUID()}`, overrides.name ?? null, overrides.created_at ?? null]
  );
  return res.rows[0].id;
}

/* ─────────────────────── privilege lockdown ─────────────────────── */

test('search_customer_activity_timeline: PUBLIC/anon/authenticated denied, service_role allowed, a bare non-privileged role denied', async () => {
  const customerId = await insertCustomer();

  const roleName = `timeline_priv_probe_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const rolePassword = randomUUID();

  await pool.query(
    `CREATE ROLE "${roleName}" LOGIN PASSWORD '${rolePassword}' NOSUPERUSER NOBYPASSRLS NOINHERIT IN ROLE anon, authenticated, service_role`
  );
  await pool.query(`GRANT CONNECT ON DATABASE "${dbName}" TO "${roleName}"`);

  let probePool;
  try {
    probePool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: roleName,
      password: rolePassword,
      database: dbName,
    });

    await assert.rejects(
      () => probePool.query('SELECT * FROM search_customer_activity_timeline(p_customer_id := $1)', [customerId]),
      /permission denied for function|permission denied/i,
      'a bare NOSUPERUSER NOBYPASSRLS role with no service_role membership active must be denied EXECUTE'
    );

    await probePool.query('SET ROLE anon');
    await assert.rejects(
      () => probePool.query('SELECT * FROM search_customer_activity_timeline(p_customer_id := $1)', [customerId]),
      /permission denied for function|permission denied/i,
      'anon must be denied EXECUTE'
    );

    await probePool.query('RESET ROLE');
    await probePool.query('SET ROLE authenticated');
    await assert.rejects(
      () => probePool.query('SELECT * FROM search_customer_activity_timeline(p_customer_id := $1)', [customerId]),
      /permission denied for function|permission denied/i,
      'authenticated must be denied EXECUTE'
    );

    await probePool.query('RESET ROLE');
    await probePool.query('SET ROLE service_role');
    const { rows } = await probePool.query('SELECT * FROM search_customer_activity_timeline(p_customer_id := $1)', [customerId]);
    assert.ok(Array.isArray(rows) && rows.length >= 1, 'service_role must be able to execute the function and get real rows back');
  } finally {
    if (probePool) await probePool.end();
    await pool.query(`REVOKE CONNECT ON DATABASE "${dbName}" FROM "${roleName}"`);
    await pool.query(`DROP ROLE IF EXISTS "${roleName}"`);
  }
});

test('search_customer_activity_timeline: PUBLIC has no EXECUTE grant at all (catalog-level check)', async () => {
  const { rows } = await pool.query(
    `SELECT has_function_privilege('public', p.oid, 'EXECUTE') AS public_can_execute
     FROM pg_proc p WHERE p.proname = 'search_customer_activity_timeline'`
  );
  assert.equal(rows.length, 1, 'search_customer_activity_timeline must exist');
  assert.equal(rows[0].public_can_execute, false, 'PUBLIC must not have EXECUTE');
});

test('search_customer_activity_timeline: SECURITY INVOKER, search_path pinned to the exact empty string', async () => {
  const { rows } = await pool.query(
    `SELECT prosecdef, proconfig FROM pg_proc WHERE proname = 'search_customer_activity_timeline'`
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].prosecdef, false, 'prosecdef=false means SECURITY INVOKER');
  assert.ok(rows[0].proconfig, 'must pin its own search_path (proconfig)');
  // Postgres serializes `set search_path = ''` in proconfig as the
  // literal text 'search_path=""' (empty-string-quoted), not a bare
  // 'search_path=' — assert the exact real value, confirmed against a
  // live catalog read, not a guessed string shape.
  assert.ok(
    rows[0].proconfig.includes('search_path=""'),
    `expected the exact empty search_path="" entry, got: ${JSON.stringify(rows[0].proconfig)}`
  );
});

/* ─────────────────────── customer existence ─────────────────────── */

test('search_customer_activity_timeline: raises when the customer does not exist, rather than returning an empty/wrong result', async () => {
  await assert.rejects(
    () => pool.query('SELECT * FROM search_customer_activity_timeline(p_customer_id := $1)', [randomUUID()]),
    /not found/i
  );
});

test('search_customer_activity_timeline: raises when p_customer_id is null', async () => {
  await assert.rejects(
    () => pool.query('SELECT * FROM search_customer_activity_timeline(p_customer_id := $1)', [null]),
    /required/i
  );
});

/* ─────────────────────── defense in depth at the SQL boundary ─────────────────────── */

test('search_customer_activity_timeline: a PARTIAL cursor (only sort_at, or only event_key) is treated as no cursor, never an error', async () => {
  const customerId = await insertCustomer();

  const onlySortAt = await pool.query(
    `SELECT * FROM search_customer_activity_timeline(p_customer_id := $1, p_cursor_sort_at := now(), p_cursor_event_key := null)`,
    [customerId]
  );
  const onlyEventKey = await pool.query(
    `SELECT * FROM search_customer_activity_timeline(p_customer_id := $1, p_cursor_sort_at := null, p_cursor_event_key := 'bogus:key')`,
    [customerId]
  );
  const noCursor = await pool.query(`SELECT * FROM search_customer_activity_timeline(p_customer_id := $1)`, [customerId]);

  assert.equal(onlySortAt.rows.length, noCursor.rows.length, 'a cursor missing event_key must behave exactly like no cursor');
  assert.equal(onlyEventKey.rows.length, noCursor.rows.length, 'a cursor missing sort_at must behave exactly like no cursor');
});

test('search_customer_activity_timeline: p_page_size is clamped to [1, 100] regardless of what is passed directly', async () => {
  const customerId = await insertCustomer();
  await pool.query(
    `INSERT INTO payment_events (stripe_event_id, event_type, customer_id, amount, currency, status, occurred_at)
     SELECT 'evt_clamp_' || i, 'invoice.payment_succeeded', $1, 10, 'usd', 'succeeded', now() - (i || ' minutes')::interval
     FROM generate_series(1, 150) AS i`,
    [customerId]
  );

  const tooBig = await pool.query(`SELECT * FROM search_customer_activity_timeline(p_customer_id := $1, p_page_size := 999999)`, [customerId]);
  assert.ok(tooBig.rows.length <= 100, `expected at most 100 rows even when p_page_size=999999, got ${tooBig.rows.length}`);

  const tooSmall = await pool.query(`SELECT * FROM search_customer_activity_timeline(p_customer_id := $1, p_page_size := 0)`, [customerId]);
  assert.equal(tooSmall.rows.length, 1, 'p_page_size=0 must clamp up to at least 1, not return zero rows');

  const negative = await pool.query(`SELECT * FROM search_customer_activity_timeline(p_customer_id := $1, p_page_size := -5)`, [customerId]);
  assert.equal(negative.rows.length, 1, 'a negative p_page_size must clamp up to at least 1');
});

/* ─────────────────────── equal timestamps / stable tie-break ─────────────────────── */

test('search_customer_activity_timeline: two events sharing the exact same instant sort deterministically by (sort_at, event_key), same order every call', async () => {
  const customerId = await insertCustomer();
  const tiedAt = '2026-08-01T12:00:00.000Z';
  await pool.query(
    `INSERT INTO payment_events (stripe_event_id, event_type, customer_id, amount, currency, status, occurred_at)
     VALUES ($1, 'invoice.payment_succeeded', $2, 10, 'usd', 'succeeded', $3),
            ($4, 'invoice.payment_failed', $2, 10, 'usd', 'failed', $3)`,
    [`evt_tie_a_${randomUUID()}`, customerId, tiedAt, `evt_tie_b_${randomUUID()}`]
  );

  const first = await pool.query(`SELECT event_key FROM search_customer_activity_timeline(p_customer_id := $1)`, [customerId]);
  const second = await pool.query(`SELECT event_key FROM search_customer_activity_timeline(p_customer_id := $1)`, [customerId]);
  assert.deepEqual(
    first.rows.map((r) => r.event_key),
    second.rows.map((r) => r.event_key),
    'identical input must always produce identical order — no nondeterministic tie-breaking'
  );
});

test('search_customer_activity_timeline: a keyset cursor built from a row exactly AT a tied timestamp never skips or repeats its sibling', async () => {
  const customerId = await insertCustomer();
  const tiedAt = '2026-08-01T12:00:00.000Z';
  await pool.query(
    `INSERT INTO payment_events (stripe_event_id, event_type, customer_id, amount, currency, status, occurred_at)
     VALUES ($1, 'invoice.payment_succeeded', $2, 10, 'usd', 'succeeded', $3),
            ($4, 'invoice.payment_failed', $2, 10, 'usd', 'failed', $3),
            ($5, 'refund.created', $2, 10, 'usd', 'refunded', $3)`,
    [`evt_tie_a_${randomUUID()}`, customerId, tiedAt, `evt_tie_b_${randomUUID()}`, `evt_tie_c_${randomUUID()}`]
  );

  const page1 = await pool.query(`SELECT event_key, sort_at FROM search_customer_activity_timeline(p_customer_id := $1, p_page_size := 2)`, [customerId]);
  assert.equal(page1.rows.length, 2);
  const cursor = page1.rows[1];

  const page2 = await pool.query(
    `SELECT event_key FROM search_customer_activity_timeline(p_customer_id := $1, p_page_size := 2, p_cursor_sort_at := $2, p_cursor_event_key := $3)`,
    [customerId, cursor.sort_at, cursor.event_key]
  );

  const seen = new Set([...page1.rows.map((r) => r.event_key), ...page2.rows.map((r) => r.event_key)]);
  assert.equal(seen.size, page1.rows.length + page2.rows.length, 'no event_key repeated across the cursor boundary');
  // customer_created + 3 payment_events = 4 total; page1(2) + page2 must
  // reach the remaining 2 without loss.
  assert.equal(page1.rows.length + page2.rows.length, 4);
});

/* ─────────────────────── "exact date unavailable" honesty ─────────────────────── */

test('search_customer_activity_timeline: status=cancelled with a real cancelled_at produces a dated entry', async () => {
  const customerId = await insertCustomer();
  await pool.query(
    `INSERT INTO subscriptions (customer_id, stripe_subscription_id, status, cancelled_at) VALUES ($1, $2, 'cancelled', '2026-08-15T10:00:00.000Z')`,
    [customerId, `sub_${randomUUID()}`]
  );
  const { rows } = await pool.query(
    `SELECT * FROM search_customer_activity_timeline(p_customer_id := $1) WHERE event_type = 'subscription_cancelled'`,
    [customerId]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, 'Subscription cancelled');
  assert.equal(rows[0].source, 'subscriptions.cancelled_at');
  assert.ok(rows[0].occurred_at);
});

test('search_customer_activity_timeline: status=cancelled with NEITHER cancelled_at nor ended_at shows "exact date unavailable", never a fabricated date, but is still counted and reachable', async () => {
  const customerId = await insertCustomer();
  await pool.query(
    `INSERT INTO subscriptions (customer_id, stripe_subscription_id, status, cancelled_at, ended_at, updated_at)
     VALUES ($1, $2, 'cancelled', null, null, '2026-08-20T00:00:00.000Z')`,
    [customerId, `sub_${randomUUID()}`]
  );
  const { rows } = await pool.query(`SELECT * FROM search_customer_activity_timeline(p_customer_id := $1)`, [customerId]);
  const cancelEntry = rows.find((r) => r.event_type === 'subscription_cancelled');
  assert.ok(cancelEntry, 'the cancellation entry must still exist and be reachable');
  assert.equal(cancelEntry.label, 'Cancelled — exact date unavailable');
  assert.equal(cancelEntry.occurred_at, null, 'must never fabricate a date from updated_at — occurred_at stays null');
  assert.equal(cancelEntry.source, null);
  assert.equal(Number(rows[0].total_count), rows.length, 'total_count must include this entry, not silently drop it for having a null date');
});

test('search_customer_activity_timeline: a scheduled (not-yet-happened) cancellation produces NO subscription_cancelled entry', async () => {
  const customerId = await insertCustomer();
  await pool.query(
    `INSERT INTO subscriptions (customer_id, stripe_subscription_id, status, cancel_at_period_end, cancel_at)
     VALUES ($1, $2, 'active', true, '2026-09-30T00:00:00.000Z')`,
    [customerId, `sub_${randomUUID()}`]
  );
  const { rows } = await pool.query(`SELECT * FROM search_customer_activity_timeline(p_customer_id := $1)`, [customerId]);
  assert.ok(
    !rows.some((r) => r.event_type === 'subscription_cancelled'),
    'a future-scheduled cancellation must never be shown as a completed event'
  );
});

/* ─────────────────────── a brand-new customer ─────────────────────── */

test('search_customer_activity_timeline: a brand-new customer with no other activity has exactly one entry (customer_created)', async () => {
  const customerId = await insertCustomer();
  const { rows } = await pool.query(`SELECT * FROM search_customer_activity_timeline(p_customer_id := $1)`, [customerId]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event_type, 'customer_created');
  assert.equal(Number(rows[0].total_count), 1);
  assert.equal(rows[0].has_more, false);
});

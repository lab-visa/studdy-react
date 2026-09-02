/**
 * CRM-3A ChatGPT review round 2 — "complete activity history": proves
 * the silent TIMELINE_ROW_CAP=500 behavior removed from
 * api/admin/customer-detail.js is genuinely gone, and that the
 * replacement in-memory pagination (timelinePage/timelinePageSize)
 * makes every stored event reachable, with accurate page/has_more
 * information — not merely "the cap number changed".
 *
 * Uses the real HTTP handler end-to-end (same mock.module +
 * fakeReq/fakeRes pattern as customer-activity-timeline.test.mjs),
 * seeding 600 payment_events for ONE customer (bulk INSERT, not 600
 * round trips) — past the old 500-row cutoff.
 */
import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { fakeReq, fakeRes } from '../helpers/fake-http.mjs';

process.env.ADMIN_PIN_PEPPER = 'test-suite-pepper-do-not-use-in-production';
process.env.NODE_ENV = 'test';

const repoRoot = join(new URL('.', import.meta.url).pathname, '..', '..');
const supabaseModUrl = pathToFileURL(join(repoRoot, 'api/_lib/supabase.js')).href;

const PAYMENT_EVENT_COUNT = 600;

let pool;
let supabase;
let customerDetailHandler;
let adminAuth;
let token;
let customerId;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
  mock.module(supabaseModUrl, { namedExports: { getSupabase: () => supabase } });
  ({ default: customerDetailHandler } = await import(pathToFileURL(join(repoRoot, 'api/admin/customer-detail.js')).href));
  adminAuth = await import(pathToFileURL(join(repoRoot, 'api/_lib/admin-auth.js')).href);

  await pool.query('TRUNCATE customers, subscriptions, payment_events, cancellation_requests, account_assignments RESTART IDENTITY CASCADE');

  const salt = adminAuth.generateSalt();
  const hash = adminAuth.deriveHash('1234', salt);
  const res = await pool.query(`INSERT INTO admin_users (display_name, pin_hash, pin_salt) VALUES ($1, $2, $3) RETURNING id`, [
    `Owner_${randomUUID()}`,
    hash,
    salt,
  ]);
  ({ token } = await adminAuth.createSession(supabase, res.rows[0].id));

  const custRes = await pool.query(`INSERT INTO customers (stripe_customer_id, created_at) VALUES ($1, now() - interval '2 years') RETURNING id`, [
    `cus_${randomUUID()}`,
  ]);
  customerId = custRes.rows[0].id;

  /* One bulk INSERT of PAYMENT_EVENT_COUNT rows — i=1 is the OLDEST
   * (occurred_at furthest in the past), i=PAYMENT_EVENT_COUNT the
   * NEWEST — so the timeline's newest-first ordering puts row i=600
   * first, i=1 last, with no ties/ambiguity about which event lands
   * on which page. */
  await pool.query(
    `INSERT INTO payment_events (stripe_event_id, event_type, customer_id, amount, currency, status, occurred_at)
     SELECT
       'evt_bulk_' || i,
       'invoice.payment_succeeded',
       $1,
       40.99,
       'usd',
       'succeeded',
       now() - ((($2::int - i) || ' hours')::interval)
     FROM generate_series(1, $2) AS i`,
    [customerId, PAYMENT_EVENT_COUNT]
  );
});

after(async () => {
  await closeTestPool();
});

async function fetchDetail(query = {}) {
  const res = fakeRes();
  await customerDetailHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` }, query: { id: customerId, ...query } }), res);
  assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res._json)}`);
  return res._json;
}

test('timeline_total_count reflects the FULL event history, not capped at 500', async () => {
  const body = await fetchDetail({});
  // +1 for the customer_created entry itself.
  assert.equal(body.timeline_total_count, PAYMENT_EVENT_COUNT + 1);
});

test('default page (pageSize=50) returns exactly 50 entries, the newest first', async () => {
  const body = await fetchDetail({});
  assert.equal(body.activity_timeline.length, 50);
  assert.equal(body.timeline_page, 1);
  assert.equal(body.timeline_page_size, 50);
  assert.equal(body.timeline_has_previous, false);
  assert.equal(body.timeline_has_next, true);
  // Newest payment event (i=600) sorts ahead of customer_created (2 years old).
  assert.equal(body.activity_timeline[0].source, 'payment_events (invoice.payment_succeeded)');
});

test('an event beyond the old row-500 cutoff is reachable via a later page — proves no silent truncation', async () => {
  // pageSize=100 => 6 full pages of payment_events + a 7th holding
  // customer_created. Page 6 (offset 500) covers events ranked 501-600
  // newest-first, i.e. bulk events i=100..1 in seed order — exactly the
  // range a TIMELINE_ROW_CAP=500 query() would have silently dropped
  // entirely before this fix.
  const body = await fetchDetail({ timelinePage: '6', timelinePageSize: '100' });
  assert.equal(body.activity_timeline.length, 100);
  assert.ok(body.activity_timeline.every((e) => e.type === 'payment_event'));
});

test('walking every page (pageSize=100) yields exactly timeline_total_count entries, no duplicates, no gaps', async () => {
  const first = await fetchDetail({ timelinePageSize: '100' });
  const totalPages = first.timeline_total_pages;
  const seenKeys = new Set();

  for (let page = 1; page <= totalPages; page++) {
    const body = await fetchDetail({ timelinePage: String(page), timelinePageSize: '100' });
    for (const e of body.activity_timeline) {
      // No stable id on a timeline entry — (type, occurred_at, amount)
      // is unique enough across this synthetic, one-event-per-hour dataset.
      const key = `${e.type}:${e.occurred_at}:${e.amount ?? ''}`;
      assert.ok(!seenKeys.has(key), `entry ${key} appeared on more than one page (page ${page})`);
      seenKeys.add(key);
    }
  }

  assert.equal(seenKeys.size, PAYMENT_EVENT_COUNT + 1);
});

test('the last real page is full/partial as expected, timeline_has_next=false', async () => {
  const totalPages = Math.ceil((PAYMENT_EVENT_COUNT + 1) / 100); // 7
  const body = await fetchDetail({ timelinePage: String(totalPages), timelinePageSize: '100' });
  assert.equal(body.timeline_has_next, false);
  assert.equal(body.timeline_has_previous, true);
  assert.equal(body.activity_timeline.length, PAYMENT_EVENT_COUNT + 1 - (totalPages - 1) * 100);
});

test('a page number past the last page returns an EMPTY activity_timeline but an ACCURATE timeline_total_count', async () => {
  const body = await fetchDetail({ timelinePage: '999', timelinePageSize: '100' });
  assert.equal(body.activity_timeline.length, 0);
  assert.equal(body.timeline_total_count, PAYMENT_EVENT_COUNT + 1);
  assert.equal(body.timeline_has_next, false);
  assert.equal(body.timeline_has_previous, true);
});

test('invalid timelinePage values (negative, zero, non-numeric) fall back to page 1, never a 500', async () => {
  for (const timelinePage of ['-1', '0', 'not-a-number', '1.5', '']) {
    const res = fakeRes();
    await customerDetailHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` }, query: { id: customerId, timelinePage } }), res);
    assert.equal(res.statusCode, 200, `timelinePage=${JSON.stringify(timelinePage)} must not 500`);
    assert.equal(res._json.timeline_page, 1, `timelinePage=${JSON.stringify(timelinePage)} must clamp to page 1`);
  }
});

test('invalid timelinePageSize values fall back to the default (50); only 25/50/100 are ever honored', async () => {
  const bad = await fetchDetail({ timelinePageSize: '9999' });
  assert.equal(bad.timeline_page_size, 50);

  const twentyFive = await fetchDetail({ timelinePageSize: '25' });
  assert.equal(twentyFive.timeline_page_size, 25);
  assert.equal(twentyFive.activity_timeline.length, 25);
});

test('a customer with an empty timeline (impossible in practice — customer_created always exists — but the empty-page machinery itself is exercised by the past-the-end-page test above) never errors', async () => {
  // Covered structurally by "a page number past the last page" above;
  // this test documents that guarantee explicitly for a fresh customer
  // with no payment history at all.
  const custRes = await pool.query(`INSERT INTO customers (stripe_customer_id) VALUES ($1) RETURNING id`, [`cus_${randomUUID()}`]);
  const freshId = custRes.rows[0].id;
  const res = fakeRes();
  await customerDetailHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` }, query: { id: freshId } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res._json.activity_timeline.length, 1, 'just the customer_created entry');
  assert.equal(res._json.timeline_total_count, 1);
  assert.equal(res._json.timeline_has_next, false);
});

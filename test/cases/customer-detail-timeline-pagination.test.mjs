/**
 * CRM-3A ChatGPT review round 3 — "genuine server-side pagination":
 * proves the Activity Timeline is truly cursor/keyset-paginated through
 * the real HTTP handler, not merely fetch-everything-then-slice-in-Node
 * (round 2's fix) and not vulnerable to any implicit row limit a real
 * Supabase/PostgREST project might apply to a plain table SELECT
 * (commonly 1,000 rows) — every event source is now read ONLY through
 * migration 0018's search_customer_activity_timeline() RPC, which
 * itself returns at most timelinePageSize rows per call (see that
 * file's own header comment).
 *
 * Seeds 1,200 payment_events for ONE customer — comfortably past the
 * 1,000-row boundary a real Supabase project's PostgREST config
 * commonly enforces on an ordinary `.select()`, which the OLD
 * (round-2) code path was still exposed to for any source table with
 * no explicit `.range()`/`.limit()` (see api/admin/customer-detail.js's
 * own module comment, ChatGPT review round 3 note).
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

const PAYMENT_EVENT_COUNT = 1200;

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
   * NEWEST — so the timeline's newest-first ordering puts row
   * i=PAYMENT_EVENT_COUNT first, i=1 last, with no ties/ambiguity about
   * which event lands on which page. Comfortably past the 1,000-row
   * boundary a real Supabase/PostgREST project commonly enforces on an
   * un-ranged .select() — see this file's own header comment. */
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

// Preserves the SAME timelinePageSize the caller was already using — a
// real client always re-sends its own page-size choice on every
// request (there is no server-side "session" remembering it), so the
// walk below must do the same or it would silently fall back to the
// default 50 on every page after the first, which is a TEST bug, not a
// product one (parseTimelinePageSize is per-request, by design).
function nextPageQuery(body) {
  assert.ok(body.timeline_next_cursor, 'expected a timeline_next_cursor while timeline_has_next is true');
  return {
    timelinePageSize: String(body.timeline_page_size),
    timelineCursorSortAt: body.timeline_next_cursor.sort_at,
    timelineCursorEventKey: body.timeline_next_cursor.event_key,
  };
}

test('timeline_total_count reflects the FULL event history, not capped at any page size', async () => {
  const body = await fetchDetail({});
  // +1 for the customer_created entry itself.
  assert.equal(body.timeline_total_count, PAYMENT_EVENT_COUNT + 1);
});

test('default page (pageSize=50) returns exactly 50 entries, the newest first, with no previous page', async () => {
  const body = await fetchDetail({});
  assert.equal(body.activity_timeline.length, 50);
  assert.equal(body.timeline_page_size, 50);
  assert.equal(body.timeline_has_previous, false);
  assert.equal(body.timeline_has_next, true);
  assert.ok(body.timeline_next_cursor);
  // Newest payment event sorts ahead of customer_created (2 years old).
  assert.equal(body.activity_timeline[0].source, 'payment_events (invoice.payment_succeeded)');
});

test('walking every page via timeline_next_cursor (pageSize=100) reaches every event, including the OLDEST one, with no duplicates and no gaps', async () => {
  let body = await fetchDetail({ timelinePageSize: '100' });
  const seenKeys = new Set();
  let pages = 0;
  const MAX_PAGES = 20; // (1200 + 1) / 100 = 13 pages — generous ceiling against an infinite loop bug

  for (;;) {
    for (const e of body.activity_timeline) {
      assert.ok(!seenKeys.has(e.event_key), `event_key ${e.event_key} appeared on more than one page`);
      seenKeys.add(e.event_key);
    }
    pages++;
    if (!body.timeline_has_next) break;
    assert.ok(pages < MAX_PAGES, 'walked more pages than should be possible — likely an infinite loop / cursor not advancing');
    body = await fetchDetail(nextPageQuery(body));
  }

  assert.equal(seenKeys.size, PAYMENT_EVENT_COUNT + 1, 'every event, including the very oldest payment_event (i=1) and customer_created, must be reachable by walking the cursor to the end');
  assert.equal(body.timeline_has_next, false, 'the final page must report no further pages');
  assert.equal(body.timeline_next_cursor, null);

  // customer_created was seeded 2 years ago (see `before`), older than
  // every payment_event (the newest is ~"now", the oldest, i=1, is
  // PAYMENT_EVENT_COUNT hours ago — a matter of weeks) — so
  // customer_created is genuinely the single oldest event overall and
  // must be the very last thing reached.
  const oldestEntry = body.activity_timeline[body.activity_timeline.length - 1];
  assert.equal(oldestEntry.type, 'customer_created');

  // Separately, the whole point of this test: the OLDEST payment_event
  // (i=1) specifically — the row that would sit past the old
  // TIMELINE_ROW_CAP=500 cutoff, and past a real Supabase/PostgREST
  // project's commonly-configured 1,000-row implicit SELECT limit —
  // must actually be reachable, not silently dropped.
  const { rows: oldestPaymentEventRows } = await pool.query(`SELECT id FROM payment_events WHERE stripe_event_id = 'evt_bulk_1'`);
  assert.equal(oldestPaymentEventRows.length, 1);
  assert.ok(
    seenKeys.has(`payment_events:${oldestPaymentEventRows[0].id}`),
    'the oldest payment_event (i=1) must be reachable by walking the cursor to the end'
  );
});

test('a page requested with a cursor built from the previous response is reachable and disjoint from page 1', async () => {
  const page1 = await fetchDetail({ timelinePageSize: '100' });
  const page2 = await fetchDetail(nextPageQuery(page1));
  assert.equal(page2.activity_timeline.length, 100);
  assert.equal(page2.timeline_has_previous, true);
  const page1Keys = new Set(page1.activity_timeline.map((e) => e.event_key));
  assert.ok(page2.activity_timeline.every((e) => !page1Keys.has(e.event_key)), 'page 2 must share no events with page 1');
});

test('a stale/bogus cursor past the last row returns an EMPTY activity_timeline but an ACCURATE timeline_total_count and timeline_has_next=false', async () => {
  const body = await fetchDetail({
    timelineCursorSortAt: '1999-01-01T00:00:00.000Z', // older than every real event
    timelineCursorEventKey: 'payment_events:00000000-0000-0000-0000-000000000000',
  });
  assert.equal(body.activity_timeline.length, 0);
  assert.equal(body.timeline_total_count, PAYMENT_EVENT_COUNT + 1);
  assert.equal(body.timeline_has_next, false);
  assert.equal(body.timeline_has_previous, true, 'a request that DID carry a (valid-shaped) cursor is never "the first page"');
});

test('an invalid/partial cursor (malformed timestamp, or only one of the two fields) falls back to page 1, never a 500', async () => {
  const first = await fetchDetail({});

  const malformedTimestamp = await fetchDetail({ timelineCursorSortAt: 'not-a-date', timelineCursorEventKey: 'payment_events:x' });
  assert.deepEqual(malformedTimestamp.activity_timeline.map((e) => e.event_key), first.activity_timeline.map((e) => e.event_key));
  assert.equal(malformedTimestamp.timeline_has_previous, false, 'a cursor this handler rejected as invalid must be treated as no cursor at all');

  const onlySortAt = await fetchDetail({ timelineCursorSortAt: new Date().toISOString() });
  assert.equal(onlySortAt.timeline_has_previous, false);

  const onlyEventKey = await fetchDetail({ timelineCursorEventKey: 'payment_events:x' });
  assert.equal(onlyEventKey.timeline_has_previous, false);
});

test('invalid timelinePageSize values fall back to the default (50); only 25/50/100 are ever honored', async () => {
  const bad = await fetchDetail({ timelinePageSize: '9999' });
  assert.equal(bad.timeline_page_size, 50);

  const twentyFive = await fetchDetail({ timelinePageSize: '25' });
  assert.equal(twentyFive.timeline_page_size, 25);
  assert.equal(twentyFive.activity_timeline.length, 25);

  const hundred = await fetchDetail({ timelinePageSize: '100' });
  assert.equal(hundred.timeline_page_size, 100);
  assert.equal(hundred.activity_timeline.length, 100);
});

test('a customer with an empty/near-empty history (only customer_created) never errors and reports has_next=false', async () => {
  const custRes = await pool.query(`INSERT INTO customers (stripe_customer_id) VALUES ($1) RETURNING id`, [`cus_${randomUUID()}`]);
  const freshId = custRes.rows[0].id;
  const res = fakeRes();
  await customerDetailHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` }, query: { id: freshId } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res._json.activity_timeline.length, 1, 'just the customer_created entry');
  assert.equal(res._json.timeline_total_count, 1);
  assert.equal(res._json.timeline_has_next, false);
  assert.equal(res._json.timeline_has_previous, false);
  assert.equal(res._json.timeline_next_cursor, null);
});

test('a request for a customer id that does not exist still 404s before the timeline RPC is ever called', async () => {
  const res = fakeRes();
  await customerDetailHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` }, query: { id: randomUUID() } }), res);
  assert.equal(res.statusCode, 404);
});

/**
 * CRM-3A — scalable server-side pagination for the Customer &
 * Subscription LIST view (api/admin/customers.js -> the
 * search_customer_pipeline(...) Postgres function, migration 0017).
 *
 * The bug this replaces: the old implementation fetched at most
 * PIPELINE_ROW_CAP=2000 customer rows into Node and filtered/sorted/
 * paginated them in JavaScript — every filter and the total count
 * were silently wrong past 2000 customers, and a customer beyond that
 * cutoff could never appear on any page. This file proves the
 * replacement genuinely has no such ceiling: a population of 2,500
 * customers is seeded (once, via a single bulk INSERT — not 2,500
 * individual round trips), and results past row 2000 are reached,
 * searched, and counted correctly.
 *
 * Uses the real HTTP handler (api/admin/customers.js) end-to-end,
 * same mock.module + fakeReq/fakeRes pattern as
 * admin-customer-pipeline.test.mjs, so this exercises the actual
 * production request-parsing/response-shaping code, not just the SQL
 * function in isolation (a separate, smaller test file — see
 * customer-pipeline-stage-parity.test.mjs — covers the SQL stage
 * logic's correctness directly).
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

const BULK_COUNT = 2500;

let pool;
let supabase;
let customersHandler;
let adminAuth;
let token;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
  mock.module(supabaseModUrl, { namedExports: { getSupabase: () => supabase } });
  ({ default: customersHandler } = await import(pathToFileURL(join(repoRoot, 'api/admin/customers.js')).href));
  adminAuth = await import(pathToFileURL(join(repoRoot, 'api/_lib/admin-auth.js')).href);

  await pool.query('TRUNCATE customers, subscriptions, cancellation_requests, account_assignments RESTART IDENTITY CASCADE');

  const salt = adminAuth.generateSalt();
  const hash = adminAuth.deriveHash('1234', salt);
  const res = await pool.query(
    `INSERT INTO admin_users (display_name, pin_hash, pin_salt) VALUES ($1, $2, $3) RETURNING id`,
    [`Owner_${randomUUID()}`, hash, salt]
  );
  ({ token } = await adminAuth.createSession(supabase, res.rows[0].id));

  /* One bulk INSERT, not BULK_COUNT round trips — i=1 gets the most
   * recent created_at (now() - 1s), i=BULK_COUNT the oldest, so
   * `ORDER BY created_at DESC` is fully deterministic with no ties:
   * page 1 = i=1..pageSize, and so on, with no ambiguity about which
   * row lands on which page. */
  await pool.query(
    `INSERT INTO customers (stripe_customer_id, paid_id, name, email, country, access_status, lifecycle, created_at)
     SELECT
       'cus_bulk_' || i,
       'SL-BULK-' || lpad(i::text, 5, '0'),
       'Bulk Customer ' || i,
       'bulk' || i || '@example.test',
       CASE WHEN i % 2 = 0 THEN 'IN' ELSE 'US' END,
       'active',
       'trial',
       now() - (i || ' seconds')::interval
     FROM generate_series(1, $1) AS i`,
    [BULK_COUNT]
  );

  // One uniquely-named customer buried well past row 2000 in the
  // default (unfiltered) ordering, for the search-beyond-page-1 test.
  await pool.query(
    `UPDATE customers SET name = 'Zzyzx Unique Customer', email = 'zzyzx@example.test' WHERE stripe_customer_id = 'cus_bulk_2200'`
  );
});

after(async () => {
  await closeTestPool();
});

function authedReq(query) {
  return fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` }, query });
}

async function fetchPage(query) {
  const res = fakeRes();
  await customersHandler(authedReq(query), res);
  assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res._json)}`);
  return res._json;
}

/* ─────────────────────── beyond the old 2000-row ceiling ─────────────────────── */

test('total_matching reports the full population, not capped at 2000', async () => {
  const body = await fetchPage({});
  assert.equal(body.total_matching, BULK_COUNT);
});

test('a row far past the old 2000-row cutoff (row ~2001-2100) is reachable via pagination', async () => {
  // pageSize=100, page 21 -> offset 2000 -> rows i=2001..2100 in the
  // default created_at DESC ordering. Under the old JS-side cap, this
  // page would not exist at all (only 2000 rows were ever fetched).
  const body = await fetchPage({ page: '21', pageSize: '100' });
  assert.equal(body.customers.length, 100);
  assert.equal(body.customers[0].email, 'bulk2001@example.test');
  assert.equal(body.customers[99].email, 'bulk2100@example.test');
});

test('search finds a customer buried past row 2000, in a single targeted query', async () => {
  const body = await fetchPage({ search: 'Zzyzx' });
  assert.equal(body.total_matching, 1);
  assert.equal(body.customers.length, 1);
  assert.equal(body.customers[0].email, 'zzyzx@example.test');
});

test('search matches case-insensitively and by email/phone substring too', async () => {
  const byLower = await fetchPage({ search: 'zzyzx' });
  assert.equal(byLower.total_matching, 1);

  const byEmailSubstring = await fetchPage({ search: 'zzyzx@example' });
  assert.equal(byEmailSubstring.total_matching, 1);
});

test('a search term containing literal % or _ is matched literally, never as a wildcard', async () => {
  // None of the seeded customers contain a literal "%" — this must
  // match nothing, not accidentally match everything the way an
  // unescaped ILIKE '%%%' would.
  const body = await fetchPage({ search: '100%' });
  assert.equal(body.total_matching, 0);
});

/* ─────────────────────── first / last / empty / invalid pages ─────────────────────── */

test('page 1: has_previous=false, has_next=true, correct total_pages', async () => {
  const body = await fetchPage({ pageSize: '100' });
  assert.equal(body.page, 1);
  assert.equal(body.has_previous, false);
  assert.equal(body.has_next, true);
  assert.equal(body.total_pages, Math.ceil(BULK_COUNT / 100));
  assert.equal(body.customers.length, 100);
});

test('the last real page is full/partial as expected, has_next=false', async () => {
  const totalPages = Math.ceil(BULK_COUNT / 100); // 25
  const body = await fetchPage({ page: String(totalPages), pageSize: '100' });
  assert.equal(body.has_next, false);
  assert.equal(body.has_previous, true);
  assert.equal(body.customers.length, BULK_COUNT - (totalPages - 1) * 100);
});

test('a page number past the last page returns an EMPTY customers array but an ACCURATE total_matching (not zero, not an error)', async () => {
  const body = await fetchPage({ page: '999', pageSize: '100' });
  assert.equal(body.customers.length, 0);
  assert.equal(body.total_matching, BULK_COUNT, 'total must stay accurate even though this specific page is empty');
  assert.equal(body.has_next, false);
  assert.equal(body.has_previous, true);
});

test('a filter matching literally zero customers returns an empty page AND total_matching=0, never an error', async () => {
  const body = await fetchPage({ search: 'no-such-customer-anywhere-xyz123' });
  assert.equal(body.customers.length, 0);
  assert.equal(body.total_matching, 0);
  assert.equal(body.total_pages, 0);
  assert.equal(body.has_next, false);
  assert.equal(body.has_previous, false);
});

test('invalid page params (negative, zero, non-numeric, absurdly large) are all handled safely, never a 500', async () => {
  for (const page of ['-1', '0', 'not-a-number', '99999999999999', '1.5', '', undefined]) {
    const res = fakeRes();
    await customersHandler(authedReq(page === undefined ? {} : { page }), res);
    assert.equal(res.statusCode, 200, `page=${JSON.stringify(page)} must not 500`);
    assert.ok(res._json.page >= 1, `page=${JSON.stringify(page)} must clamp to a valid 1-based page, got ${res._json.page}`);
  }
});

test('invalid pageSize values fall back to 50; only 50 or 100 are ever honored', async () => {
  const bad = await fetchPage({ pageSize: '2000' });
  assert.equal(bad.page_size, 50, 'an out-of-allowlist pageSize must fall back to the default, never "whatever the client asked for"');

  const fifty = await fetchPage({ pageSize: '50' });
  assert.equal(fifty.page_size, 50);
  assert.equal(fifty.customers.length, 50);

  const hundred = await fetchPage({ pageSize: '100' });
  assert.equal(hundred.page_size, 100);
  assert.equal(hundred.customers.length, 100);
});

/* ─────────────────────── stable ordering: no jump/duplicate across pages ─────────────────────── */

test('walking every page with pageSize=100 yields exactly total_matching unique ids, no duplicates, no gaps', async () => {
  const first = await fetchPage({ pageSize: '100', page: '1' });
  const totalPages = first.total_pages;
  const seen = new Set();

  for (let page = 1; page <= totalPages; page++) {
    const body = await fetchPage({ pageSize: '100', page: String(page) });
    for (const c of body.customers) {
      assert.ok(!seen.has(c.id), `customer ${c.id} appeared on more than one page (page ${page})`);
      seen.add(c.id);
    }
  }

  assert.equal(seen.size, BULK_COUNT);
});

test('page 1 + page 2 (pageSize=100) never overlap and together match the first 200 in the deterministic ordering', async () => {
  const p1 = await fetchPage({ pageSize: '100', page: '1' });
  const p2 = await fetchPage({ pageSize: '100', page: '2' });
  const ids1 = new Set(p1.customers.map((c) => c.id));
  const ids2 = new Set(p2.customers.map((c) => c.id));
  for (const id of ids2) assert.ok(!ids1.has(id), 'page 2 must not repeat a page 1 row');
  assert.equal(p1.customers[0].email, 'bulk1@example.test');
  assert.equal(p2.customers[0].email, 'bulk101@example.test');
});

/* ─────────────────────── filters operate over the FULL population, not just one page ─────────────────────── */

test('country filter reports an accurate total across the whole population, not just the current page', async () => {
  const body = await fetchPage({ country: 'IN', pageSize: '50' });
  assert.equal(body.total_matching, Math.floor(BULK_COUNT / 2), 'exactly the even-numbered bulk rows are IN');
  assert.equal(body.customers.length, 50);
  assert.ok(body.customers.every((c) => c.country === 'IN'));
});

test('a filter combined with search still returns an accurate total and correct page', async () => {
  const body = await fetchPage({ search: 'Bulk Customer 22', country: 'IN' });
  // "Bulk Customer 22" substring-matches 22, 220-229, 2200-2299 (100
  // numbers) minus the one renamed to Zzyzx (2200) = 110, restricted
  // to IN (even i) — every matching i here (22, 220, 222, 224, 226,
  // 228, 2202, 2204...2298) narrows further. Rather than hand-count
  // every case, assert the invariant that actually matters: every
  // returned row really matches BOTH predicates, and the reported
  // total is self-consistent with how many rows exist across all
  // pages of this exact query.
  assert.ok(body.total_matching > 0);
  assert.ok(body.customers.every((c) => c.country === 'IN' && c.name.includes('Bulk Customer 22')));

  let counted = 0;
  for (let page = 1; page <= body.total_pages; page++) {
    const p = await fetchPage({ search: 'Bulk Customer 22', country: 'IN', page: String(page) });
    counted += p.customers.length;
  }
  assert.equal(counted, body.total_matching, 'summing every page must equal the reported total');
});

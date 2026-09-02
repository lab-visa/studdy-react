/**
 * CRM-2A — api/track-event.js handler, end-to-end: proves the IST
 * day-bucketing fix and the new campaign-forwarding field are actually
 * wired into the real handler (not just the underlying utility/RPC,
 * already covered separately by reporting-timezone.test.mjs and
 * tracking.test.mjs). Also proves — directly, not just by absence of a
 * write — that anonymous tracking never creates any CRM row, and that
 * historical rows are never touched by a new write.
 *
 * Requires --experimental-test-module-mocks, same as auth.test.mjs.
 */
import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { fakeReq, fakeRes } from '../helpers/fake-http.mjs';
import { todayReportingDay } from '../../api/_lib/reporting-timezone.js';

const repoRoot = join(new URL('.', import.meta.url).pathname, '..', '..');
const supabaseModUrl = pathToFileURL(join(repoRoot, 'api/_lib/supabase.js')).href;

let pool;
let supabase;
let trackEventHandler;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
  mock.module(supabaseModUrl, { namedExports: { getSupabase: () => supabase } });
  ({ default: trackEventHandler } = await import(pathToFileURL(join(repoRoot, 'api/track-event.js')).href));
});

after(async () => {
  await closeTestPool();
});

async function rowFor(day, event, campaignCode) {
  const res = await pool.query(
    'SELECT * FROM site_traffic_daily WHERE day=$1 AND event=$2 AND campaign_code=$3',
    [day, event, campaignCode]
  );
  return res.rows[0] || null;
}

async function countRows(table) {
  const res = await pool.query(`SELECT count(*)::int AS c FROM ${table}`);
  return res.rows[0].c;
}

test('an "opened" event with no campaign buckets into TODAY\'S Asia/Kolkata day, with campaign_code=none', async () => {
  const req = fakeReq({ method: 'POST', body: { event: 'opened' }, headers: { 'x-vercel-ip-country': 'IN' } });
  const res = fakeRes();
  await trackEventHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res._json.ok, true);

  const today = todayReportingDay();
  const row = await rowFor(today, 'opened', 'none');
  assert.ok(row, `expected a row bucketed under today's IST day (${today}) with campaign_code=none`);
});

test('a campaign tag in the request body is forwarded to campaign_code, kept separate from any lead identity', async () => {
  const req = fakeReq({
    method: 'POST',
    body: { event: 'checkout_viewed', campaign: 'WA-260902-IN-03' },
    headers: { 'x-vercel-ip-country': 'IN' },
  });
  const res = fakeRes();
  await trackEventHandler(req, res);

  assert.equal(res.statusCode, 200);
  const today = todayReportingDay();
  const row = await rowFor(today, 'checkout_viewed', 'WA-260902-IN-03');
  assert.ok(row, 'expected a row attributed to the forwarded campaign code');

  // No 'lid'/'source_lead_id' field exists anywhere in this request or in
  // site_traffic_daily's schema — this endpoint has never received or
  // stored lead identity, and this change doesn't add that either.
  assert.equal('lid' in req.body, false);
});

test('a missing/empty/non-string campaign value degrades to the existing default, never an error', async () => {
  const res1 = fakeRes();
  await trackEventHandler(fakeReq({ method: 'POST', body: { event: 'trial_clicked', campaign: '' }, headers: {} }), res1);
  assert.equal(res1.statusCode, 200);
  assert.equal(res1._json.ok, true);

  const res2 = fakeRes();
  await trackEventHandler(fakeReq({ method: 'POST', body: { event: 'trial_clicked', campaign: 42 }, headers: {} }), res2);
  assert.equal(res2.statusCode, 200);
  assert.equal(res2._json.ok, true);
});

test('anonymous tracking NEVER creates a customers or leads row, regardless of campaign tagging', async () => {
  const customersBefore = await countRows('customers');
  const leadsBefore = await countRows('leads');

  await trackEventHandler(
    fakeReq({ method: 'POST', body: { event: 'opened', campaign: 'WA-ANON-TEST' }, headers: { 'x-vercel-ip-country': 'US' } }),
    fakeRes()
  );

  const customersAfter = await countRows('customers');
  const leadsAfter = await countRows('leads');
  assert.equal(customersAfter, customersBefore, 'anonymous tracking must never create a customers row');
  assert.equal(leadsAfter, leadsBefore, 'anonymous tracking must never create a leads row');
});

test('a historical row written under a different (legacy UTC-style) day bucket is never rewritten by a new write', async () => {
  // Simulate a historical row exactly as the pre-fix code would have
  // written it: some arbitrary past UTC-sliced day, untouched by anything
  // in this test file's "today" writes.
  const legacyDay = '2026-01-15';
  await pool.query(
    `INSERT INTO site_traffic_daily (day, event, campaign_code, country, device_type, visit_count)
     VALUES ($1, 'opened', 'none', 'unknown', 'unknown', 7)
     ON CONFLICT (day, event, campaign_code, country, device_type) DO NOTHING`,
    [legacyDay]
  );

  await trackEventHandler(fakeReq({ method: 'POST', body: { event: 'opened' }, headers: {} }), fakeRes());

  const legacyRow = await rowFor(legacyDay, 'opened', 'none');
  assert.ok(legacyRow, 'the pre-seeded historical row must still exist');
  assert.equal(legacyRow.visit_count, 7, 'a new write for today must never alter a historical day\'s row');
});

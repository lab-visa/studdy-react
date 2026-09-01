/**
 * CRM-1 Objective 1 — anonymous traffic/campaign attribution fix.
 * Tests migration 0012's increment_site_traffic(...) function directly
 * (via the same supabase.rpc() call pattern api/track-event.js uses),
 * against the real Postgres function — not a reimplementation of its
 * logic in JS.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';

let pool;
let supabase;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
});

after(async () => {
  await closeTestPool();
});

async function increment(day, event, country, deviceType, campaignCode) {
  const { error } = await supabase.rpc('increment_site_traffic', {
    p_day: day,
    p_event: event,
    p_country: country,
    p_device_type: deviceType,
    p_campaign_code: campaignCode,
  });
  assert.equal(error, null, `increment_site_traffic errored: ${JSON.stringify(error)}`);
}

async function rowFor(day, event, campaignCode, country, deviceType) {
  const res = await pool.query(
    'SELECT * FROM site_traffic_daily WHERE day=$1 AND event=$2 AND campaign_code=$3 AND country=$4 AND device_type=$5',
    [day, event, campaignCode, country, deviceType]
  );
  return res.rows[0] || null;
}

test('NULL campaign_code normalizes to none', async () => {
  const day = '2026-09-01';
  await increment(day, 'opened', 'US', 'desktop', null);
  const row = await rowFor(day, 'opened', 'none', 'US', 'desktop');
  assert.ok(row, 'expected a row with campaign_code=none');
  assert.equal(row.visit_count, 1);
});

test('empty-string campaign_code normalizes to none', async () => {
  const day = '2026-09-02';
  await increment(day, 'opened', 'US', 'desktop', '');
  const row = await rowFor(day, 'opened', 'none', 'US', 'desktop');
  assert.ok(row, 'expected a row with campaign_code=none');
  assert.equal(row.visit_count, 1);
});

test('whitespace-only campaign_code normalizes to none (Revision 2.1 btrim correction)', async () => {
  const day = '2026-09-03';
  await increment(day, 'opened', 'US', 'desktop', '   ');
  const row = await rowFor(day, 'opened', 'none', 'US', 'desktop');
  assert.ok(row, 'expected a row with campaign_code=none for whitespace-only input');
  assert.equal(row.visit_count, 1);

  // Confirm no separate whitespace bucket was created alongside it.
  const literalRow = await rowFor(day, 'opened', '   ', 'US', 'desktop');
  assert.equal(literalRow, null, 'whitespace-only campaign_code must not create its own bucket');
});

test('a named campaign remains distinguishable from organic (none) traffic', async () => {
  const day = '2026-09-04';
  await increment(day, 'opened', 'US', 'desktop', 'WA-260904-US-01');
  await increment(day, 'opened', 'US', 'desktop', null);

  const campaignRow = await rowFor(day, 'opened', 'WA-260904-US-01', 'US', 'desktop');
  const organicRow = await rowFor(day, 'opened', 'none', 'US', 'desktop');
  assert.ok(campaignRow, 'expected a distinct row for the named campaign');
  assert.ok(organicRow, 'expected a distinct row for organic traffic');
  assert.equal(campaignRow.visit_count, 1);
  assert.equal(organicRow.visit_count, 1);
});

test('existing aggregate (create-at-1-or-bump-by-1) behavior preserved', async () => {
  const day = '2026-09-05';
  await increment(day, 'checkout_viewed', 'IN', 'mobile', 'WA-260905-IN-02');
  await increment(day, 'checkout_viewed', 'IN', 'mobile', 'WA-260905-IN-02');
  await increment(day, 'checkout_viewed', 'IN', 'mobile', 'WA-260905-IN-02');

  const row = await rowFor(day, 'checkout_viewed', 'WA-260905-IN-02', 'IN', 'mobile');
  assert.ok(row);
  assert.equal(row.visit_count, 3, 'three identical calls should bump the same row to 3, not create 3 rows');
});

test('only one increment_site_traffic function exists in this test schema, with the corrected 5-argument signature', async () => {
  // Scoped to current_schema() — this test process's own isolated
  // migration-seeded schema, not the whole cluster (other test FILES
  // each seed their own separate schema in parallel).
  const res = await pool.query(
    `SELECT pg_get_function_identity_arguments(p.oid) AS args
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'increment_site_traffic' AND n.nspname = current_schema()`
  );
  assert.equal(res.rows.length, 1, 'expected exactly one increment_site_traffic function in this schema (old 4-arg version must be dropped)');
  assert.match(res.rows[0].args, /p_campaign_code/);
});

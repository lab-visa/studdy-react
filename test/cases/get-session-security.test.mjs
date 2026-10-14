/**
 * Security regression tests for api/get-session.js (Oct 2026).
 *
 * The dashboard endpoint used to fall back to a hard-coded shared Studdy
 * login for ANY Stripe session id — including checkouts that were never
 * completed. These tests pin the fixed behaviour:
 *   1. an incomplete (open/expired) Stripe session gets a 404 and no data;
 *   2. a completed session not yet in Supabase gets accessPending: true and
 *      EMPTY credentials — never a shared/placeholder login;
 *   3. a real lead row still returns that lead's assigned login.
 * Stripe and Supabase are both faked — no network, no database.
 */
import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fakeReq, fakeRes } from '../helpers/fake-http.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let stripeSession = null;   // what the fake Stripe returns
let leadRow = null;         // what the fake `leads` lookup returns
let groupRow = null;        // what the fake `studdy_accounts` lookup returns

function fakeSupabase() {
  return {
    from(table) {
      const result = table === 'leads' ? leadRow : table === 'studdy_accounts' ? groupRow : null;
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: result, error: null }),
      };
      return chain;
    },
  };
}

class FakeStripe {
  constructor() {
    this.checkout = { sessions: { retrieve: async () => stripeSession } };
  }
}

let handler;

before(async () => {
  mock.module('stripe', { defaultExport: FakeStripe });
  mock.module(pathToFileURL(join(repoRoot, 'api/_lib/supabase.js')).href, {
    namedExports: { getSupabase: () => fakeSupabase() },
  });
  ({ default: handler } = await import(pathToFileURL(join(repoRoot, 'api/get-session.js')).href));
});

const completedSession = {
  status: 'complete',
  customer: { name: 'Test Parent', email: 'parent@example.com' },
  subscription: {
    status: 'trialing',
    trial_end: 1893456000,
    items: { data: [{ price: { currency: 'inr', unit_amount: 1499900, recurring: { interval: 'year' } } }] },
  },
};

test('source no longer contains the hard-coded shared login', () => {
  const src = readFileSync(join(repoRoot, 'api/get-session.js'), 'utf8');
  assert.equal(src.includes('StuddyLab2024'), false);
  assert.equal(src.includes('class1001@'), false);
});

test('missing session_id is rejected 400', async () => {
  const res = fakeRes();
  await handler(fakeReq({ query: {} }), res);
  assert.equal(res.statusCode, 400);
});

test('an incomplete (open) checkout gets 404 and no data at all', async () => {
  leadRow = null;
  stripeSession = { ...completedSession, status: 'open' };
  const res = fakeRes();
  await handler(fakeReq({ query: { session_id: 'cs_test_open' } }), res);
  assert.equal(res.statusCode, 404);
  assert.equal(res._json.studdyEmail, undefined);
  assert.equal(res._json.studdyPassword, undefined);
});

test('an expired checkout gets 404', async () => {
  leadRow = null;
  stripeSession = { ...completedSession, status: 'expired' };
  const res = fakeRes();
  await handler(fakeReq({ query: { session_id: 'cs_test_expired' } }), res);
  assert.equal(res.statusCode, 404);
});

test('a completed checkout not yet in Supabase gets accessPending and EMPTY credentials', async () => {
  leadRow = null;
  stripeSession = completedSession;
  const res = fakeRes();
  await handler(fakeReq({ query: { session_id: 'cs_test_complete' } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res._json.accessPending, true);
  assert.equal(res._json.studdyEmail, '');
  assert.equal(res._json.studdyPassword, '');
  assert.equal(res._json.email, 'parent@example.com');
});

test('a real lead row returns its own assigned login, live from studdy_accounts', async () => {
  leadRow = {
    parent_name: 'Real Parent', email: 'real@example.com', plan_type: 'Yearly', status: 'Active',
    group_name: 'Group 1', studdy_email: 'old@x.org', studdy_password: 'old-pw',
  };
  groupRow = { studdy_email: 'group1@x.org', studdy_password: 'group1-pw', studdy_url: 'https://studdyai.com' };
  const res = fakeRes();
  await handler(fakeReq({ query: { session_id: 'cs_test_lead' } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res._json.studdyEmail, 'group1@x.org');
  assert.equal(res._json.studdyPassword, 'group1-pw');
  assert.equal(res._json.accessPending, false);
});

test('a lead with no seat assigned yet is marked accessPending, not given a fallback login', async () => {
  leadRow = { parent_name: 'No Seat', email: 'ns@example.com', group_name: null, studdy_email: null, studdy_password: null };
  groupRow = null;
  const res = fakeRes();
  await handler(fakeReq({ query: { session_id: 'cs_test_noseat' } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res._json.accessPending, true);
  assert.equal(res._json.studdyEmail, '');
  assert.equal(res._json.studdyPassword, '');
});

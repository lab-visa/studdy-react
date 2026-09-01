/**
 * PRESERVATION — proves the existing, UNMODIFIED allocation/credential
 * logic (api/_lib/sync-checkout-session.js, api/_lib/sync-customer.js)
 * still behaves correctly against the real schema after this round's
 * migrations/changes. Neither file was edited this round; these tests
 * exercise their real, exported, public functions end-to-end.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { syncCheckoutSession } from '../../api/_lib/sync-checkout-session.js';
import { syncCustomerFromCheckoutSession } from '../../api/_lib/sync-customer.js';

const repoRoot = join(new URL('.', import.meta.url).pathname, '..', '..');

let pool;
let supabase;

// assignStuddyAccount() (production code, unmodified) picks the
// EARLIEST-by-group_name account with room — real, deterministic
// behavior this suite must respect, not work around. Each test creates
// its own uniquely-named group(s), but without resetting studdy_accounts
// between tests, an earlier test's still-not-full group could
// alphabetically sort before a later test's group and "steal" its
// allocation. Truncating between tests isolates each test's allocation
// scenario, matching how this logic actually runs against one row per
// account in production.
beforeEach(async () => {
  await pool.query(
    'TRUNCATE studdy_accounts, leads, customers, subscriptions, account_assignments, cancellation_requests, payment_events RESTART IDENTITY CASCADE'
  );
});

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
});

after(async () => {
  await closeTestPool();
});

function fakeStripeFor(session) {
  return {
    checkout: {
      sessions: {
        retrieve: async () => session,
      },
    },
  };
}

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
      default_payment_method: { card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } },
    },
  };
}

async function seedStuddyAccount(groupName, maxCapacity) {
  await pool.query(
    `INSERT INTO studdy_accounts (group_name, studdy_email, studdy_password, studdy_url, active_customer_count, max_capacity)
     VALUES ($1, $2, 'pw', 'https://studdyai.com', 0, $3)`,
    [groupName, `${groupName}@studdyai.test`, maxCapacity]
  );
}

test('source constants are unchanged: MAX_ALLOCATION_ATTEMPTS = 5 remains in sync-checkout-session.js', () => {
  const src = readFileSync(join(repoRoot, 'api/_lib/sync-checkout-session.js'), 'utf8');
  assert.match(src, /MAX_ALLOCATION_ATTEMPTS\s*=\s*5/);
});

test('a first-time checkout claims a Studdy seat via CAS and writes the legacy leads row', async () => {
  const group = `Group_${randomUUID()}`;
  await seedStuddyAccount(group, 7);

  const customerId = `cus_${randomUUID()}`;
  const sessionId = `cs_${randomUUID()}`;
  const session = buildSession({ sessionId, customerId });
  const leadId = await syncCheckoutSession(fakeStripeFor(session), supabase, sessionId);

  assert.ok(leadId);
  const { rows } = await pool.query('SELECT * FROM leads WHERE lead_id=$1', [leadId]);
  assert.equal(rows[0].group_name, group);
  assert.equal(rows[0].stage, 'trial_started');

  const acct = await pool.query('SELECT active_customer_count FROM studdy_accounts WHERE group_name=$1', [group]);
  assert.equal(acct.rows[0].active_customer_count, 1, 'CAS should have incremented active_customer_count exactly once');
});

test('when every group is full, no seat is claimed and group_name stays null (never overfills)', async () => {
  const group = `Full_${randomUUID()}`;
  await seedStuddyAccount(group, 1);
  await pool.query('UPDATE studdy_accounts SET active_customer_count = 1 WHERE group_name = $1', [group]);

  const sessionId = `cs_${randomUUID()}`;
  const session = buildSession({ sessionId, customerId: `cus_${randomUUID()}` });
  const leadId = await syncCheckoutSession(fakeStripeFor(session), supabase, sessionId);

  const { rows } = await pool.query('SELECT group_name FROM leads WHERE lead_id=$1', [leadId]);
  assert.equal(rows[0].group_name, null);

  const acct = await pool.query('SELECT active_customer_count FROM studdy_accounts WHERE group_name=$1', [group]);
  assert.equal(acct.rows[0].active_customer_count, 1, 'a full group must never be pushed over its own recorded count');
});

test('CAS allocation under real concurrency: N simultaneous checkouts against capacity-N never overfill or double-assign', async () => {
  const group = `Concurrent_${randomUUID()}`;
  const CAPACITY = 4;
  await seedStuddyAccount(group, CAPACITY);

  const sessions = Array.from({ length: CAPACITY }, () => {
    const customerId = `cus_${randomUUID()}`;
    const sessionId = `cs_${randomUUID()}`;
    return { sessionId, session: buildSession({ sessionId, customerId }) };
  });

  const leadIds = await Promise.all(
    sessions.map(({ sessionId, session }) => syncCheckoutSession(fakeStripeFor(session), supabase, sessionId))
  );

  const { rows } = await pool.query('SELECT lead_id, group_name FROM leads WHERE lead_id = ANY($1::uuid[])', [leadIds]);
  const assignedCount = rows.filter((r) => r.group_name === group).length;
  assert.equal(assignedCount, CAPACITY, `all ${CAPACITY} concurrent checkouts should have gotten a seat (capacity exactly matches demand)`);

  const acct = await pool.query('SELECT active_customer_count FROM studdy_accounts WHERE group_name=$1', [group]);
  assert.equal(acct.rows[0].active_customer_count, CAPACITY, 'active_customer_count must exactly equal the number actually assigned, never more');
});

test('CAS allocation under contention beyond capacity: exactly capacity-many win, the rest get none (no overfill)', async () => {
  const group = `Contention_${randomUUID()}`;
  const CAPACITY = 2;
  const DEMAND = 5;
  await seedStuddyAccount(group, CAPACITY);

  const sessions = Array.from({ length: DEMAND }, () => {
    const customerId = `cus_${randomUUID()}`;
    const sessionId = `cs_${randomUUID()}`;
    return { sessionId, session: buildSession({ sessionId, customerId }) };
  });

  const leadIds = await Promise.all(
    sessions.map(({ sessionId, session }) => syncCheckoutSession(fakeStripeFor(session), supabase, sessionId))
  );

  const { rows } = await pool.query('SELECT group_name FROM leads WHERE lead_id = ANY($1::uuid[])', [leadIds]);
  const assignedCount = rows.filter((r) => r.group_name === group).length;
  assert.equal(assignedCount, CAPACITY, 'no more than capacity should ever be assigned, even under 5x contention');

  const acct = await pool.query('SELECT active_customer_count FROM studdy_accounts WHERE group_name=$1', [group]);
  assert.equal(acct.rows[0].active_customer_count, CAPACITY);
});

test('a re-sync of an existing lead keeps their existing seat, never claims a second one', async () => {
  const group = `Resync_${randomUUID()}`;
  await seedStuddyAccount(group, 7);

  const customerId = `cus_${randomUUID()}`;
  const sessionId = `cs_${randomUUID()}`;
  const session = buildSession({ sessionId, customerId });

  const leadId1 = await syncCheckoutSession(fakeStripeFor(session), supabase, sessionId);
  const leadId2 = await syncCheckoutSession(fakeStripeFor(session), supabase, sessionId); // simulates refresh-lead.js / webhook retry
  assert.equal(leadId1, leadId2);

  const acct = await pool.query('SELECT active_customer_count FROM studdy_accounts WHERE group_name=$1', [group]);
  assert.equal(acct.rows[0].active_customer_count, 1, 're-syncing the same lead must not claim a second seat');
});

test('mirrorLegacyAllocation (via syncCustomerFromCheckoutSession) mirrors the legacy seat into account_assignments, idempotently', async () => {
  const group = `Mirror_${randomUUID()}`;
  await seedStuddyAccount(group, 7);

  const customerId = `cus_${randomUUID()}`;
  const sessionId = `cs_${randomUUID()}`;
  const session = buildSession({ sessionId, customerId });

  await syncCheckoutSession(fakeStripeFor(session), supabase, sessionId); // legacy leads write + seat claim
  await syncCustomerFromCheckoutSession(supabase, session); // new-CRM mirror
  await syncCustomerFromCheckoutSession(supabase, session); // retry — must be idempotent

  const custRes = await pool.query('SELECT id FROM customers WHERE stripe_customer_id=$1', [customerId]);
  assert.equal(custRes.rows.length, 1);
  const customerRowId = custRes.rows[0].id;

  const assignments = await pool.query(
    `SELECT * FROM account_assignments WHERE customer_id=$1 AND status='active'`,
    [customerRowId]
  );
  assert.equal(assignments.rows.length, 1, 'exactly one active assignment, even after a retry (idempotent, not duplicated)');

  const acctRes = await pool.query('SELECT id FROM studdy_accounts WHERE group_name=$1', [group]);
  assert.equal(assignments.rows[0].studdy_account_id, acctRes.rows[0].id, 'the mirrored assignment must point at the SAME account the legacy allocator chose');
});

test('mirrorLegacyAllocation never overwrites an existing assignment that disagrees with legacy (logs a mismatch, does not fix it)', async () => {
  const groupA = `MismatchA_${randomUUID()}`;
  const groupB = `MismatchB_${randomUUID()}`;
  await seedStuddyAccount(groupA, 7);
  await seedStuddyAccount(groupB, 7);

  const customerId = `cus_${randomUUID()}`;
  const sessionId = `cs_${randomUUID()}`;
  const session = buildSession({ sessionId, customerId });

  await syncCheckoutSession(fakeStripeFor(session), supabase, sessionId);
  await syncCustomerFromCheckoutSession(supabase, session);

  const custRes = await pool.query('SELECT id FROM customers WHERE stripe_customer_id=$1', [customerId]);
  const customerRowId = custRes.rows[0].id;

  // Simulate a legacy re-assignment to a different group happening later
  // (e.g. manual data fix) without the mirror being told directly.
  await pool.query('UPDATE leads SET group_name=$1 WHERE stripe_session_id=$2', [groupB, sessionId]);

  await syncCustomerFromCheckoutSession(supabase, session); // should NOT silently overwrite

  const assignments = await pool.query(
    `SELECT * FROM account_assignments WHERE customer_id=$1 AND status='active'`,
    [customerRowId]
  );
  assert.equal(assignments.rows.length, 1, 'must still be exactly one active assignment');
  const acctA = await pool.query('SELECT id FROM studdy_accounts WHERE group_name=$1', [groupA]);
  assert.equal(assignments.rows[0].studdy_account_id, acctA.rows[0].id, 'the original mirrored assignment (Group A) must be left untouched, never silently overwritten to Group B');
});

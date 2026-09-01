/**
 * CRM-1 Objective 2 — cancellation_requests dual-write + one-open-
 * workflow protection. Tests mirrorCancellationRequest() (exported from
 * api/cancel-request.js, unmodified) directly against the real
 * cancellation_requests_one_open_per_customer index (migration 0013).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { mirrorCancellationRequest } from '../../api/cancel-request.js';

let pool;
let supabase;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
});

after(async () => {
  await closeTestPool();
});

async function seedCustomer() {
  const sessionId = `cs_test_${randomUUID()}`;
  const res = await pool.query(
    `INSERT INTO customers (stripe_customer_id, stripe_session_id) VALUES ($1, $2) RETURNING id`,
    [`cus_test_${randomUUID()}`, sessionId]
  );
  return { customerId: res.rows[0].id, sessionId };
}

async function openRequestsFor(customerId) {
  const res = await pool.query(
    `SELECT * FROM cancellation_requests WHERE customer_id=$1 AND status IN ('pending_discussion','approved_for_cancellation','cancel_scheduled')`,
    [customerId]
  );
  return res.rows;
}

test('first request creates exactly one open cancellation_requests row', async () => {
  const { customerId, sessionId } = await seedCustomer();
  await mirrorCancellationRequest(supabase, {
    sessionId,
    reason: 'too expensive',
    message: 'please cancel',
    requestedAt: new Date().toISOString(),
  });

  const rows = await openRequestsFor(customerId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'pending_discussion');
  assert.equal(rows[0].source, 'dashboard');
  assert.equal(rows[0].reason, 'too expensive');
});

test('a repeat request does not create a duplicate open row', async () => {
  const { customerId, sessionId } = await seedCustomer();
  await mirrorCancellationRequest(supabase, { sessionId, reason: 'r1', message: 'm1', requestedAt: new Date().toISOString() });
  await mirrorCancellationRequest(supabase, { sessionId, reason: 'r2 (should be ignored)', message: 'm2', requestedAt: new Date().toISOString() });

  const rows = await openRequestsFor(customerId);
  assert.equal(rows.length, 1, 'a second request must not create a second open row');
  assert.equal(rows[0].reason, 'r1', 'the original open request must not be overwritten by the repeat');
});

test('two concurrent duplicate requests cannot create two open rows (race, DB-index-enforced)', async () => {
  const { customerId, sessionId } = await seedCustomer();
  const now = new Date().toISOString();

  await Promise.all([
    mirrorCancellationRequest(supabase, { sessionId, reason: 'A', message: 'A', requestedAt: now }),
    mirrorCancellationRequest(supabase, { sessionId, reason: 'B', message: 'B', requestedAt: now }),
  ]);

  const rows = await openRequestsFor(customerId);
  assert.equal(rows.length, 1, 'concurrent duplicate requests must resolve to exactly one open row');
});

test('a resolved (retained) prior request permits a brand-new one', async () => {
  const { customerId, sessionId } = await seedCustomer();
  await mirrorCancellationRequest(supabase, { sessionId, reason: 'first', message: 'first', requestedAt: new Date().toISOString() });

  const [firstRow] = await openRequestsFor(customerId);
  await pool.query(`UPDATE cancellation_requests SET status='retained' WHERE id=$1`, [firstRow.id]);
  assert.equal((await openRequestsFor(customerId)).length, 0, 'retained should no longer count as open');

  await mirrorCancellationRequest(supabase, { sessionId, reason: 'second', message: 'second', requestedAt: new Date().toISOString() });
  const rows = await openRequestsFor(customerId);
  assert.equal(rows.length, 1, 'a new open request must be allowed after the prior one was retained');
  assert.equal(rows[0].reason, 'second');
});

test('a resolved (cancelled) prior request permits a brand-new one', async () => {
  const { customerId, sessionId } = await seedCustomer();
  await mirrorCancellationRequest(supabase, { sessionId, reason: 'first', message: 'first', requestedAt: new Date().toISOString() });

  const [firstRow] = await openRequestsFor(customerId);
  await pool.query(`UPDATE cancellation_requests SET status='cancelled' WHERE id=$1`, [firstRow.id]);

  await mirrorCancellationRequest(supabase, { sessionId, reason: 'second', message: 'second', requestedAt: new Date().toISOString() });
  const rows = await openRequestsFor(customerId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reason, 'second');
});

test('the database index itself rejects a second open row for approved_for_cancellation/cancel_scheduled states too', async () => {
  const { customerId } = await seedCustomer();
  await pool.query(
    `INSERT INTO cancellation_requests (customer_id, source, status) VALUES ($1, 'dashboard', 'approved_for_cancellation')`,
    [customerId]
  );
  await assert.rejects(
    pool.query(`INSERT INTO cancellation_requests (customer_id, source, status) VALUES ($1, 'dashboard', 'cancel_scheduled')`, [customerId]),
    /duplicate key value violates unique constraint/
  );
});

test('no matching customers row: mirror is a safe no-op, never throws', async () => {
  await assert.doesNotReject(
    mirrorCancellationRequest(supabase, {
      sessionId: `cs_test_nonexistent_${randomUUID()}`,
      reason: 'x',
      message: 'x',
      requestedAt: new Date().toISOString(),
    })
  );
});

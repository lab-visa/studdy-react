/**
 * CRM-1 Objective 3 (Revision 2.1 correction) — payment_claims atomic
 * at-most-once idempotency, and its PAYMENT_CLAIM_INCOMPLETE
 * reconciliation check (Objective 4, final clarification).
 *
 * Tests claimPaymentEvent() (exported, unmodified, from
 * api/stripe-webhook.js) directly against the real payment_claims table
 * and its unique index (migration 0015) — including TRUE concurrency,
 * using two genuinely simultaneous calls sharing the same Postgres pool.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { claimPaymentEvent } from '../../api/stripe-webhook.js';
import { checkPaymentClaimIncomplete } from '../../api/admin/reconciliation.js';

let pool;
let supabase;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
});

after(async () => {
  await closeTestPool();
});

/** Mimics exactly the handler's real sequence: claim first, then (only if claimed) increment. */
async function seedLeadWithSubscription() {
  const res = await pool.query(
    `INSERT INTO leads (stripe_subscription_id, total_months_paid) VALUES ($1, 0) RETURNING lead_id`,
    [`sub_test_${randomUUID()}`]
  );
  return res.rows[0].lead_id;
}

async function processPaymentSucceeded(leadId, event) {
  const claimed = await claimPaymentEvent(supabase, event);
  if (!claimed) return { claimed: false };
  await pool.query(`UPDATE leads SET total_months_paid = total_months_paid + 1 WHERE lead_id = $1`, [leadId]);
  return { claimed: true };
}

test('first delivery of an event claims it and increments once', async () => {
  const leadId = await seedLeadWithSubscription();
  const event = { id: `evt_${randomUUID()}`, type: 'invoice.payment_succeeded' };

  const result = await processPaymentSucceeded(leadId, event);
  assert.equal(result.claimed, true);

  const { rows } = await pool.query('SELECT total_months_paid FROM leads WHERE lead_id=$1', [leadId]);
  assert.equal(rows[0].total_months_paid, 1);
});

test('sequential duplicate delivery of the same event does not increment again', async () => {
  const leadId = await seedLeadWithSubscription();
  const event = { id: `evt_${randomUUID()}`, type: 'invoice.payment_succeeded' };

  await processPaymentSucceeded(leadId, event);
  const second = await processPaymentSucceeded(leadId, event); // Stripe redelivery
  assert.equal(second.claimed, false);

  const { rows } = await pool.query('SELECT total_months_paid FROM leads WHERE lead_id=$1', [leadId]);
  assert.equal(rows[0].total_months_paid, 1, 'a sequential duplicate must not increment a second time');
});

test('TWO CONCURRENT handlers with the identical event.id increment exactly once', async () => {
  const leadId = await seedLeadWithSubscription();
  const event = { id: `evt_${randomUUID()}`, type: 'invoice.payment_succeeded' };

  const [a, b] = await Promise.all([processPaymentSucceeded(leadId, event), processPaymentSucceeded(leadId, event)]);

  const claimedCount = [a, b].filter((r) => r.claimed).length;
  assert.equal(claimedCount, 1, 'exactly one of the two concurrent deliveries should win the claim');

  const { rows } = await pool.query('SELECT total_months_paid FROM leads WHERE lead_id=$1', [leadId]);
  assert.equal(rows[0].total_months_paid, 1, 'concurrent duplicate delivery must increment exactly once, never twice');
});

test('exactly one payment_claims row exists per event id after concurrent delivery', async () => {
  const leadId = await seedLeadWithSubscription();
  const event = { id: `evt_${randomUUID()}`, type: 'invoice.payment_succeeded' };

  await Promise.all([processPaymentSucceeded(leadId, event), processPaymentSucceeded(leadId, event), processPaymentSucceeded(leadId, event)]);

  const { rows } = await pool.query('SELECT * FROM payment_claims WHERE stripe_event_id=$1', [event.id]);
  assert.equal(rows.length, 1);
});

test('PAYMENT_CLAIM_INCOMPLETE: a stale claim with no matching payment_events row is flagged for manual review', async () => {
  const staleEventId = `evt_stale_${randomUUID()}`;
  // Insert directly with an old claimed_at, bypassing claimPaymentEvent's
  // "now()" default, to simulate a claim from >10 minutes ago.
  await pool.query(
    `INSERT INTO payment_claims (stripe_event_id, event_type, claimed_at) VALUES ($1, $2, now() - interval '20 minutes')`,
    [staleEventId, 'invoice.payment_succeeded']
  );

  const result = await checkPaymentClaimIncomplete(supabase);
  const flagged = result.items.find((i) => i.stripe_event_id === staleEventId);

  assert.ok(flagged, 'a stale, unresolved claim must be flagged');
  assert.equal(flagged.requires_manual_review, true);
  assert.equal(result.check, 'PAYMENT_CLAIM_INCOMPLETE');
  assert.match(result.note, /does not prove/i, 'the check must not overclaim what the signal proves');
});

test('a claim younger than the staleness threshold is NOT flagged (still likely in-flight)', async () => {
  const freshEventId = `evt_fresh_${randomUUID()}`;
  await pool.query(`INSERT INTO payment_claims (stripe_event_id, event_type) VALUES ($1, $2)`, [
    freshEventId,
    'invoice.payment_succeeded',
  ]);

  const result = await checkPaymentClaimIncomplete(supabase);
  const flagged = result.items.find((i) => i.stripe_event_id === freshEventId);
  assert.equal(flagged, undefined, 'a fresh claim must not be flagged yet');
});

test('a claim WITH a matching payment_events row is not flagged, even if stale', async () => {
  const eventId = `evt_resolved_${randomUUID()}`;
  await pool.query(
    `INSERT INTO payment_claims (stripe_event_id, event_type, claimed_at) VALUES ($1, $2, now() - interval '1 hour')`,
    [eventId, 'invoice.payment_succeeded']
  );
  await pool.query(`INSERT INTO payment_events (stripe_event_id, event_type) VALUES ($1, $2)`, [eventId, 'invoice.payment_succeeded']);

  const result = await checkPaymentClaimIncomplete(supabase);
  const flagged = result.items.find((i) => i.stripe_event_id === eventId);
  assert.equal(flagged, undefined, 'a claim that has a matching payment_events row is resolved, not incomplete');
});

test('reconciliation never automatically repairs/increments — it is read-only', async () => {
  const staleEventId = `evt_readonly_${randomUUID()}`;
  await pool.query(
    `INSERT INTO payment_claims (stripe_event_id, event_type, claimed_at) VALUES ($1, $2, now() - interval '20 minutes')`,
    [staleEventId, 'invoice.payment_succeeded']
  );

  await checkPaymentClaimIncomplete(supabase);
  await checkPaymentClaimIncomplete(supabase); // run it twice, for good measure

  const claimRows = await pool.query('SELECT * FROM payment_claims WHERE stripe_event_id=$1', [staleEventId]);
  assert.equal(claimRows.rows.length, 1, 'the payment_claims row must never be deleted/released by reconciliation');

  const eventRows = await pool.query('SELECT * FROM payment_events WHERE stripe_event_id=$1', [staleEventId]);
  assert.equal(eventRows.rows.length, 0, 'reconciliation must never fabricate a payment_events row to make itself green');
});

test('a non-23505 error from the claim insert throws (fails safe) instead of being mistaken for a duplicate', async () => {
  // A malformed event (missing type, which is NOT NULL) forces a real DB
  // error other than a unique violation. Per the ChatGPT pre-production
  // review: a genuine error must NOT be treated the same as a real
  // duplicate (error.code === '23505') — doing so would make the caller
  // silently respond 200 to Stripe (no retry) while never running the
  // legacy increment. claimPaymentEvent() must throw here, not return
  // false, so this propagates to the webhook handler's own outer
  // try/catch and produces a 500 — which Stripe retries.
  const badEventId = `evt_bad_${randomUUID()}`;
  await assert.rejects(
    () => claimPaymentEvent(supabase, { id: badEventId, type: null }),
    /unexpected error claiming/
  );

  // No claim row should exist for this event — the failed INSERT created
  // nothing, so a legitimate future delivery of a well-formed event with
  // this same id (unlikely in practice, but worth confirming) is not
  // blocked by a phantom claim from the failed attempt.
  const { rows } = await pool.query('SELECT * FROM payment_claims WHERE stripe_event_id=$1', [badEventId]);
  assert.equal(rows.length, 0, 'a genuinely failed insert must leave no claim row behind');
});

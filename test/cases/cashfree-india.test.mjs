/**
 * India Cashfree checkout (Oct 2026): create-order, webhook, india-session
 * and fulfilment — run against a real test Postgres (all migrations
 * applied, including 0021_india_orders) through the supabase shim.
 * Cashfree's HTTP API is faked with an injected fetch; no network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { fakeReq, fakeRes } from '../helpers/fake-http.mjs';
import createOrder from '../../api/cashfree/create-order.js';
import webhook from '../../api/cashfree/webhook.js';
import indiaSession from '../../api/india-session.js';
import { verifyWebhookSignature, normalizeIndianPhone, newOrderId } from '../../api/_lib/cashfree.js';

const SECRET = 'test_secret_key';
const cfg = () => ({ appId: 'app', secret: SECRET, env: 'sandbox', baseUrl: 'https://sandbox.cashfree.com/pg' });

let pool;
let supabase;
let deps;
let cfCalls;
let cfOrderStatus; // what the fake GET /orders/{id} returns

function fakeFetch(url, opts) {
  cfCalls.push({ url, opts });
  if (opts.method === 'POST') {
    const body = JSON.parse(opts.body);
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ cf_order_id: 123, order_id: body.order_id, payment_session_id: 'session_abc' }) });
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => ({ order_status: cfOrderStatus }) });
}

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
  deps = { getSupabase: () => supabase, cashfreeConfig: cfg, fetch: fakeFetch };
  await pool.query(
    `INSERT INTO studdy_accounts (group_name, studdy_email, studdy_password, studdy_url, max_capacity)
     VALUES ('AAA-India', 'group@x.org', 'pw-123', 'https://studdyai.com', 1000)`
  );
});
after(async () => { await closeTestPool(); });

const validBody = { plan: 'yearly', name: 'Asha Patil', email: 'asha@example.com', phone: '+91 98765 43210' };
const req = (body) => fakeReq({ method: 'POST', body, headers: { host: 'studdylab.com', 'x-forwarded-proto': 'https' } });

async function seatCount() {
  const { rows } = await pool.query(`SELECT active_customer_count FROM studdy_accounts WHERE group_name='AAA-India'`);
  return rows[0].active_customer_count;
}

async function makeOrder(plan = 'yearly') {
  cfCalls = [];
  const res = fakeRes();
  await createOrder(req({ ...validBody, plan }), res, deps);
  assert.equal(res.statusCode, 200, JSON.stringify(res._json));
  return res._json.orderId;
}

function signed(event) {
  const rawBody = Buffer.from(JSON.stringify(event));
  const ts = String(Date.now());
  const sig = createHmac('sha256', SECRET).update(ts + rawBody.toString()).digest('base64');
  return { rawBody, headers: { 'x-webhook-timestamp': ts, 'x-webhook-signature': sig } };
}

function successEvent(orderId, amount = 14999) {
  return {
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: { order_id: orderId, order_amount: amount },
      payment: { cf_payment_id: 999, payment_status: 'SUCCESS', payment_group: 'upi', payment_time: '2026-10-14T10:00:00+05:30' },
    },
  };
}

async function sendWebhook(event, { tamper = false } = {}) {
  const { rawBody, headers } = signed(event);
  if (tamper) headers['x-webhook-signature'] = 'AAAA' + headers['x-webhook-signature'].slice(4);
  const res = fakeRes();
  await webhook(fakeReq({ method: 'POST', headers }), res, { ...deps, rawBody });
  return res;
}

/* ---------- helpers ---------- */

test('phone normalisation accepts Indian mobiles and rejects others', () => {
  assert.equal(normalizeIndianPhone('+91 98765 43210'), '9876543210');
  assert.equal(normalizeIndianPhone('09876543210'), '9876543210');
  assert.equal(normalizeIndianPhone('9876543210'), '9876543210');
  assert.equal(normalizeIndianPhone('12345'), null);
  assert.equal(normalizeIndianPhone('5876543210'), null);
});

test('order ids are long, random and match the dashboard-link format', () => {
  const a = newOrderId();
  const b = newOrderId();
  assert.match(a, /^SLIN_[a-f0-9]{30}$/);
  assert.notEqual(a, b);
});

test('webhook signature: valid passes, tampered or missing fails', () => {
  const { rawBody, headers } = signed({ hello: 1 });
  const base = { rawBody, timestamp: headers['x-webhook-timestamp'], secret: SECRET };
  assert.equal(verifyWebhookSignature({ ...base, signature: headers['x-webhook-signature'] }), true);
  assert.equal(verifyWebhookSignature({ ...base, signature: 'nope' }), false);
  assert.equal(verifyWebhookSignature({ ...base, signature: headers['x-webhook-signature'], secret: 'other' }), false);
  assert.equal(verifyWebhookSignature({ ...base, signature: undefined }), false);
});

/* ---------- create-order ---------- */

test('create-order rejects bad input with a clear 400', async () => {
  for (const body of [
    { ...validBody, plan: 'monthly' },
    { ...validBody, name: ' ' },
    { ...validBody, email: 'not-an-email' },
    { ...validBody, phone: '12345' },
  ]) {
    const res = fakeRes();
    await createOrder(req(body), res, deps);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }
});

test('create-order uses the SERVER price, saves the order, and returns a payment session', async () => {
  cfCalls = [];
  const res = fakeRes();
  await createOrder(req({ ...validBody, amount: 1, ref: 'rahul01' }), res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(res._json.paymentSessionId, 'session_abc');
  assert.equal(res._json.mode, 'sandbox');

  const sent = JSON.parse(cfCalls[0].opts.body);
  assert.equal(sent.order_amount, 14999); // not the client's "amount: 1"
  assert.equal(sent.order_currency, 'INR');
  assert.equal(sent.customer_details.customer_phone, '9876543210');
  assert.equal(sent.order_meta.return_url, 'https://studdylab.com/dashboard?order_id={order_id}');
  assert.equal(sent.order_meta.notify_url, 'https://studdylab.com/api/cashfree/webhook');

  const { rows } = await pool.query('SELECT * FROM india_orders WHERE order_id=$1', [res._json.orderId]);
  assert.equal(rows[0].status, 'created');
  assert.equal(Number(rows[0].amount), 14999);
  assert.equal(rows[0].months, 12);
  assert.equal(rows[0].ref_code, 'rahul01');
  assert.equal(rows[0].cf_order_id, '123');
});

test('create-order marks the order failed and returns 502 if Cashfree errors', async () => {
  const failingFetch = () => Promise.resolve({ ok: false, status: 400, json: async () => ({ message: 'bad request' }) });
  const res = fakeRes();
  await createOrder(req(validBody), res, { ...deps, fetch: failingFetch });
  assert.equal(res.statusCode, 502);
  const { rows } = await pool.query(`SELECT status FROM india_orders ORDER BY created_at DESC LIMIT 1`);
  assert.equal(rows[0].status, 'failed');
});

test('create-order returns 503 (not a crash) when Cashfree keys are missing', async () => {
  const res = fakeRes();
  await createOrder(req(validBody), res, { ...deps, cashfreeConfig: () => { throw new Error('missing'); } });
  assert.equal(res.statusCode, 503);
});

/* ---------- webhook ---------- */

test('webhook with a bad signature is rejected 401 and changes nothing', async () => {
  const orderId = await makeOrder();
  const res = await sendWebhook(successEvent(orderId), { tamper: true });
  assert.equal(res.statusCode, 401);
  const { rows } = await pool.query('SELECT status FROM india_orders WHERE order_id=$1', [orderId]);
  assert.equal(rows[0].status, 'created');
});

test('verified success webhook marks paid, sets 12 months of access and assigns ONE seat even if delivered twice', async () => {
  const orderId = await makeOrder('yearly');
  const before = await seatCount();

  const r1 = await sendWebhook(successEvent(orderId));
  const r2 = await sendWebhook(successEvent(orderId)); // Cashfree retry / duplicate
  assert.equal(r1.statusCode, 200);
  assert.equal(r2.statusCode, 200);

  const { rows } = await pool.query('SELECT * FROM india_orders WHERE order_id=$1', [orderId]);
  const o = rows[0];
  assert.equal(o.status, 'paid');
  assert.equal(o.group_name, 'AAA-India');
  assert.equal(o.payment_method, 'upi');
  const months = (new Date(o.access_end) - new Date(o.access_start)) / (1000 * 60 * 60 * 24 * 30.4);
  assert.ok(months > 11.8 && months < 12.2, `access months ${months}`);
  assert.equal(await seatCount(), before + 1);
});

test('quarterly order gets 3 months of access', async () => {
  const orderId = await makeOrder('quarterly');
  await sendWebhook(successEvent(orderId, 7999));
  const { rows } = await pool.query('SELECT access_start, access_end FROM india_orders WHERE order_id=$1', [orderId]);
  const months = (new Date(rows[0].access_end) - new Date(rows[0].access_start)) / (1000 * 60 * 60 * 24 * 30.4);
  assert.ok(months > 2.8 && months < 3.2, `access months ${months}`);
});

test('a webhook claiming LESS money than the order is ignored', async () => {
  const orderId = await makeOrder('yearly');
  await sendWebhook(successEvent(orderId, 1));
  const { rows } = await pool.query('SELECT status, group_name FROM india_orders WHERE order_id=$1', [orderId]);
  assert.equal(rows[0].status, 'created');
  assert.equal(rows[0].group_name, null);
});

test('failed-payment webhook marks the order failed, and a later success still wins', async () => {
  const orderId = await makeOrder();
  await sendWebhook({ type: 'PAYMENT_FAILED_WEBHOOK', data: { order: { order_id: orderId }, payment: { payment_status: 'FAILED' } } });
  let { rows } = await pool.query('SELECT status FROM india_orders WHERE order_id=$1', [orderId]);
  assert.equal(rows[0].status, 'failed');

  await sendWebhook(successEvent(orderId));
  ({ rows } = await pool.query('SELECT status FROM india_orders WHERE order_id=$1', [orderId]));
  assert.equal(rows[0].status, 'paid');
});

/* ---------- india-session (dashboard) ---------- */

test('india-session: malformed or unknown order id gets 404', async () => {
  for (const id of ['abc', 'SLIN_' + 'f'.repeat(30)]) {
    const res = fakeRes();
    await indiaSession(fakeReq({ query: { order_id: id } }), res, deps);
    assert.equal(res.statusCode, 404);
  }
});

test('india-session: unpaid order shows pending and NO login', async () => {
  const orderId = await makeOrder();
  cfOrderStatus = 'ACTIVE';
  const res = fakeRes();
  await indiaSession(fakeReq({ query: { order_id: orderId } }), res, deps);
  assert.equal(res._json.paymentStatus, 'pending');
  assert.equal(res._json.studdyEmail, undefined);
  assert.equal(res._json.studdyPassword, undefined);
});

test('india-session: if Cashfree says PAID before the webhook arrives, it fulfils and shows the login', async () => {
  const orderId = await makeOrder();
  const before = await seatCount();
  cfOrderStatus = 'PAID';
  const res = fakeRes();
  await indiaSession(fakeReq({ query: { order_id: orderId } }), res, deps);
  assert.equal(res._json.paymentStatus, 'paid');
  assert.equal(res._json.studdyEmail, 'group@x.org');
  assert.equal(res._json.studdyPassword, 'pw-123');
  assert.equal(res._json.amount, '₹14,999');
  assert.equal(res._json.accessPending, false);
  assert.equal(await seatCount(), before + 1);

  /* The webhook arriving afterwards must not take a second seat. */
  await sendWebhook(successEvent(orderId));
  assert.equal(await seatCount(), before + 1);
});

test('dashboard check and webhook racing each other still assign exactly one seat', async () => {
  const orderId = await makeOrder();
  const before = await seatCount();
  cfOrderStatus = 'PAID';
  await Promise.all([
    sendWebhook(successEvent(orderId)),
    indiaSession(fakeReq({ query: { order_id: orderId } }), fakeRes(), deps),
    indiaSession(fakeReq({ query: { order_id: orderId } }), fakeRes(), deps),
  ]);
  /* Whoever lost the claim may still be "pending"; one more check settles it. */
  const res = fakeRes();
  await indiaSession(fakeReq({ query: { order_id: orderId } }), res, deps);
  assert.equal(res._json.paymentStatus, 'paid');
  assert.equal(await seatCount(), before + 1);
});

test('refunded order shows Refunded and never the login', async () => {
  const orderId = await makeOrder();
  await sendWebhook(successEvent(orderId));
  await pool.query(`UPDATE india_orders SET status='refunded', refunded_at=now() WHERE order_id=$1`, [orderId]);
  const res = fakeRes();
  await indiaSession(fakeReq({ query: { order_id: orderId } }), res, deps);
  assert.equal(res._json.status, 'Refunded');
  assert.equal(res._json.studdyEmail, '');
  assert.equal(res._json.studdyPassword, '');
});

/**
 * Cashfree Payment Gateway — minimal server-side client (REST, API version
 * 2023-08-01). No SDK dependency: three calls are all we use.
 *
 * Env (set in Vercel, never in code):
 *   CASHFREE_APP_ID      — x-client-id
 *   CASHFREE_SECRET_KEY  — x-client-secret (also the webhook signing key)
 *   CASHFREE_ENV         — 'sandbox' (test) or 'production' (live). Anything
 *                          other than exactly 'production' is treated as
 *                          sandbox, so a typo can never charge real money.
 */
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

export const CASHFREE_API_VERSION = '2023-08-01';

/* Authoritative India prices — the browser only says WHICH plan; the
 * amount always comes from here, so nobody can change the price by
 * editing the page. Keep in sync with src/data/india.ts (display only). */
export const INDIA_PLANS = {
  quarterly: { amount: 7999, months: 3, label: 'Quarterly (3 months)' },
  yearly: { amount: 14999, months: 12, label: 'Yearly (12 months)' },
};

export function cashfreeConfig() {
  const appId = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  const env = process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox';
  if (!appId || !secret) {
    throw new Error('Cashfree is not configured: missing CASHFREE_APP_ID or CASHFREE_SECRET_KEY');
  }
  const baseUrl = env === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
  return { appId, secret, env, baseUrl };
}

function headers(cfg) {
  return {
    'Content-Type': 'application/json',
    'x-client-id': cfg.appId,
    'x-client-secret': cfg.secret,
    'x-api-version': CASHFREE_API_VERSION,
  };
}

/** Long, random, URL-safe order id. It doubles as the customer's private
 *  dashboard link, so it must not be guessable. Cashfree allows 3–45
 *  chars of letters, digits, '-' and '_'. */
export function newOrderId() {
  return `SLIN_${randomBytes(15).toString('hex')}`; // 5 + 30 = 35 chars
}

export async function createCashfreeOrder(cfg, body, fetchImpl = fetch) {
  const res = await fetchImpl(`${cfg.baseUrl}/orders`, {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Cashfree create order failed (${res.status}): ${data?.message || 'unknown error'}`);
    err.status = res.status;
    err.cashfree = data;
    throw err;
  }
  return data;
}

export async function getCashfreeOrder(cfg, orderId, fetchImpl = fetch) {
  const res = await fetchImpl(`${cfg.baseUrl}/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: headers(cfg),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Cashfree get order failed (${res.status}): ${data?.message || 'unknown error'}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Cashfree webhook signature: base64(HMAC-SHA256(timestamp + rawBody, secret)).
 *  Constant-time comparison; returns false (never throws) on any mismatch. */
export function verifyWebhookSignature({ rawBody, timestamp, signature, secret }) {
  if (!rawBody || !timestamp || !signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(String(timestamp) + rawBody.toString('utf8')).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Indian mobile number → 10 digits, or null if it isn't one. Accepts
 *  "+91 98765 43210", "09876543210", "9876543210". */
export function normalizeIndianPhone(input) {
  if (typeof input !== 'string') return null;
  let d = input.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

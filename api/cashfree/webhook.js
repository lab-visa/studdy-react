/**
 * POST /api/cashfree/webhook
 *
 * Cashfree calls this (notify_url, set per order) when a payment succeeds
 * or fails. Every request is verified against Cashfree's signature
 * (HMAC-SHA256 with our secret key) on the exact raw body, so only
 * Cashfree can mark an order paid.
 *
 * Always answers 200 for a verified event we've handled (or deliberately
 * ignore), so Cashfree doesn't retry forever; answers 500 on an unexpected
 * database error so Cashfree DOES retry. Fulfilment is idempotent.
 */
import { getSupabase } from '../_lib/supabase.js';
import { cashfreeConfig, verifyWebhookSignature } from '../_lib/cashfree.js';
import { markOrderPaid, markOrderFailed, assignSeatIfNeeded, loadOrder } from '../_lib/india-fulfilment.js';

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let cfg;
  try {
    cfg = (deps.cashfreeConfig || cashfreeConfig)();
  } catch (err) {
    console.error('cashfree webhook:', err.message);
    return res.status(500).json({ error: 'not configured' });
  }

  const rawBody = deps.rawBody ?? (await readRawBody(req));
  const ok = verifyWebhookSignature({
    rawBody,
    timestamp: req.headers['x-webhook-timestamp'],
    signature: req.headers['x-webhook-signature'],
    secret: cfg.secret,
  });
  if (!ok) {
    console.error('cashfree webhook: signature verification failed');
    return res.status(401).json({ error: 'invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'invalid body' });
  }

  const type = event?.type;
  const orderId = event?.data?.order?.order_id;
  const payment = event?.data?.payment || {};
  if (!orderId) return res.status(200).json({ received: true, ignored: 'no order id' });

  const supabase = (deps.getSupabase || getSupabase)();
  try {
    const order = await loadOrder(supabase, orderId);
    if (!order) return res.status(200).json({ received: true, ignored: 'unknown order' });

    if (type === 'PAYMENT_SUCCESS_WEBHOOK' && payment.payment_status === 'SUCCESS') {
      /* Amount check: never accept a payment smaller than the order. */
      if (Number(event?.data?.order?.order_amount) < Number(order.amount)) {
        console.error(`cashfree webhook: amount mismatch on ${orderId}`);
        return res.status(200).json({ received: true, ignored: 'amount mismatch' });
      }
      await markOrderPaid(supabase, orderId, {
        cfPaymentId: payment.cf_payment_id ? String(payment.cf_payment_id) : null,
        paymentMethod: payment.payment_group || null,
        paidAt: payment.payment_time || null,
      });
      await assignSeatIfNeeded(supabase, orderId);
    } else if (type === 'PAYMENT_FAILED_WEBHOOK' || type === 'PAYMENT_USER_DROPPED_WEBHOOK') {
      await markOrderFailed(supabase, orderId);
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('cashfree webhook error:', err);
    return res.status(500).json({ error: 'processing failed' });
  }
}

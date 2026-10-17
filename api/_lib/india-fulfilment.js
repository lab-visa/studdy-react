/**
 * India order fulfilment - the ONE place that turns a Cashfree-confirmed
 * payment into: status 'paid', access dates, and an assigned Studdy seat.
 *
 * Called from both the Cashfree webhook and the dashboard's status check
 * (whichever gets there first). Safe to call any number of times, and
 * concurrently:
 *   - 'paid' is only ever set from a Cashfree response we fetched or a
 *     signature-verified webhook - never from the browser.
 *   - The seat is claimed by whoever wins a conditional UPDATE on
 *     fulfilment_claimed_at; the other caller sees "pending" and its
 *     dashboard retries a few seconds later. A claim older than
 *     CLAIM_STALE_MS (caller crashed mid-way) can be re-claimed.
 */
import { assignStuddyAccount } from './sync-checkout-session.js';

const CLAIM_STALE_MS = 2 * 60 * 1000;

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function loadOrder(supabase, orderId) {
  const { data, error } = await supabase.from('india_orders').select('*').eq('order_id', orderId).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Everything useful Cashfree sends about a payment, flattened for the admin
 * (amount, UTR, method detail, message) plus the raw verified payload.
 */
export function paymentFieldsFromWebhook(event) {
  const pay = event?.data?.payment || {};
  const m = pay.payment_method || {};
  let detail = null;
  if (m.upi) detail = ['UPI', m.upi.upi_id].filter(Boolean).join(' · ');
  else if (m.card) detail = ['Card', [m.card.card_network, m.card.card_number ? `••••${String(m.card.card_number).slice(-4)}` : null].filter(Boolean).join(' '), m.card.card_bank_name, m.card.card_type].filter(Boolean).join(' · ');
  else if (m.netbanking) detail = ['Netbanking', m.netbanking.netbanking_bank_name].filter(Boolean).join(' · ');
  else if (m.app) detail = ['Wallet', m.app.provider].filter(Boolean).join(' · ');
  else if (m.cardless_emi || m.emi) detail = 'EMI';
  else if (m.pay_later || m.paylater) detail = 'Pay later';
  return {
    cfPaymentId: pay.cf_payment_id ? String(pay.cf_payment_id) : null,
    paymentMethod: pay.payment_group || null,
    paidAt: pay.payment_time || null,
    amount: pay.payment_amount != null ? Number(pay.payment_amount) : null,
    currency: pay.payment_currency || null,
    bankReference: pay.bank_reference ? String(pay.bank_reference).slice(0, 80) : null,
    detail: detail ? detail.slice(0, 160) : null,
    message: pay.payment_message ? String(pay.payment_message).slice(0, 300) : null,
    raw: event || null,
  };
}

/**
 * Record a confirmed payment (idempotent). `payment` = { cfPaymentId,
 * paymentMethod, paidAt, amount, currency, bankReference, detail, message,
 * raw } - all optional. Returns the fresh row.
 */
export async function markOrderPaid(supabase, orderId, payment = {}) {
  const order = await loadOrder(supabase, orderId);
  if (!order) return null;
  if (order.status === 'paid' || order.status === 'refunded') {
    /* Already paid (e.g. the dashboard confirmed it first): still keep the
       richer webhook details if we didn't have them yet. */
    if (payment.raw && !order.cf_payment_raw) {
      await supabase.from('india_orders').update(paymentColumns(payment, order)).eq('order_id', orderId);
      return loadOrder(supabase, orderId);
    }
    return order;
  }

  const paidAt = payment.paidAt ? new Date(payment.paidAt) : new Date();
  const { error } = await supabase
    .from('india_orders')
    .update({
      status: 'paid',
      paid_at: paidAt.toISOString(),
      access_start: paidAt.toISOString(),
      access_end: addMonths(paidAt, order.months).toISOString(),
      ...paymentColumns(payment, order),
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .in('status', ['created', 'failed']); // a failed attempt can be followed by a successful one
  if (error) throw error;
  return loadOrder(supabase, orderId);
}

function paymentColumns(payment, order) {
  return {
    cf_payment_id: payment.cfPaymentId || order.cf_payment_id || null,
    payment_method: payment.paymentMethod || order.payment_method || null,
    cf_payment_amount: payment.amount ?? order.cf_payment_amount ?? null,
    cf_payment_currency: payment.currency || order.cf_payment_currency || null,
    bank_reference: payment.bankReference || order.bank_reference || null,
    payment_detail: payment.detail || order.payment_detail || null,
    payment_message: payment.message || order.payment_message || null,
    cf_payment_raw: payment.raw || order.cf_payment_raw || null,
  };
}

/** A failed / abandoned attempt: count it and keep Cashfree's reason. Never downgrades a paid order. */
export async function markOrderFailed(supabase, orderId, payment = {}) {
  const order = await loadOrder(supabase, orderId);
  if (!order || order.status === 'paid' || order.status === 'refunded') return;
  const { error } = await supabase
    .from('india_orders')
    .update({
      status: 'failed',
      failed_attempts: (order.failed_attempts || 0) + 1,
      payment_message: payment.message || order.payment_message || null,
      payment_detail: payment.detail || order.payment_detail || null,
      cf_payment_raw: payment.raw || order.cf_payment_raw || null,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .in('status', ['created', 'failed']);
  if (error) throw error;
}

/** Give a seat back to its Studdy login (compare-and-swap, never below 0). */
export async function releaseSeat(supabase, groupName) {
  for (let i = 0; i < 5; i++) {
    const { data: acc, error } = await supabase.from('studdy_accounts').select('id, active_customer_count').eq('group_name', groupName).maybeSingle();
    if (error) throw error;
    if (!acc) return false;
    const n = acc.active_customer_count ?? 0;
    if (n <= 0) return true;
    const { data: done, error: uErr } = await supabase.from('studdy_accounts')
      .update({ active_customer_count: n - 1 }).eq('id', acc.id).eq('active_customer_count', n).select().maybeSingle();
    if (uErr) throw uErr;
    if (done) return true;
  }
  throw new Error(`releaseSeat: could not update ${groupName} after retries`);
}

/**
 * Assign a Studdy seat to a PAID order that doesn't have one yet.
 * Returns the order row (with group_name if a seat was assigned).
 */
export async function assignSeatIfNeeded(supabase, orderId) {
  let order = await loadOrder(supabase, orderId);
  /* A seat the admin released (refund / test / expiry) is never re-assigned automatically. */
  if (!order || order.status !== 'paid' || order.group_name || order.seat_released_at) return order;

  const now = new Date();
  /* Claim the right to assign: first-time claim, or a stale one. */
  let { data: claimed, error } = await supabase
    .from('india_orders')
    .update({ fulfilment_claimed_at: now.toISOString() })
    .eq('order_id', orderId)
    .is('group_name', null)
    .is('fulfilment_claimed_at', null)
    .select()
    .maybeSingle();
  if (error) throw error;

  if (!claimed) {
    const staleBefore = new Date(now.getTime() - CLAIM_STALE_MS).toISOString();
    ({ data: claimed, error } = await supabase
      .from('india_orders')
      .update({ fulfilment_claimed_at: now.toISOString() })
      .eq('order_id', orderId)
      .is('group_name', null)
      .lt('fulfilment_claimed_at', staleBefore)
      .select()
      .maybeSingle());
    if (error) throw error;
  }
  if (!claimed) return loadOrder(supabase, orderId); // someone else is assigning right now

  const account = await assignStuddyAccount(supabase);
  if (!account) {
    console.error(`india order ${orderId}: paid but no free Studdy seat - add a studdy_accounts row or raise max_capacity.`);
    /* Release the claim so a later retry (after capacity is added) can assign. */
    await supabase.from('india_orders').update({ fulfilment_claimed_at: null }).eq('order_id', orderId);
    return loadOrder(supabase, orderId);
  }

  const { error: upErr } = await supabase
    .from('india_orders')
    .update({ group_name: account.group_name, updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .is('group_name', null);
  if (upErr) throw upErr;
  return loadOrder(supabase, orderId);
}

/** Map a Cashfree order (GET /orders/{id}) or webhook payment onto our row. */
export async function syncFromCashfreeOrder(supabase, orderId, cfOrder) {
  if (cfOrder?.order_status === 'PAID') {
    await markOrderPaid(supabase, orderId, {});
    return assignSeatIfNeeded(supabase, orderId);
  }
  return loadOrder(supabase, orderId);
}

/**
 * India order fulfilment — the ONE place that turns a Cashfree-confirmed
 * payment into: status 'paid', access dates, and an assigned Studdy seat.
 *
 * Called from both the Cashfree webhook and the dashboard's status check
 * (whichever gets there first). Safe to call any number of times, and
 * concurrently:
 *   - 'paid' is only ever set from a Cashfree response we fetched or a
 *     signature-verified webhook — never from the browser.
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
 * Record a confirmed payment (idempotent). `payment` = { cfPaymentId,
 * paymentMethod, paidAt } — all optional. Returns the fresh row.
 */
export async function markOrderPaid(supabase, orderId, payment = {}) {
  const order = await loadOrder(supabase, orderId);
  if (!order) return null;
  if (order.status === 'paid' || order.status === 'refunded') return order;

  const paidAt = payment.paidAt ? new Date(payment.paidAt) : new Date();
  const { error } = await supabase
    .from('india_orders')
    .update({
      status: 'paid',
      paid_at: paidAt.toISOString(),
      access_start: paidAt.toISOString(),
      access_end: addMonths(paidAt, order.months).toISOString(),
      cf_payment_id: payment.cfPaymentId || order.cf_payment_id || null,
      payment_method: payment.paymentMethod || order.payment_method || null,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .in('status', ['created', 'failed']); // a failed attempt can be followed by a successful one
  if (error) throw error;
  return loadOrder(supabase, orderId);
}

export async function markOrderFailed(supabase, orderId) {
  const { error } = await supabase
    .from('india_orders')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('status', 'created');
  if (error) throw error;
}

/**
 * Assign a Studdy seat to a PAID order that doesn't have one yet.
 * Returns the order row (with group_name if a seat was assigned).
 */
export async function assignSeatIfNeeded(supabase, orderId) {
  let order = await loadOrder(supabase, orderId);
  if (!order || order.status !== 'paid' || order.group_name) return order;

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
    console.error(`india order ${orderId}: paid but no free Studdy seat — add a studdy_accounts row or raise max_capacity.`);
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

/**
 * GET /api/india-session?order_id=SLIN_...
 *
 * Data for an India customer's dashboard (the return_url Cashfree sends
 * them to after paying). The long random order_id is the private link —
 * same design as the Stripe session_id dashboard link.
 *
 * If our row isn't 'paid' yet (webhook still on its way), this asks
 * Cashfree directly and fulfils the order if Cashfree says PAID — so the
 * customer gets their login within seconds either way. Studdy login
 * details are only ever returned for a paid order with an assigned seat.
 */
import { getSupabase } from './_lib/supabase.js';
import { cashfreeConfig, getCashfreeOrder, INDIA_PLANS } from './_lib/cashfree.js';
import { loadOrder, syncFromCashfreeOrder, assignSeatIfNeeded } from './_lib/india-fulfilment.js';
import { fmtDate } from './_lib/status.js';

const ORDER_ID_RE = /^SLIN_[a-f0-9]{30}$/;
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export default async function handler(req, res, deps = {}) {
  const orderId = req.query?.order_id;
  if (typeof orderId !== 'string' || !ORDER_ID_RE.test(orderId)) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.setHeader('Cache-Control', 'private, no-store');

  const supabase = (deps.getSupabase || getSupabase)();
  try {
    let order = await loadOrder(supabase, orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status !== 'paid' && order.status !== 'refunded') {
      try {
        const cfg = (deps.cashfreeConfig || cashfreeConfig)();
        const cf = await getCashfreeOrder(cfg, orderId, deps.fetch);
        order = await syncFromCashfreeOrder(supabase, orderId, cf);
      } catch (err) {
        console.error('india-session: Cashfree status check failed', err.message);
      }
    } else if (order.status === 'paid' && !order.group_name) {
      order = await assignSeatIfNeeded(supabase, orderId);
    }

    if (order.status !== 'paid' && order.status !== 'refunded') {
      return res.status(200).json({
        market: 'in',
        paymentStatus: order.status === 'failed' ? 'failed' : 'pending',
        name: order.customer_name || '',
        plan: INDIA_PLANS[order.plan]?.label || order.plan,
        amount: inr(order.amount),
      });
    }

    let studdyEmail = '';
    let studdyPassword = '';
    let studdyUrl = 'https://studdyai.com';
    if (order.status === 'paid' && order.group_name) {
      const { data: group } = await supabase
        .from('studdy_accounts')
        .select('studdy_email, studdy_password, studdy_url')
        .eq('group_name', order.group_name)
        .maybeSingle();
      if (group) {
        studdyEmail = group.studdy_email || '';
        studdyPassword = group.studdy_password || '';
        studdyUrl = group.studdy_url || studdyUrl;
      }
    }

    return res.status(200).json({
      market: 'in',
      paymentStatus: 'paid',
      name: order.customer_name || '',
      email: order.customer_email || '',
      plan: INDIA_PLANS[order.plan]?.label || order.plan,
      status: order.status === 'refunded' ? 'Refunded' : 'Active',
      amount: inr(order.amount),
      paidOn: fmtDate(order.paid_at),
      accessUntil: fmtDate(order.access_end),
      nextBilling: '',
      trialEnds: '',
      daysLeftInTrial: null,
      studdyEmail,
      studdyPassword,
      studdyUrl,
      totalMonthsPaid: 0,
      latestInvoiceUrl: null,
      cancelRequestedAt: null,
      accessPending: order.status === 'paid' && (!studdyEmail || !studdyPassword),
    });
  } catch (err) {
    console.error('india-session error:', err);
    return res.status(500).json({ error: 'Could not load your dashboard. Please try again or message us on WhatsApp.' });
  }
}

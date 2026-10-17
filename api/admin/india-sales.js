/**
 * /api/admin/india-sales   (admin only)
 *
 * GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD&state=<see below>&partner=all|direct|<CODE>&q=<search>
 *      Dates are India days, on payment date (or created date if unpaid).
 *
 *      Every order gets ONE customer state:
 *        active      paid, has a Studdy login, access not over
 *        waiting     paid, no free seat yet (gets one automatically)
 *        expiring    active, access ends within 7 days (renewal reminder)
 *        expired     paid, access end date passed
 *        released    paid, admin released the seat
 *        refunded
 *        abandoned   opened checkout, didn't pay within 1 hour, and the same
 *                    mobile number did NOT pay later  → follow up
 *        checkout    opened checkout less than 1 hour ago (may still pay)
 *        retried     unpaid attempt, but the same number paid afterwards -
 *                    hidden by default and shown as "earlier attempts" on
 *                    the paid order
 *        test        admin marked it a test order (out of every total)
 *      state=all (default) shows everything except retried and test.
 *
 * POST { orderId, action: 'refund' | 'release_seat' | 'mark_test', note? }
 *      refund       → status refunded (commission 0) + seat freed. This only
 *                     updates records; refund the money in Cashfree first.
 *      release_seat → frees the seat only; the order stays paid.
 *      mark_test    → status test: out of sales, commission, payouts, seats.
 */
import { getSupabase } from '../_lib/supabase.js';
import { requireAdminSession, isSameOriginRequest } from '../_lib/admin-auth.js';
import { releaseSeat, loadOrder } from '../_lib/india-fulfilment.js';
import { COMMISSION } from '../_lib/partners.js';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HOUR = 3600 * 1000;
const istDay = (d) => new Date(new Date(d).getTime() + 5.5 * HOUR).toISOString().slice(0, 10);
const PAID = (o) => o.status === 'paid' || o.status === 'refunded';
export const STATES = ['active', 'waiting', 'expiring', 'expired', 'released', 'refunded', 'abandoned', 'checkout', 'retried', 'test'];

/** Works out each order's state; links unpaid attempts to a later payment by the same number. */
export function classify(orders, now = new Date()) {
  const t = now.getTime();
  const paidByPhone = new Map();
  for (const o of orders) {
    if (!PAID(o) || !o.customer_phone) continue;
    (paidByPhone.get(o.customer_phone) || paidByPhone.set(o.customer_phone, []).get(o.customer_phone)).push(o);
  }
  for (const list of paidByPhone.values()) list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const earlier = new Map(); // paid order_id → unpaid attempts before it
  const out = new Map();
  for (const o of orders) {
    let state;
    if (o.status === 'test') state = 'test';
    else if (o.status === 'refunded') state = 'refunded';
    else if (o.status === 'paid') {
      const end = o.access_end ? new Date(o.access_end).getTime() : null;
      if (o.seat_released_at) state = 'released';
      else if (end && end <= t) state = 'expired';
      else if (!o.group_name) state = 'waiting';
      else if (end && end - t <= 7 * 24 * HOUR) state = 'expiring';
      else state = 'active';
    } else {
      const later = (paidByPhone.get(o.customer_phone) || []).find((p) => new Date(p.created_at) >= new Date(o.created_at));
      if (later) {
        state = 'retried';
        earlier.set(later.order_id, (earlier.get(later.order_id) || 0) + 1);
      } else state = t - new Date(o.created_at).getTime() > HOUR ? 'abandoned' : 'checkout';
    }
    out.set(o.order_id, state);
  }

  /* Same number paid twice within 24 hours → possibly a double payment. */
  const doubles = new Set();
  for (const list of paidByPhone.values()) {
    const live = list.filter((o) => o.status === 'paid');
    for (let i = 1; i < live.length; i++) {
      if (new Date(live[i].paid_at || live[i].created_at) - new Date(live[i - 1].paid_at || live[i - 1].created_at) < 24 * HOUR) {
        doubles.add(live[i].order_id); doubles.add(live[i - 1].order_id);
      }
    }
  }
  return { state: out, earlier, doubles };
}

export default async function handler(req, res, deps = {}) {
  const supabase = (deps.getSupabase || getSupabase)();
  if (req.method !== 'GET' && !isSameOriginRequest(req)) return res.status(403).json({ error: 'Forbidden' });
  const admin = await requireAdminSession(req, res, supabase);
  if (!admin) return;
  res.setHeader('Cache-Control', 'private, no-store');
  const now = deps.now || new Date();

  try {
    if (req.method === 'GET') {
      const q = req.query || {};
      const today = istDay(now);
      const from = DAY_RE.test(q.from || '') ? q.from : today;
      const to = DAY_RE.test(q.to || '') ? q.to : today;
      /* From a little before the range up to now: a payment AFTER the range
         end must still be able to link an unpaid attempt inside it. */
      const lower = new Date(new Date(`${from}T00:00:00+05:30`).getTime() - 3 * 86400000).toISOString();
      const { data: orders, error } = await supabase.from('india_orders').select('*')
        .gte('created_at', lower).order('created_at', { ascending: false });
      if (error) throw error;
      const { data: partners, error: pErr } = await supabase.from('partners').select('code, name, phone, status');
      if (pErr) throw pErr;
      const byCode = new Map((partners || []).filter((p) => p.code).map((p) => [p.code, p]));

      const { state, earlier, doubles } = classify(orders || [], now);
      const inRange = (orders || []).filter((o) => { const d = istDay(o.paid_at || o.created_at); return d >= from && d <= to; });
      const counts = Object.fromEntries(STATES.map((s) => [s, inRange.filter((o) => state.get(o.order_id) === s).length]));

      const wanted = STATES.includes(q.state) ? q.state : 'all';
      const needle = String(q.q || '').trim().toLowerCase();
      const rows = inRange
        .filter((o) => (wanted === 'all' ? !['retried', 'test'].includes(state.get(o.order_id)) : state.get(o.order_id) === wanted))
        .filter((o) => !q.partner || q.partner === 'all' || (q.partner === 'direct' ? !o.ref_code : o.ref_code === q.partner))
        .filter((o) => !needle || [o.customer_name, o.customer_phone, o.customer_email, o.order_id, o.ref_code, o.bank_reference]
          .some((v) => String(v || '').toLowerCase().includes(needle)))
        .map((o) => {
          const p = o.ref_code ? byCode.get(o.ref_code) : null;
          return {
            orderId: o.order_id, state: state.get(o.order_id), status: o.status, plan: o.plan, amount: Number(o.amount),
            customer: { name: o.customer_name, phone: o.customer_phone, email: o.customer_email },
            partner: o.ref_code ? { code: o.ref_code, name: p?.name || '(unknown code)' } : null,
            commission: o.ref_code && o.status === 'paid' ? COMMISSION[o.plan] ?? 0 : 0,
            createdAt: o.created_at, paidAt: o.paid_at, accessEnd: o.access_end, seat: o.group_name, seatReleasedAt: o.seat_released_at,
            earlierAttempts: earlier.get(o.order_id) || 0, possibleDouble: doubles.has(o.order_id),
            cashfree: {
              cfOrderId: o.cf_order_id, cfPaymentId: o.cf_payment_id, paidAmount: o.cf_payment_amount != null ? Number(o.cf_payment_amount) : null,
              currency: o.cf_payment_currency, method: o.payment_method, detail: o.payment_detail, bankReference: o.bank_reference,
              message: o.payment_message, failedAttempts: o.failed_attempts || 0,
            },
            campaign: o.campaign_code, leadId: o.lead_id, refundedAt: o.refunded_at, note: o.refund_note, markedTestAt: o.marked_test_at,
          };
        });

      /* Totals for the date range (never narrowed by search/state; tests excluded). */
      const paid = inRange.filter((o) => o.status === 'paid');
      const refunded = inRange.filter((o) => o.status === 'refunded');
      const sum = (a) => a.reduce((s, o) => s + Number(o.amount), 0);
      const partnerMap = new Map();
      for (const o of paid) {
        const key = o.ref_code || 'direct';
        const e = partnerMap.get(key) || { code: o.ref_code || null, name: o.ref_code ? byCode.get(o.ref_code)?.name || '(unknown code)' : 'Direct (no partner)', sales: 0, revenue: 0, commission: 0 };
        e.sales += 1; e.revenue += Number(o.amount); e.commission += o.ref_code ? COMMISSION[o.plan] ?? 0 : 0;
        partnerMap.set(key, e);
      }
      return res.status(200).json({
        from, to, counts,
        totals: {
          sales: paid.length, revenue: sum(paid),
          yearly: paid.filter((o) => o.plan === 'yearly').length, quarterly: paid.filter((o) => o.plan === 'quarterly').length,
          viaPartners: paid.filter((o) => o.ref_code).length, direct: paid.filter((o) => !o.ref_code).length,
          refunded: refunded.length, refundedAmount: sum(refunded),
          abandoned: counts.abandoned, waitingForSeat: counts.waiting,
          possibleDoubles: inRange.filter((o) => doubles.has(o.order_id)).length,
        },
        byPartner: [...partnerMap.values()].sort((a, b) => b.sales - a.sales),
        partners: (partners || []).filter((p) => p.code).map((p) => ({ code: p.code, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)),
        rows,
      });
    }

    if (req.method === 'POST') {
      const { orderId, action, note } = req.body || {};
      const o = await loadOrder(supabase, String(orderId || ''));
      if (!o) return res.status(404).json({ error: 'Order not found' });
      const ts = new Date().toISOString();
      const cleanNote = String(note || '').trim().slice(0, 300) || null;
      const freeSeat = async () => {
        if (o.group_name) await releaseSeat(supabase, o.group_name);
        return { group_name: null, seat_released_at: o.group_name ? ts : o.seat_released_at, fulfilment_claimed_at: null };
      };

      if (action === 'refund') {
        if (o.status !== 'paid') return res.status(400).json({ error: 'Only a paid order can be marked refunded.' });
        const { error } = await supabase.from('india_orders').update({
          status: 'refunded', refunded_at: ts, refund_note: cleanNote, ...(await freeSeat()), updated_at: ts,
        }).eq('order_id', o.order_id).eq('status', 'paid');
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      if (action === 'release_seat') {
        if (!o.group_name) return res.status(400).json({ error: 'This order is not holding a seat.' });
        const { error } = await supabase.from('india_orders').update({ ...(await freeSeat()), updated_at: ts }).eq('order_id', o.order_id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      if (action === 'mark_test') {
        if (o.status === 'test') return res.status(400).json({ error: 'Already a test order.' });
        const { error } = await supabase.from('india_orders').update({
          status: 'test', marked_test_at: ts, refund_note: cleanNote || o.refund_note, ...(await freeSeat()), updated_at: ts,
        }).eq('order_id', o.order_id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin/india-sales error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

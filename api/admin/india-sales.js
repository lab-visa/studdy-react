/**
 * /api/admin/india-sales   (admin only)
 *
 * GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=all|paid|refunded|pending|failed
 *      &partner=all|direct|<CODE>&q=<search>
 *      Dates are India days, on payment date (or created date if unpaid).
 *      → totals, per-partner breakdown, and every order with all the
 *        Cashfree details we hold (amount, UTR, method, message, seat).
 * POST { orderId, action: 'refund' | 'release_seat', note? }
 *      refund       → status refunded (commission drops to 0) + seat freed.
 *                     Do the actual money refund in Cashfree first.
 *      release_seat → frees the Studdy seat only; the order stays paid
 *                     (used for test orders and expired access).
 */
import { getSupabase } from '../_lib/supabase.js';
import { requireAdminSession, isSameOriginRequest } from '../_lib/admin-auth.js';
import { releaseSeat, loadOrder } from '../_lib/india-fulfilment.js';
import { COMMISSION } from '../_lib/partners.js';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const istDay = (d) => new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const statusOf = (o) => (o.status === 'created' ? 'pending' : o.status);

export default async function handler(req, res, deps = {}) {
  const supabase = (deps.getSupabase || getSupabase)();
  if (req.method !== 'GET' && !isSameOriginRequest(req)) return res.status(403).json({ error: 'Forbidden' });
  const admin = await requireAdminSession(req, res, supabase);
  if (!admin) return;
  res.setHeader('Cache-Control', 'private, no-store');

  try {
    if (req.method === 'GET') {
      const q = req.query || {};
      const today = istDay(deps.now || new Date());
      const from = DAY_RE.test(q.from || '') ? q.from : today;
      const to = DAY_RE.test(q.to || '') ? q.to : today;
      /* Fetch a little wider on created_at, then filter exactly on the India day. */
      const lower = new Date(new Date(`${from}T00:00:00+05:30`).getTime() - 3 * 86400000).toISOString();
      const upper = new Date(new Date(`${to}T23:59:59.999+05:30`).getTime() + 86400000).toISOString();
      const { data: orders, error } = await supabase.from('india_orders').select('*')
        .gte('created_at', lower).lte('created_at', upper).order('created_at', { ascending: false });
      if (error) throw error;
      const { data: partners, error: pErr } = await supabase.from('partners').select('code, name, phone, status');
      if (pErr) throw pErr;
      const byCode = new Map((partners || []).filter((p) => p.code).map((p) => [p.code, p]));

      const inRange = (orders || []).filter((o) => { const d = istDay(o.paid_at || o.created_at); return d >= from && d <= to; });
      const needle = String(q.q || '').trim().toLowerCase();
      const rows = inRange
        .filter((o) => !q.status || q.status === 'all' || statusOf(o) === q.status)
        .filter((o) => !q.partner || q.partner === 'all' || (q.partner === 'direct' ? !o.ref_code : o.ref_code === q.partner))
        .filter((o) => !needle || [o.customer_name, o.customer_phone, o.customer_email, o.order_id, o.ref_code, o.bank_reference]
          .some((v) => String(v || '').toLowerCase().includes(needle)))
        .map((o) => {
          const p = o.ref_code ? byCode.get(o.ref_code) : null;
          return {
            orderId: o.order_id, status: statusOf(o), plan: o.plan, amount: Number(o.amount),
            customer: { name: o.customer_name, phone: o.customer_phone, email: o.customer_email },
            partner: o.ref_code ? { code: o.ref_code, name: p?.name || '(unknown code)' } : null,
            commission: o.ref_code && o.status === 'paid' ? COMMISSION[o.plan] ?? 0 : 0,
            createdAt: o.created_at, paidAt: o.paid_at, accessEnd: o.access_end,
            seat: o.group_name, seatReleasedAt: o.seat_released_at,
            cashfree: {
              cfOrderId: o.cf_order_id, cfPaymentId: o.cf_payment_id, paidAmount: o.cf_payment_amount != null ? Number(o.cf_payment_amount) : null,
              currency: o.cf_payment_currency, method: o.payment_method, detail: o.payment_detail, bankReference: o.bank_reference,
              message: o.payment_message, failedAttempts: o.failed_attempts || 0,
            },
            campaign: o.campaign_code, leadId: o.lead_id,
            refundedAt: o.refunded_at, refundNote: o.refund_note,
            waitingForSeat: o.status === 'paid' && !o.group_name && !o.seat_released_at,
          };
        });

      /* Totals are for the date range only (not narrowed by search/status). */
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
        from, to,
        totals: {
          sales: paid.length, revenue: sum(paid),
          yearly: paid.filter((o) => o.plan === 'yearly').length, quarterly: paid.filter((o) => o.plan === 'quarterly').length,
          viaPartners: paid.filter((o) => o.ref_code).length, direct: paid.filter((o) => !o.ref_code).length,
          refunded: refunded.length, refundedAmount: sum(refunded),
          pending: inRange.filter((o) => o.status === 'created').length, failed: inRange.filter((o) => o.status === 'failed').length,
          waitingForSeat: paid.filter((o) => !o.group_name && !o.seat_released_at).length,
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
      const now = new Date().toISOString();
      const freeSeat = async () => {
        if (o.group_name) await releaseSeat(supabase, o.group_name);
        return { group_name: null, seat_released_at: now, fulfilment_claimed_at: null };
      };

      if (action === 'refund') {
        if (o.status !== 'paid') return res.status(400).json({ error: 'Only a paid order can be marked refunded.' });
        const { error } = await supabase.from('india_orders').update({
          status: 'refunded', refunded_at: now, refund_note: String(note || '').trim().slice(0, 300) || null,
          ...(await freeSeat()), updated_at: now,
        }).eq('order_id', o.order_id).eq('status', 'paid');
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      if (action === 'release_seat') {
        if (!o.group_name) return res.status(400).json({ error: 'This order is not holding a seat.' });
        const { error } = await supabase.from('india_orders').update({ ...(await freeSeat()), updated_at: now }).eq('order_id', o.order_id);
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

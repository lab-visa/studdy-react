/**
 * /api/admin/partner-payouts   (admin only)
 *
 * GET  ?month=YYYY-MM (default: last month)
 *      → one row per partner who earned in that sales month: sales,
 *        commission, bonus, gross, TDS, net, full bank details (to pay),
 *        whether details are complete/checked, and the payout if already paid.
 * POST { partnerId, month, utr, paidOn }  → marks that month paid. The
 *      amounts are recomputed on the server and saved as a snapshot.
 * PUT  { tdsRate }                         → changes the TDS % (0–30).
 */
import { getSupabase } from '../_lib/supabase.js';
import { requireAdminSession, isSameOriginRequest } from '../_lib/admin-auth.js';
import { computeEarnings } from '../_lib/partners.js';
import { detailsComplete, getTdsRate, tdsFor, monthIsPayable, previousMonth } from '../_lib/partner-payouts.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

async function monthRows(supabase, month, now) {
  const { data: partners, error } = await supabase.from('partners').select('*').in('status', ['approved', 'paused']);
  if (error) throw error;
  const codes = (partners || []).map((p) => p.code).filter(Boolean);
  let orders = [];
  if (codes.length) {
    const { data, error: oErr } = await supabase.from('india_orders').select('*').in('ref_code', codes).in('status', ['paid', 'refunded']);
    if (oErr) throw oErr;
    orders = data || [];
  }
  const { data: paid, error: pErr } = await supabase.from('partner_payouts').select('*').eq('month', month);
  if (pErr) throw pErr;
  const rate = await getTdsRate(supabase);

  const rows = [];
  for (const p of partners || []) {
    const m = computeEarnings(orders.filter((o) => o.ref_code === p.code), now).months.find((x) => x.month === month);
    const payout = (paid || []).find((x) => x.partner_id === p.id) || null;
    if (!m?.total && !payout) continue;
    const gross = m?.total || 0;
    const tds = tdsFor(gross, rate);
    rows.push({
      partnerId: p.id, name: p.name, phone: p.phone, code: p.code, status: p.status,
      sales: m?.sales || 0, commission: m?.commission || 0, bonus: m?.bonus || 0, gross, tds, net: gross - tds,
      bank: { holder: p.bank_holder, account: p.bank_account, ifsc: p.bank_ifsc, bankName: p.bank_name, branch: p.bank_branch, upi: p.payout_upi, pan: p.pan },
      detailsComplete: detailsComplete(p),
      detailsChecked: Boolean(p.payout_details_checked_at), // cleared whenever bank/PAN/photo change
      payout,
    });
  }
  rows.sort((a, b) => b.gross - a.gross);
  return { rows, rate, partners, orders };
}

export default async function handler(req, res, deps = {}) {
  const supabase = (deps.getSupabase || getSupabase)();
  const now = deps.now || new Date();
  if (req.method !== 'GET' && !isSameOriginRequest(req)) return res.status(403).json({ error: 'Forbidden' });
  const admin = await requireAdminSession(req, res, supabase);
  if (!admin) return;

  try {
    if (req.method === 'GET') {
      const month = MONTH_RE.test(req.query?.month || '') ? req.query.month : previousMonth(now);
      const { rows, rate } = await monthRows(supabase, month, now);
      return res.status(200).json({ month, tdsRate: rate, payable: monthIsPayable(month, now), rows });
    }

    if (req.method === 'PUT') {
      const rate = Number(req.body?.tdsRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 30) return res.status(400).json({ error: 'TDS must be between 0 and 30%.' });
      const { error } = await supabase.from('settings').update({ value: rate, updated_at: new Date().toISOString() }).eq('key', 'partner_tds_rate');
      if (error) throw error;
      return res.status(200).json({ ok: true, tdsRate: rate });
    }

    if (req.method === 'POST') {
      const { partnerId, month, utr, paidOn } = req.body || {};
      if (!MONTH_RE.test(month || '')) return res.status(400).json({ error: 'Pick a month.' });
      const cleanUtr = String(utr || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{6,30}$/.test(cleanUtr)) return res.status(400).json({ error: 'Enter the bank reference (UTR), 6–30 letters/digits.' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn || '')) return res.status(400).json({ error: 'Enter the date you paid.' });
      if (!monthIsPayable(month, now)) return res.status(400).json({ error: 'Sales from this month are still inside the 7-day refund window.' });

      const { rows, rate } = await monthRows(supabase, month, now);
      const row = rows.find((r) => r.partnerId === partnerId);
      if (!row || row.gross <= 0) return res.status(400).json({ error: 'Nothing to pay this partner for that month.' });
      if (row.payout) return res.status(409).json({ error: 'Already marked paid for that month.' });
      if (!row.detailsComplete) return res.status(400).json({ error: 'Bank or KYC details (PAN, Aadhaar, photos) missing - hold this payout.' });

      const { data, error } = await supabase.from('partner_payouts').insert({
        partner_id: partnerId, month, sales: row.sales, commission: row.commission, bonus: row.bonus,
        gross: row.gross, tds_rate: rate, tds: row.tds, net: row.net, utr: cleanUtr, paid_on: paidOn, paid_by: admin.display_name,
      }).select('*').single();
      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Already marked paid for that month.' });
        throw error;
      }
      return res.status(200).json({ ok: true, payout: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin/partner-payouts error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

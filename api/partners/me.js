/**
 * /api/partners/me — a partner's private earnings page.
 *
 * GET  ?t=<dashboard_token>
 *      Earnings, sales (customer details masked), months with payout
 *      status (paid / TDS / net), bank details (account number masked),
 *      and whether a login PIN is set.
 *
 * POST { t, action: 'set_pin', pin }      — only when no PIN is set yet
 *                                           (new link, or reset by admin)
 * POST { t, action: 'bank', accountName, accountNumber,
 *        accountNumberConfirm, ifsc, bankName, upi?, pan }
 *      Saves payout details and alerts the owner (a bank change is the
 *      one thing worth double-checking before a payout).
 *
 * The long random token is the access key, same as the customer dashboard.
 */
import { getSupabase } from '../_lib/supabase.js';
import { generateSalt, deriveHash } from '../_lib/admin-auth.js';
import { notifyOwner } from '../_lib/notify.js';
import {
  computeEarnings, withPayouts, cleanBankDetails, maskAccount,
  COMMISSION, MONTHLY_BONUS, REFUND_WINDOW_DAYS, PAYOUT_DAY, PIN_RE,
} from '../_lib/partners.js';

const TOKEN_RE = /^[a-f0-9]{48}$/;

async function loadPartner(supabase, token) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const { data, error } = await supabase.from('partners').select('*').eq('dashboard_token', token).maybeSingle();
  if (error) throw error;
  if (!data || !data.code || (data.status !== 'approved' && data.status !== 'paused')) return null;
  return data;
}

export default async function handler(req, res, deps = {}) {
  res.setHeader('Cache-Control', 'private, no-store');
  const supabase = (deps.getSupabase || getSupabase)();

  try {
    if (req.method === 'POST') {
      const b = req.body || {};
      const partner = await loadPartner(supabase, b.t);
      if (!partner) return res.status(404).json({ error: 'Link not found' });

      if (b.action === 'set_pin') {
        if (partner.pin_hash) return res.status(409).json({ error: 'A PIN is already set. WhatsApp us if you forgot it.' });
        const pin = typeof b.pin === 'string' ? b.pin.trim() : '';
        if (!PIN_RE.test(pin)) return res.status(400).json({ error: 'PIN must be 6 digits.' });
        const salt = generateSalt();
        await supabase.from('partners')
          .update({ pin_salt: salt, pin_hash: deriveHash(pin, salt), pin_failed: 0, pin_locked_until: null, updated_at: new Date().toISOString() })
          .eq('id', partner.id);
        return res.status(200).json({ ok: true });
      }

      if (b.action === 'bank') {
        const { error: vErr, value } = cleanBankDetails(b);
        if (vErr) return res.status(400).json({ error: vErr });
        const now = new Date().toISOString();
        const { error } = await supabase.from('partners').update({ ...value, bank_updated_at: now, updated_at: now }).eq('id', partner.id);
        if (error) throw error;
        const first = !partner.bank_account_number;
        await notifyOwner(
          `${first ? '🏦 Bank details added' : '⚠️ Bank details CHANGED'}: ${partner.name} (${partner.code})\n` +
          `${value.bank_name} ${maskAccount(value.bank_account_number)} · ${value.bank_ifsc}` +
          (first ? '' : '\nConfirm with the partner on WhatsApp before the next payout.'),
          deps,
        );
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const partner = await loadPartner(supabase, req.query?.t);
    if (!partner) return res.status(404).json({ error: 'Link not found' });

    const [{ data: orders, error: oErr }, { data: payouts, error: pErr }] = await Promise.all([
      supabase.from('india_orders').select('*').eq('ref_code', partner.code).in('status', ['paid', 'refunded']),
      supabase.from('partner_payouts').select('*').eq('partner_id', partner.id),
    ]);
    if (oErr) throw oErr;
    if (pErr) throw pErr;

    const earnings = computeEarnings(orders || [], deps.now || new Date());
    const months = withPayouts(earnings.months, payouts || []);
    const paid = (payouts || []).reduce((t, p) => ({ gross: t.gross + p.gross, tds: t.tds + p.tds, net: t.net + p.net }), { gross: 0, tds: 0, net: 0 });

    return res.status(200).json({
      name: partner.name,
      code: partner.code,
      status: partner.status,
      phone: partner.phone,
      hasPin: Boolean(partner.pin_hash),
      bank: partner.bank_account_number ? {
        accountName: partner.bank_account_name,
        account: maskAccount(partner.bank_account_number),
        ifsc: partner.bank_ifsc,
        bankName: partner.bank_name,
        upi: partner.payout_upi,
        pan: partner.pan ? `${partner.pan.slice(0, 2)}•••••${partner.pan.slice(-3)}` : null,
        updatedAt: partner.bank_updated_at,
      } : null,
      rules: { commission: COMMISSION, monthlyBonus: MONTHLY_BONUS, refundWindowDays: REFUND_WINDOW_DAYS, payoutDay: PAYOUT_DAY },
      sales: earnings.sales,
      months,
      totals: { ...earnings.totals, paid },
    });
  } catch (err) {
    console.error('partners/me error:', err);
    return res.status(500).json({ error: 'Could not load your page. Please try again.' });
  }
}

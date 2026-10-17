/**
 * GET /api/partners/me   (needs the partner login cookie)
 *
 * The logged-in partner's earnings page data. Customer details are masked - partners see first name,
 * last initial and the last 4 digits of the phone only.
 */
import { getSupabase } from '../_lib/supabase.js';
import { getLoggedInPartner } from '../_lib/partner-auth.js';
import { publicDetails, getTdsRate } from '../_lib/partner-payouts.js';
import { computeEarnings, COMMISSION, MONTHLY_BONUS, REFUND_WINDOW_DAYS, PAYOUT_DAY } from '../_lib/partners.js';

export default async function handler(req, res, deps = {}) {
  res.setHeader('Cache-Control', 'private, no-store');

  const supabase = (deps.getSupabase || getSupabase)();
  try {
    const partner = await getLoggedInPartner(req, supabase);
    if (!partner || !partner.code) return res.status(401).json({ error: 'Please log in' });

    const { data: orders, error: oErr } = await supabase
      .from('india_orders')
      .select('*')
      .eq('ref_code', partner.code)
      .in('status', ['paid', 'refunded']);
    if (oErr) throw oErr;

    const earnings = computeEarnings(orders || [], deps.now || new Date());
    const { data: payouts, error: pErr } = await supabase.from('partner_payouts')
      .select('month, sales, commission, bonus, gross, tds_rate, tds, net, utr, paid_on')
      .eq('partner_id', partner.id).order('month', { ascending: false });
    if (pErr) throw pErr;
    const tdsRate = await getTdsRate(supabase);
    return res.status(200).json({
      name: partner.name,
      phone: partner.phone,
      email: partner.email,
      code: partner.code,
      mustChangePin: Boolean(partner.pin_must_change),
      payoutDetails: publicDetails(partner),
      payouts: payouts || [],
      tdsRate,
      status: partner.status,
      rules: { commission: COMMISSION, monthlyBonus: MONTHLY_BONUS, refundWindowDays: REFUND_WINDOW_DAYS, payoutDay: PAYOUT_DAY },
      ...earnings,
    });
  } catch (err) {
    console.error('partners/me error:', err);
    return res.status(500).json({ error: 'Could not load your page. Please try again.' });
  }
}

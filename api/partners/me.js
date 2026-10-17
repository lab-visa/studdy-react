/**
 * GET /api/partners/me?t=<dashboard_token>
 *
 * A partner's private earnings page data. The long random token in their
 * link is the access key (same no-password design as the customer
 * dashboard). Customer details are masked - partners see first name,
 * last initial and the last 4 digits of the phone only.
 */
import { getSupabase } from '../_lib/supabase.js';
import { computeEarnings, COMMISSION, MONTHLY_BONUS, REFUND_WINDOW_DAYS, PAYOUT_DAY } from '../_lib/partners.js';

const TOKEN_RE = /^[a-f0-9]{48}$/;

export default async function handler(req, res, deps = {}) {
  const token = req.query?.t;
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return res.status(404).json({ error: 'Link not found' });
  res.setHeader('Cache-Control', 'private, no-store');

  const supabase = (deps.getSupabase || getSupabase)();
  try {
    const { data: partner, error } = await supabase
      .from('partners')
      .select('*')
      .eq('dashboard_token', token)
      .maybeSingle();
    if (error) throw error;
    if (!partner || !partner.code || (partner.status !== 'approved' && partner.status !== 'paused')) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const { data: orders, error: oErr } = await supabase
      .from('india_orders')
      .select('*')
      .eq('ref_code', partner.code)
      .in('status', ['paid', 'refunded']);
    if (oErr) throw oErr;

    const earnings = computeEarnings(orders || [], deps.now || new Date());
    return res.status(200).json({
      name: partner.name,
      code: partner.code,
      status: partner.status,
      rules: { commission: COMMISSION, monthlyBonus: MONTHLY_BONUS, refundWindowDays: REFUND_WINDOW_DAYS, payoutDay: PAYOUT_DAY },
      ...earnings,
    });
  } catch (err) {
    console.error('partners/me error:', err);
    return res.status(500).json({ error: 'Could not load your page. Please try again.' });
  }
}

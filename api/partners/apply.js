/**
 * POST /api/partners/apply
 * body: { name, phone, email, consent }
 *
 * Instant self-registration for the sales partner programme (Oct 2026,
 * Vish): name + WhatsApp number + email → the partner is active straight
 * away and gets their personal sales link and private earnings link in
 * the response. The admin can pause anyone later from Admin → Sales
 * Partners. One registration per mobile number; a repeat registration
 * does NOT reveal the existing links (anyone could type someone else's
 * number) - they're told to message us instead.
 */
import { getSupabase } from '../_lib/supabase.js';
import { normalizeIndianPhone } from '../_lib/cashfree.js';
import { makePartnerCode, newDashboardToken } from '../_lib/partners.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '') || null;

export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const b = req.body || {};

  const name = clip(b.name, 80);
  if (!name || name.length < 2) return res.status(400).json({ error: 'Please enter your full name.' });
  const phone = normalizeIndianPhone(b.phone);
  if (!phone) return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
  const email = clip(b.email, 120)?.toLowerCase() ?? null;
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (b.consent !== true) return res.status(400).json({ error: 'Please agree to the partner terms to continue.' });

  const supabase = (deps.getSupabase || getSupabase)();
  const now = new Date().toISOString();

  /* Retry only on a referral-code collision (rare). */
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = {
      name, phone, email,
      status: 'approved',
      code: makePartnerCode(name),
      dashboard_token: newDashboardToken(),
      approved_at: now,
    };
    const { error } = await supabase.from('partners').insert(row);
    if (!error) {
      return res.status(200).json({
        ok: true,
        code: row.code,
        salesLink: `https://studdylab.com/?ref=${row.code}`,
        earningsLink: `https://studdylab.com/partner?t=${row.dashboard_token}`,
      });
    }
    if (error.code === '23505') {
      const { data: existing } = await supabase.from('partners').select('id').eq('phone', phone).maybeSingle();
      if (existing) {
        return res.status(409).json({ error: 'This mobile number is already registered. Message us on WhatsApp and we will resend your links.' });
      }
      continue; // code collision - try a new code
    }
    console.error('partners/apply error:', error);
    return res.status(500).json({ error: 'Could not register. Please try again.' });
  }
  return res.status(500).json({ error: 'Could not register. Please try again.' });
}

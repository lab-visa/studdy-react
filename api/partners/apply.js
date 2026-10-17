/**
 * POST /api/partners/apply
 * body: { name, phone, email, city?, pin, consent }
 *
 * Instant self-registration for the sales partner programme (Oct 2026,
 * Vish): the partner is active straight away, chooses a 6-digit PIN for
 * logging in (username = their WhatsApp number), and is logged in by the
 * response's session cookie. The admin can pause anyone later from Admin → Sales
 * Partners. One registration per mobile number; a repeat registration
 * does NOT log anyone in or reveal anything (anyone could type someone
 * else's number) - they're told to log in instead.
 */
import { getSupabase } from '../_lib/supabase.js';
import { normalizeIndianPhone } from '../_lib/cashfree.js';
import { makePartnerCode } from '../_lib/partners.js';
import { isSameOriginRequest } from '../_lib/admin-auth.js';
import { pinProblem, pinFields, createPartnerSession, partnerCookie } from '../_lib/partner-auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '') || null;

export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isSameOriginRequest(req)) return res.status(403).json({ error: 'Forbidden' });
  const b = req.body || {};

  const name = clip(b.name, 80);
  if (!name || name.length < 2) return res.status(400).json({ error: 'Please enter your full name.' });
  const phone = normalizeIndianPhone(b.phone);
  if (!phone) return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
  const email = clip(b.email, 120)?.toLowerCase() ?? null;
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const city = clip(b.city, 60);
  const problem = pinProblem(b.pin);
  if (problem) return res.status(400).json({ error: problem });
  if (b.consent !== true) return res.status(400).json({ error: 'Please agree to the partner terms to continue.' });

  const supabase = (deps.getSupabase || getSupabase)();
  const now = new Date().toISOString();

  /* Retry only on a referral-code collision (rare). */
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = {
      name, phone, email, city,
      status: 'approved',
      code: makePartnerCode(name),
      approved_at: now,
      ...pinFields(b.pin),
    };
    const { data: created, error } = await supabase.from('partners').insert(row).select('id').single();
    if (!error) {
      const token = await createPartnerSession(supabase, created.id);
      res.setHeader('Set-Cookie', partnerCookie(token));
      return res.status(200).json({ ok: true, code: row.code, salesLink: `https://studdylab.com/?ref=${row.code}` });
    }
    if (error.code === '23505') {
      const { data: existing } = await supabase.from('partners').select('id').eq('phone', phone).maybeSingle();
      if (existing) {
        return res.status(409).json({ error: 'This mobile number is already a partner. Please log in instead.' });
      }
      continue; // code collision - try a new code
    }
    console.error('partners/apply error:', error);
    return res.status(500).json({ error: 'Could not register. Please try again.' });
  }
  return res.status(500).json({ error: 'Could not register. Please try again.' });
}

/**
 * POST /api/partners/apply
 * body: { name, phone, email, city, occupation, experience, whyJoin, consent }
 *
 * Public application form for the sales partner programme. Saves the
 * application with status 'applied' — nothing else happens until the
 * admin approves it. One application per mobile number.
 */
import { getSupabase } from '../_lib/supabase.js';
import { normalizeIndianPhone } from '../_lib/cashfree.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OCCUPATIONS = ['tutor', 'teacher', 'student', 'homemaker', 'sales', 'working', 'other'];
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
  const occupation = OCCUPATIONS.includes(b.occupation) ? b.occupation : 'other';
  if (b.consent !== true) return res.status(400).json({ error: 'Please agree to be contacted about your application.' });

  const supabase = (deps.getSupabase || getSupabase)();
  const { error } = await supabase.from('partners').insert({
    name,
    phone,
    email,
    city: clip(b.city, 60),
    occupation,
    experience: clip(b.experience, 1000),
    why_join: clip(b.whyJoin, 1000),
  });

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'We already have an application from this mobile number. We will contact you on WhatsApp soon.' });
    }
    console.error('partners/apply error:', error);
    return res.status(500).json({ error: 'Could not submit your application. Please try again.' });
  }
  return res.status(200).json({ ok: true });
}

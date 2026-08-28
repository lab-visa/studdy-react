/**
 * POST /api/track-event
 *
 * Called from the frontend (see src/utils/tracking.ts) at three moments:
 *   1. First page load on the site           -> event: "opened"
 *   2. Landing on the /checkout page          -> event: "checkout_viewed"
 *   3. Clicking "Start Free Trial" (pre-Stripe) -> event: "trial_clicked"
 *
 * As of Phase 3 (Aug 2026): this endpoint no longer creates or touches any
 * row in `leads`, and never creates anything identifying anyone. Per the
 * business rule locked at the very start of this project — nobody gets a
 * row anywhere in the CRM just for visiting the site — a visit here only
 * adds +1 to an anonymous daily counter (site_traffic_daily): how many
 * people opened the site today, from which country, on which device. No
 * name, no email, no lead_id, no individual row, ever, for someone who
 * hasn't started a trial.
 *
 * The browser generates and keeps its own tracking id now (see
 * tracking.ts) instead of asking this endpoint for one — that id is only
 * ever written to a database row for the first time when that same person
 * actually starts a trial (handled in stripe-webhook.js / sync-customer.js),
 * at which point they get a real customers row and a Paid ID.
 */
import { getSupabase } from './_lib/supabase.js';

function detectDevice(ua = '') {
  if (/mobile/i.test(ua) && !/ipad|tablet/i.test(ua)) return 'mobile';
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  return 'desktop';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event } = req.body || {};
  const VALID_EVENTS = ['opened', 'checkout_viewed', 'trial_clicked'];
  if (!VALID_EVENTS.includes(event)) {
    return res.status(400).json({ error: 'Invalid or missing event' });
  }

  const supabase = getSupabase();
  const device_type = detectDevice(req.headers['user-agent'] || '');
  const country = req.headers['x-vercel-ip-country'] || 'unknown';
  const today = new Date().toISOString().slice(0, 10);

  try {
    /* Atomic upsert-and-increment: if today's row for this exact
     * day+event+country+device combo doesn't exist yet, create it at 1;
     * if it does, bump it by 1. Postgres does this as a single safe
     * operation, so two visitors landing at the exact same instant can
     * never clobber each other's count. */
    const { error } = await supabase.rpc('increment_site_traffic', {
      p_day: today,
      p_event: event,
      p_country: country,
      p_device_type: device_type,
    });
    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    /* Tracking must never break the site for a real visitor — log and
     * move on, same "fail silently towards the user" rule as before. */
    console.error('track-event error:', err);
    return res.status(200).json({ ok: false });
  }
}

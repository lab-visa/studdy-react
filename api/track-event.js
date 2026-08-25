/**
 * POST /api/track-event
 *
 * Called from the frontend (see src/utils/tracking.ts) at three moments:
 *   1. First page load on the site           -> event: "opened"
 *   2. Landing on the /checkout page          -> event: "checkout_viewed"
 *   3. Clicking "Start Free Trial" (pre-Stripe) -> event: "trial_clicked"
 *
 * First call (no lead_id yet): creates a new row in `leads`, captures
 * UTM / source-lead-id / affiliate info / IP / device, and returns the
 * new lead_id so the browser can remember it (localStorage).
 *
 * Later calls (lead_id already known): just advances that lead's stage
 * and timestamp — never overwrites earlier data.
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

  const supabase = getSupabase();
  const {
    lead_id,
    event,
    source_lead_id,
    affiliate_id,
    affiliate_name,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    fmt,
    course_id,
  } = req.body || {};

  const VALID_EVENTS = ['opened', 'checkout_viewed', 'trial_clicked'];
  if (!VALID_EVENTS.includes(event)) {
    return res.status(400).json({ error: 'Invalid or missing event' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    null;
  const device_type = detectDevice(req.headers['user-agent'] || '');
  const now = new Date().toISOString();

  /* Vercel adds these headers automatically on every request — no lookup
   * needed, no extra API call, works even if the visitor's own browser
   * blocks third-party IP-lookup services. */
  const detected_country = req.headers['x-vercel-ip-country'] || null;
  const detected_region = req.headers['x-vercel-ip-country-region'] || null;

  try {
    /* Existing visitor — just move their stage forward */
    if (lead_id) {
      const updates = { updated_at: now };
      if (event === 'checkout_viewed') {
        updates.checkout_viewed_at = now;
        updates.stage = 'checkout_viewed';
      }
      if (event === 'trial_clicked') {
        updates.trial_clicked_at = now;
        updates.stage = 'trial_clicked';
      }

      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('lead_id', lead_id);

      if (error) throw error;
      return res.status(200).json({ lead_id });
    }

    /* Brand new visitor — create their row */
    const { data, error } = await supabase
      .from('leads')
      .insert({
        source_lead_id: source_lead_id || null,
        affiliate_id: affiliate_id || null,
        affiliate_name: affiliate_name || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        utm_content: utm_content || null,
        utm_term: utm_term || null,
        fmt: fmt || null,
        course_id: course_id || null,
        ip_address: ip,
        device_type,
        detected_country,
        detected_region,
        opened_at: now,
        stage: 'opened',
        status: 'lead',
      })
      .select('lead_id')
      .single();

    if (error) throw error;
    return res.status(200).json({ lead_id: data.lead_id });
  } catch (err) {
    console.error('track-event error:', err);
    return res.status(500).json({ error: err.message });
  }
};

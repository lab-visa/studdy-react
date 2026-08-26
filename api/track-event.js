/**
 * POST /api/track-event
 *
 * Called from the frontend (see src/utils/tracking.ts) at three moments:
 *   1. First page load on the site           -> event: "opened"
 *   2. Landing on the /checkout page          -> event: "checkout_viewed"
 *   3. Clicking "Start Free Trial" (pre-Stripe) -> event: "trial_clicked"
 *
 * First call from a browser that has no saved lead_id yet:
 *   - If a source_lead_id was on the URL (e.g. a link Vish personally sent
 *     someone on WhatsApp) AND a lead with that same source_lead_id
 *     already exists, we REUSE that row instead of creating a new one.
 *     This is what stops the same person opening the same link from a
 *     different browser/phone from turning into a second, third, fourth...
 *     row in the CRM.
 *   - Otherwise (truly new, or no source_lead_id at all — an organic
 *     visit), creates a new row and returns its lead_id so the browser
 *     can remember it.
 *
 * Later calls (lead_id already known): just advances that lead's stage —
 * and never moves it BACKWARDS (e.g. re-visiting checkout after already
 * clicking "start trial" won't undo that).
 */
import { getSupabase } from './_lib/supabase.js';

function detectDevice(ua = '') {
  if (/mobile/i.test(ua) && !/ipad|tablet/i.test(ua)) return 'mobile';
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  return 'desktop';
}

/* Funnel order — later beats earlier. A lead's stage only ever moves
 * forward through this list, never back. */
const STAGE_ORDER = [
  'opened',
  'checkout_viewed',
  'trial_clicked',
  'trial_started',
  'trial_ending_soon',
  'paid',
  'cancel_requested',
  'cancelled',
];

function moreAdvancedStage(current, incoming) {
  const ci = STAGE_ORDER.indexOf(current);
  const ii = STAGE_ORDER.indexOf(incoming);
  if (ii === -1) return current || incoming;
  if (ci === -1) return incoming;
  return ii > ci ? incoming : current;
}

function stageForEvent(event) {
  if (event === 'checkout_viewed') return 'checkout_viewed';
  if (event === 'trial_clicked') return 'trial_clicked';
  return 'opened';
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
  const detected_country = req.headers['x-vercel-ip-country'] || null;
  const detected_region = req.headers['x-vercel-ip-country-region'] || null;
  const incomingStage = stageForEvent(event);

  try {
    /* ── Browser already has a saved lead_id — just advance its stage ── */
    if (lead_id) {
      const { data: existing } = await supabase
        .from('leads')
        .select('stage')
        .eq('lead_id', lead_id)
        .maybeSingle();

      const updates = { updated_at: now };
      if (event === 'checkout_viewed') updates.checkout_viewed_at = now;
      if (event === 'trial_clicked') updates.trial_clicked_at = now;
      updates.stage = moreAdvancedStage(existing?.stage, incomingStage);

      const { error } = await supabase.from('leads').update(updates).eq('lead_id', lead_id);
      if (error) throw error;
      return res.status(200).json({ lead_id });
    }

    /* ── No saved lead_id — check if this exact source_lead_id already
     * has a row (same tracking link opened from another device/browser)
     * before creating anything new. ── */
    if (source_lead_id) {
      const { data: existing } = await supabase
        .from('leads')
        .select('lead_id, stage, ip_address, device_type, detected_country, detected_region')
        .eq('source_lead_id', source_lead_id)
        .maybeSingle();

      if (existing) {
        const updates = {
          updated_at: now,
          stage: moreAdvancedStage(existing.stage, incomingStage),
        };
        if (event === 'checkout_viewed') updates.checkout_viewed_at = now;
        if (event === 'trial_clicked') updates.trial_clicked_at = now;
        /* Don't clobber the first device's info with a second device's —
         * only fill these in if they were never captured. */
        if (!existing.ip_address) updates.ip_address = ip;
        if (!existing.device_type) updates.device_type = device_type;
        if (!existing.detected_country) updates.detected_country = detected_country;
        if (!existing.detected_region) updates.detected_region = detected_region;

        const { error } = await supabase.from('leads').update(updates).eq('lead_id', existing.lead_id);
        if (error) throw error;
        return res.status(200).json({ lead_id: existing.lead_id });
      }
    }

    /* ── Genuinely brand new visitor — create their row ── */
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
}

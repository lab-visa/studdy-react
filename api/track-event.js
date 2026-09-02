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
 *
 * CRM-2A additions (both purely additive, neither creates any CRM row):
 *
 *   1. Day bucketing is now Asia/Kolkata (StuddyLab's business reporting
 *      timezone — see api/_lib/reporting-timezone.js), not UTC. Every row
 *      written by THIS code bucket correctly going forward. Historical
 *      rows written before this change used
 *      `new Date().toISOString().slice(0,10)` (UTC) and are NOT rebucketed
 *      or rewritten — they remain legacy UTC-bucketed data, forever.
 *
 *   2. This endpoint now also accepts an optional `campaign` field in the
 *      request body — the visitor's persisted `utm_campaign` value (see
 *      tracking.ts), campaign IDENTITY, kept entirely separate from lead
 *      IDENTITY (`lid`/`source_lead_id`, which this endpoint has never
 *      received and still doesn't). Normalized (string-only, trimmed,
 *      length-capped — see normalizeCampaignCode() below) before being
 *      forwarded to increment_site_traffic()'s existing `p_campaign_code`
 *      argument, which already defaults to 'none' — so a
 *      missing/malformed/empty/absent value degrades to exactly today's
 *      behavior, never an error. Historical `campaign_code='none'` rows
 *      are never touched by this change; only new rows can carry a
 *      non-'none' value.
 */
import { getSupabase } from './_lib/supabase.js';
import { todayReportingDay } from './_lib/reporting-timezone.js';

/**
 * CODE-REVIEW FIX (round 2, "encode and normalize campaign values"):
 * `campaign` in the request body is fully attacker/visitor-controlled
 * (it started life as a URL query param). Normalize defensively before
 * it ever reaches the RPC call: string only, trimmed, capped to a
 * sensible max length so one abusive/malformed value can't create an
 * unbounded number of distinct site_traffic_daily rows. Anything
 * invalid/empty after normalization degrades to `undefined`, which
 * leaves out `p_campaign_code` entirely so the RPC's own existing 'none'
 * default applies — exactly today's behavior, never an error.
 */
const MAX_CAMPAIGN_CODE_LENGTH = 100;

function normalizeCampaignCode(campaign) {
  if (typeof campaign !== 'string') return undefined;
  const trimmed = campaign.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_CAMPAIGN_CODE_LENGTH);
}

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

  const { event, campaign } = req.body || {};
  const VALID_EVENTS = ['opened', 'checkout_viewed', 'trial_clicked'];
  if (!VALID_EVENTS.includes(event)) {
    return res.status(400).json({ error: 'Invalid or missing event' });
  }

  const supabase = getSupabase();
  const device_type = detectDevice(req.headers['user-agent'] || '');
  const country = req.headers['x-vercel-ip-country'] || 'unknown';
  /* Asia/Kolkata business day, not UTC — see the module comment above. */
  const today = todayReportingDay();
  /* Campaign IDENTITY only — never lead identity. Only forwarded when it's
   * a genuine non-empty string; anything else (missing, wrong type, an
   * accidental object) is left out entirely so the RPC's own existing
   * 'none' default applies, exactly like every call made before this
   * field existed. Trimmed and length-capped — see normalizeCampaignCode(). */
  const campaignCode = normalizeCampaignCode(campaign);

  try {
    /* Atomic upsert-and-increment: if today's row for this exact
     * day+event+campaign+country+device combo doesn't exist yet, create it
     * at 1; if it does, bump it by 1. Postgres does this as a single safe
     * operation, so two visitors landing at the exact same instant can
     * never clobber each other's count. */
    const { error } = await supabase.rpc('increment_site_traffic', {
      p_day: today,
      p_event: event,
      p_country: country,
      p_device_type: device_type,
      ...(campaignCode ? { p_campaign_code: campaignCode } : {}),
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

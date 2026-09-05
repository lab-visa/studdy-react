/**
 * POST /api/track-attribution
 * body: { leadId, first: {...}, latest: {...} }
 *
 * Called from the frontend exactly once per "Start Free Trial" click (see
 * src/utils/attribution.ts + src/pages/Checkout.tsx's handleStart) — the
 * moment intent-to-purchase happens, never on a mere page visit. This is
 * the ONLY place a lead_attribution row is created, matching the existing
 * business rule already stated in api/track-event.js: nobody gets a row
 * anywhere in the CRM just for visiting the site.
 *
 * `leadId` is the SAME id already sent to Stripe as client_reference_id
 * (src/utils/tracking.ts's getLeadId()) — this is what lets
 * api/_lib/sync-customer.js join this row back onto the resulting
 * customer at checkout.session.completed.
 *
 * Public, unauthenticated, like /api/track-event — fully attacker/visitor
 * controlled input, so every field is defensively normalized
 * (api/_lib/attribution.js) before it ever reaches the database: no
 * unbounded string, no wrong type, no way to inject a row for someone
 * else's lead_id... other than knowing that lead_id already (which is no
 * more sensitive than client_reference_id itself, already sent to Stripe
 * in a plain URL query param today).
 *
 * Never throws toward the customer's browser: like track-event.js, a
 * failure here is logged and returns 200 with ok:false — attribution
 * capture must never block or break the "Start Free Trial" redirect it
 * rides alongside.
 */
import { getSupabase } from './_lib/supabase.js';
import { captureAttribution } from './_lib/attribution.js';

const MAX_BODY_LEAD_ID_LENGTH = 200;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { leadId, first, latest } = req.body || {};

  if (typeof leadId !== 'string' || !leadId.trim() || leadId.length > MAX_BODY_LEAD_ID_LENGTH) {
    return res.status(400).json({ error: 'leadId is required' });
  }

  const supabase = getSupabase();

  try {
    await captureAttribution(supabase, { leadId, first, latest });
    return res.status(200).json({ ok: true });
  } catch (err) {
    /* Must never break the site for a real visitor — log and move on,
     * same "fail silently towards the user" rule as track-event.js. */
    console.error('track-attribution error:', err);
    return res.status(200).json({ ok: false });
  }
}

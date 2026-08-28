/**
 * GET /api/refresh-lead?session_id=xxx&key=xxx
 *
 * Admin-only, one-off tool: re-syncs a single customer's Supabase row from
 * Stripe's current data, using the exact same logic the live webhook uses
 * — WITHOUT a new payment, new subscription, or new Studdy seat being
 * claimed. Built for exactly one situation: you shipped a code fix and
 * want an already-existing test/customer row to reflect it immediately,
 * instead of waiting for the next real Stripe event or asking someone to
 * pay again.
 *
 * Protected by a shared secret (ADMIN_SYNC_KEY, set in Vercel) so this
 * can't be triggered by a random visitor who happens to see a session_id
 * in a URL — only someone who also knows the key.
 */
import Stripe from 'stripe';
import { getSupabase } from './_lib/supabase.js';
import { syncCheckoutSession } from './_lib/sync-checkout-session.js';

export default async function handler(req, res) {
  const { session_id, key } = req.query;

  if (!process.env.ADMIN_SYNC_KEY || key !== process.env.ADMIN_SYNC_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = getSupabase();
    const leadId = await syncCheckoutSession(stripe, supabase, session_id);
    return res.status(200).json({ ok: true, lead_id: leadId });
  } catch (err) {
    console.error('refresh-lead error:', err);
    return res.status(500).json({ error: err.message });
  }
}

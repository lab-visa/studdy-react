/**
 * POST /api/cancel-request
 * body: { session_id, reason, message }
 *
 * Called from the dashboard's "Request cancellation" form.
 *
 * IMPORTANT — this does NOT touch Stripe and does NOT stop billing.
 * It only saves the customer's reason + message + timestamp to Supabase
 * and marks the lead's stage as 'cancel_requested', so it shows up for
 * Vish to review and follow up on WhatsApp within 24 hours, per the
 * original plan. Actually cancelling the subscription in Stripe is a
 * manual step Vish does himself after that conversation — this is
 * intentional, not a bug: subscriptions must never be auto-cancelled
 * from this endpoint.
 */
import { getSupabase } from './_lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id, reason, message } = req.body || {};

  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  const supabase = getSupabase();

  try {
    const { data: lead } = await supabase
      .from('leads')
      .select('lead_id')
      .eq('stripe_session_id', session_id)
      .maybeSingle();

    if (!lead) {
      return res.status(404).json({ error: 'We could not find your subscription. Please message us on WhatsApp instead.' });
    }

    await supabase
      .from('leads')
      .update({
        cancel_reason: reason || null,
        cancel_message: message || null,
        cancel_requested_at: new Date().toISOString(),
        stage: 'cancel_requested',
        updated_at: new Date().toISOString(),
      })
      .eq('lead_id', lead.lead_id);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('cancel-request error:', err);
    return res.status(500).json({ error: 'Could not process your request. Please message us on WhatsApp.' });
  }
}

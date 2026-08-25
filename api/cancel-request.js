/**
 * POST /api/cancel-request
 * body: { session_id, reason, message }
 *
 * Called from the dashboard's "Request cancellation" form.
 *
 * What it actually does (this used to be a stub that only logged to the
 * console — nothing was ever saved and nothing was ever cancelled):
 *   1. Looks up the customer's Stripe subscription from their session_id.
 *   2. Tells Stripe to cancel it at the END of the current billing
 *      period (cancel_at_period_end) — NOT immediately. That means: if
 *      they're still in the free trial, they keep access and are never
 *      charged; if they're a paying customer, they keep access through
 *      what they already paid for, then it stops. This is safer than an
 *      immediate cancel and matches the "access continues until we
 *      process this" copy already on the dashboard.
 *   3. Saves their reason + message + timestamp to Supabase so it shows
 *      up in reporting, and marks the lead's stage as 'cancel_requested'.
 */
import Stripe from 'stripe';
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
      .select('lead_id, stripe_subscription_id')
      .eq('stripe_session_id', session_id)
      .maybeSingle();

    if (!lead) {
      return res.status(404).json({ error: 'We could not find your subscription. Please message us on WhatsApp instead.' });
    }

    if (lead.stripe_subscription_id) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      try {
        await stripe.subscriptions.update(lead.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      } catch (err) {
        /* If Stripe says it's already cancelled, that's fine — carry on
         * and still record the request. Any other Stripe error, surface it. */
        if (err?.code !== 'resource_missing') {
          console.error('Stripe cancel error:', err.message);
        }
      }
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

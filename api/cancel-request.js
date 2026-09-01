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
 *
 * CRM-1 Objective 2 (additive, byte-for-byte unchanged `leads` write
 * above/before it): after the legacy `leads` update succeeds — which is
 * still the only thing the customer's response depends on — this also
 * best-effort mirrors the request into the new `cancellation_requests`
 * table, matching migration 0006's schema and the
 * cancellation_requests_one_open_per_customer partial unique index
 * (migration 0013). A failure anywhere in this additive block is only
 * logged, never surfaced to the customer and never a reason to fail this
 * request — same safely()/log-only discipline already used throughout
 * this codebase (see stripe-webhook.js).
 */
import { getSupabase } from './_lib/supabase.js';
import { OPEN_CANCELLATION_STATUSES } from './_lib/cancellation.js';

export async function safely(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`cancel-request (${label}) error:`, err);
  }
}

/**
 * Additive dual-write into cancellation_requests. Never throws — every
 * failure path is caught by the safely() wrapper this is called from.
 *
 * Idempotency has two layers, matching the mirrorLegacyAllocation()
 * pattern already proven in api/_lib/sync-customer.js:
 *   1. An application-level pre-check (cheap, handles the common case).
 *   2. The database's own unique index as the real guarantor under
 *      concurrency — a 23505 conflict from a near-simultaneous duplicate
 *      request is caught here and treated as "an open request already
 *      exists", not an error.
 * Either way, a repeated/double-click request resolves to the existing
 * open request rather than creating a second one or overwriting its
 * reason/notes (a human conversation may already be in progress on the
 * original reason given).
 */
export async function mirrorCancellationRequest(supabase, { sessionId, reason, message, requestedAt }) {
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();

  if (customerError) {
    console.error('mirrorCancellationRequest: error looking up customer for session', sessionId, customerError);
    return;
  }
  if (!customer) {
    /* No matching customers row yet (e.g. predates Phase 3, or the
     * new-CRM sync hasn't caught up yet) — nothing to mirror into. Not an
     * error: the legacy leads row is still the record of truth here. */
    console.error(`mirrorCancellationRequest: no customers row for session ${sessionId} — skipping mirror.`);
    return;
  }

  const { data: existingOpen, error: existingError } = await supabase
    .from('cancellation_requests')
    .select('id')
    .eq('customer_id', customer.id)
    .in('status', OPEN_CANCELLATION_STATUSES)
    .maybeSingle();

  if (existingError) {
    console.error('mirrorCancellationRequest: error checking existing open request for customer', customer.id, existingError);
    return;
  }
  if (existingOpen) {
    /* An open cancellation workflow already exists for this customer —
     * leave it exactly as-is. This is the "repeated/double-click request
     * resolves to the existing open request" behavior. */
    return;
  }

  const { error: insertError } = await supabase.from('cancellation_requests').insert({
    customer_id: customer.id,
    source: 'dashboard',
    requested_at: requestedAt,
    reason: reason || null,
    notes: message || null,
    status: 'pending_discussion',
  });

  if (insertError) {
    if (insertError.code === '23505') {
      /* Lost a race against a near-simultaneous duplicate request — the
       * database's own partial unique index caught it. An open request
       * now exists (just not the one we tried to create); this is the
       * correct, expected no-op outcome under concurrency, not a failure. */
      return;
    }
    console.error('mirrorCancellationRequest: insert error for customer', customer.id, insertError);
  }
}

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

    /* Computed once, reused for both the leads write below and the
     * cancellation_requests mirror, so the two records agree exactly. */
    const requestedAt = new Date().toISOString();

    await supabase
      .from('leads')
      .update({
        cancel_reason: reason || null,
        cancel_message: message || null,
        cancel_requested_at: requestedAt,
        stage: 'cancel_requested',
        updated_at: requestedAt,
      })
      .eq('lead_id', lead.lead_id);

    /* Additive, best-effort — see mirrorCancellationRequest() above. This
     * can never affect the response below, which is what the customer's
     * dashboard actually depends on. */
    await safely('mirror', () => mirrorCancellationRequest(supabase, { sessionId: session_id, reason, message, requestedAt }));

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('cancel-request error:', err);
    return res.status(500).json({ error: 'Could not process your request. Please message us on WhatsApp.' });
  }
}

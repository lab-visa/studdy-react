/**
 * GET /api/admin/reconciliation
 *
 * CRM-1 Objective 4 — read-only, on-demand diagnostic. No new table for
 * detection: every check below reads only already-existing tables and
 * returns counts plus safe identifiers (lead_id / paid_id / customer_id /
 * stripe_event_id — never raw PII: no name, email, phone, card, or
 * Studdy credential is ever read or returned by this endpoint).
 *
 * This endpoint DETECTS gaps only. It never writes, repairs, increments,
 * deletes, or retries anything — recovery is manual, separately reviewed
 * and approved, exactly as instructed.
 *
 * Implemented as plain read queries against existing tables (fetch +
 * client-side set-difference) rather than a new SQL function, since that
 * would require a new migration beyond the four (0012–0015) approved for
 * this round. At current production scale (dozens of rows, not
 * thousands) this is simple, correct, and fast; each query below is
 * capped (RECONCILIATION_ROW_CAP) and the cap is reported in the
 * response so a future volume increase past it is visible, not silent.
 */
import { getSupabase } from '../_lib/supabase.js';
import { requireAdminSession } from '../_lib/admin-auth.js';
import { OPEN_CANCELLATION_STATUSES } from '../_lib/cancellation.js';

const RECONCILIATION_ROW_CAP = 2000;
const PAYMENT_CLAIM_STALE_MINUTES = 10;

/** Check #1 — a real legacy customer (has both Stripe ids) with no matching customers row. */
export async function checkMissingCustomers(supabase) {
  const { data: realLeads, error: leadsError } = await supabase
    .from('leads')
    .select('lead_id, stripe_customer_id, stripe_subscription_id')
    .not('stripe_customer_id', 'is', null)
    .not('stripe_subscription_id', 'is', null)
    .limit(RECONCILIATION_ROW_CAP);
  if (leadsError) throw leadsError;

  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('stripe_customer_id')
    .limit(RECONCILIATION_ROW_CAP);
  if (customersError) throw customersError;

  const known = new Set((customers || []).map((c) => c.stripe_customer_id));
  const flagged = (realLeads || [])
    .filter((l) => !known.has(l.stripe_customer_id))
    .map((l) => ({ lead_id: l.lead_id, stripe_customer_id: l.stripe_customer_id }));

  return { check: 'MISSING_CUSTOMER_ROW', count: flagged.length, items: flagged };
}

/** Check #2 — a customers row with no matching subscriptions row. */
export async function checkMissingSubscriptions(supabase) {
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, paid_id')
    .limit(RECONCILIATION_ROW_CAP);
  if (customersError) throw customersError;

  const { data: subs, error: subsError } = await supabase
    .from('subscriptions')
    .select('customer_id')
    .limit(RECONCILIATION_ROW_CAP);
  if (subsError) throw subsError;

  const withSub = new Set((subs || []).map((s) => s.customer_id));
  const flagged = (customers || [])
    .filter((c) => !withSub.has(c.id))
    .map((c) => ({ customer_id: c.id, paid_id: c.paid_id }));

  return { check: 'MISSING_SUBSCRIPTION_ROW', count: flagged.length, items: flagged };
}

/** Check #3 — allocation mirror missing or mismatched vs. the legacy leads.group_name. */
export async function checkAllocationMirror(supabase) {
  const { data: realLeads, error: leadsError } = await supabase
    .from('leads')
    .select('lead_id, stripe_customer_id, group_name')
    .not('stripe_customer_id', 'is', null)
    .not('stripe_subscription_id', 'is', null)
    .not('group_name', 'is', null)
    .limit(RECONCILIATION_ROW_CAP);
  if (leadsError) throw leadsError;

  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, stripe_customer_id')
    .limit(RECONCILIATION_ROW_CAP);
  if (customersError) throw customersError;

  const { data: assignments, error: assignmentsError } = await supabase
    .from('account_assignments')
    .select('customer_id, studdy_account_id')
    .eq('status', 'active')
    .limit(RECONCILIATION_ROW_CAP);
  if (assignmentsError) throw assignmentsError;

  const { data: accounts, error: accountsError } = await supabase
    .from('studdy_accounts')
    .select('id, group_name')
    .limit(RECONCILIATION_ROW_CAP);
  if (accountsError) throw accountsError;

  const customerIdByStripeId = new Map((customers || []).map((c) => [c.stripe_customer_id, c.id]));
  const activeAssignmentByCustomer = new Map((assignments || []).map((a) => [a.customer_id, a.studdy_account_id]));
  const groupNameByAccountId = new Map((accounts || []).map((a) => [a.id, a.group_name]));

  const flagged = [];
  for (const lead of realLeads || []) {
    const customerId = customerIdByStripeId.get(lead.stripe_customer_id);
    if (!customerId) continue; // no customers row at all — that's check #1's gap, not this one's

    const assignedAccountId = activeAssignmentByCustomer.get(customerId);
    if (!assignedAccountId) {
      flagged.push({ lead_id: lead.lead_id, customer_id: customerId, issue: 'no_active_assignment' });
      continue;
    }
    const assignedGroupName = groupNameByAccountId.get(assignedAccountId);
    if (assignedGroupName !== lead.group_name) {
      flagged.push({
        lead_id: lead.lead_id,
        customer_id: customerId,
        issue: 'mismatched_group',
        legacy_group_name: lead.group_name,
        assigned_group_name: assignedGroupName ?? null,
      });
    }
  }

  return { check: 'ALLOCATION_MIRROR_GAP', count: flagged.length, items: flagged };
}

/**
 * Check #4 — PAYMENT_CLAIM_INCOMPLETE.
 *
 * A payment_claims row older than PAYMENT_CLAIM_STALE_MINUTES with no
 * matching payment_events row for the same stripe_event_id.
 *
 * IMPORTANT, stated exactly as required: this is deterministic evidence
 * that processing for that Stripe event is INCOMPLETE. It does NOT prove
 * whether (A) the process crashed after the claim but before
 * leads.total_months_paid was incremented, or (B) the process crashed
 * after that increment but before payment_events was recorded. This
 * endpoint does not — and must not — attempt to distinguish A from B, or
 * claim the legacy increment is definitely missing. It flags the event
 * for MANUAL REVIEW only. It never automatically increments
 * total_months_paid, and never automatically deletes, releases, or
 * retries a payment_claims row — repair is a separate, manual, later
 * decision.
 */
export async function checkPaymentClaimIncomplete(supabase) {
  const staleBefore = new Date(Date.now() - PAYMENT_CLAIM_STALE_MINUTES * 60 * 1000).toISOString();

  const { data: claims, error: claimsError } = await supabase
    .from('payment_claims')
    .select('stripe_event_id, event_type, claimed_at')
    .lt('claimed_at', staleBefore)
    .limit(RECONCILIATION_ROW_CAP);
  if (claimsError) throw claimsError;

  const { data: events, error: eventsError } = await supabase
    .from('payment_events')
    .select('stripe_event_id')
    .limit(RECONCILIATION_ROW_CAP);
  if (eventsError) throw eventsError;

  const known = new Set((events || []).map((e) => e.stripe_event_id));
  const flagged = (claims || [])
    .filter((c) => !known.has(c.stripe_event_id))
    .map((c) => ({
      stripe_event_id: c.stripe_event_id,
      stripe_event_type: c.event_type,
      claimed_at: c.claimed_at,
      requires_manual_review: true,
    }));

  return {
    check: 'PAYMENT_CLAIM_INCOMPLETE',
    note:
      'Deterministic evidence that processing is incomplete for this event. Does NOT prove whether the crash was before or after the legacy total_months_paid increment. Manual review only — never auto-repaired, never auto-incremented, the payment_claims row is never auto-deleted/released/retried.',
    count: flagged.length,
    items: flagged,
  };
}

/** Check #5 — a dashboard cancellation request never mirrored into cancellation_requests. */
export async function checkCancellationMirror(supabase) {
  const { data: leadsWithCancel, error: leadsError } = await supabase
    .from('leads')
    .select('lead_id, stripe_session_id, cancel_requested_at')
    .not('cancel_requested_at', 'is', null)
    .limit(RECONCILIATION_ROW_CAP);
  if (leadsError) throw leadsError;

  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, stripe_session_id')
    .limit(RECONCILIATION_ROW_CAP);
  if (customersError) throw customersError;

  const { data: openRequests, error: openError } = await supabase
    .from('cancellation_requests')
    .select('customer_id')
    .in('status', OPEN_CANCELLATION_STATUSES)
    .limit(RECONCILIATION_ROW_CAP);
  if (openError) throw openError;

  const customerIdBySessionId = new Map((customers || []).map((c) => [c.stripe_session_id, c.id]));
  const customersWithOpenRequest = new Set((openRequests || []).map((r) => r.customer_id));

  const flagged = [];
  for (const lead of leadsWithCancel || []) {
    const customerId = customerIdBySessionId.get(lead.stripe_session_id);
    if (!customerId) continue; // no customers row at all — check #1's gap, not this one's
    if (!customersWithOpenRequest.has(customerId)) {
      flagged.push({ lead_id: lead.lead_id, customer_id: customerId, cancel_requested_at: lead.cancel_requested_at });
    }
  }

  return { check: 'CANCELLATION_MIRROR_GAP', count: flagged.length, items: flagged };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  const adminUser = await requireAdminSession(req, res, supabase);
  if (!adminUser) return; // requireAdminSession already sent 401

  try {
    const [missingCustomers, missingSubscriptions, allocationMirror, paymentClaimIncomplete, cancellationMirror] =
      await Promise.all([
        checkMissingCustomers(supabase),
        checkMissingSubscriptions(supabase),
        checkAllocationMirror(supabase),
        checkPaymentClaimIncomplete(supabase),
        checkCancellationMirror(supabase),
      ]);

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      row_cap_per_query: RECONCILIATION_ROW_CAP,
      checks: [missingCustomers, missingSubscriptions, allocationMirror, paymentClaimIncomplete, cancellationMirror],
    });
  } catch (err) {
    console.error('reconciliation error:', err);
    return res.status(500).json({ error: 'Reconciliation query failed' });
  }
}

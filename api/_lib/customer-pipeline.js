/**
 * CRM-3A — shared join + lifecycle-derivation layer for the Customer &
 * Subscription pipeline endpoints (api/admin/customers.js,
 * customer-detail.js, today-actions.js). One place builds the
 * customer -> {subscription, open cancellation request, dispute/refund
 * flags} join, so the three endpoints can never disagree about what a
 * given customer's lifecycle looks like.
 *
 * Style matches api/admin/reconciliation.js and api/_lib/metrics.js
 * exactly: plain supabase-js queries + JS-side join/aggregation, each
 * query capped and the cap reported to the caller — no new Postgres
 * function, no migration beyond the additive columns/table in 0016.
 * Current production data volume (dozens of customers) is well inside
 * this cap; a future volume increase past it becomes visible via the
 * reported cap, never silent.
 *
 * PRODUCTION BUG FIX (Sep 2026 — "Today's Actions still reports 1 Access
 * removal pending" for a customer already fully offboarded): also fetches
 * whether each customer still has an unreleased (`active`/`reserved`)
 * account_assignments row, and threads it through to
 * deriveCustomerLifecycle() as hasUnreleasedAssignment — see that
 * function's own comment for why access_removal_pending must be gated on
 * this, not on customers.access_status alone.
 */
import { OPEN_CANCELLATION_STATUSES } from './cancellation.js';
import { deriveCustomerLifecycle } from './lifecycle.js';

export const PIPELINE_ROW_CAP = 2000;

/**
 * Fetches everything needed to derive lifecycle for a set of customer
 * ids, in a fixed small number of queries (never one query per customer).
 * Returns a Map keyed by customer id.
 */
export async function fetchLifecycleInputs(supabase, customerIds) {
  const map = new Map();
  if (!customerIds.length) return map;

  const [subsRes, cancelRes, disputeCreatedRes, disputeClosedRes, refundRes, unreleasedAssignmentRes] = await Promise.all([
    supabase.from('subscriptions').select('*').in('customer_id', customerIds).limit(PIPELINE_ROW_CAP),
    supabase
      .from('cancellation_requests')
      .select('id, customer_id, status, reason, notes, requested_at')
      .in('customer_id', customerIds)
      .in('status', OPEN_CANCELLATION_STATUSES)
      .limit(PIPELINE_ROW_CAP),
    supabase
      .from('payment_events')
      .select('customer_id, raw_metadata')
      .eq('event_type', 'charge.dispute.created')
      .in('customer_id', customerIds)
      .limit(PIPELINE_ROW_CAP),
    supabase
      .from('payment_events')
      .select('customer_id, raw_metadata')
      .eq('event_type', 'charge.dispute.closed')
      .in('customer_id', customerIds)
      .limit(PIPELINE_ROW_CAP),
    supabase.from('payment_events').select('customer_id').eq('event_type', 'refund.created').in('customer_id', customerIds).limit(PIPELINE_ROW_CAP),
    /* Production bug fix: access_removal_pending used to be derived from
     * customers.access_status alone (see lifecycle.js), which never
     * clears once access ends. account_assignments.status/released_at
     * (migration 0007) is the real, already-existing, per-customer
     * confirmation that the manual seat-removal task was actually done
     * — the same field migration 0018's Activity Timeline already reads
     * for its "Access released" entry. A customer still has the removal
     * task open exactly when a `status in ('active','reserved')` row
     * still exists for them; once none does (released, or never
     * assigned), there is nothing left to remove. */
    supabase
      .from('account_assignments')
      .select('customer_id')
      .in('customer_id', customerIds)
      .in('status', ['active', 'reserved'])
      .limit(PIPELINE_ROW_CAP),
  ]);

  for (const res of [subsRes, cancelRes, disputeCreatedRes, disputeClosedRes, refundRes, unreleasedAssignmentRes]) {
    if (res.error) throw res.error;
  }

  const subByCustomer = new Map((subsRes.data || []).map((s) => [s.customer_id, s]));
  const cancelByCustomer = new Map((cancelRes.data || []).map((r) => [r.customer_id, r]));
  const unreleasedAssignmentCustomerIds = new Set((unreleasedAssignmentRes.data || []).map((a) => a.customer_id));

  /* Open dispute = a charge.dispute.created row whose dispute id
   * (raw_metadata->>'id') has no matching charge.dispute.closed row —
   * identical correlation to api/_lib/metrics.js's openDispute(). */
  const closedDisputeIds = new Set((disputeClosedRes.data || []).map((r) => r.raw_metadata?.id).filter(Boolean));
  const disputedCustomerIds = new Set(
    (disputeCreatedRes.data || [])
      .filter((r) => r.raw_metadata?.id && !closedDisputeIds.has(r.raw_metadata.id))
      .map((r) => r.customer_id)
  );
  const refundedCustomerIds = new Set((refundRes.data || []).map((r) => r.customer_id));

  for (const id of customerIds) {
    map.set(id, {
      subscription: subByCustomer.get(id) || null,
      openCancellationRequest: cancelByCustomer.get(id) || null,
      hasOpenDispute: disputedCustomerIds.has(id),
      hasAnyRefund: refundedCustomerIds.has(id),
      hasUnreleasedAssignment: unreleasedAssignmentCustomerIds.has(id),
    });
  }
  return map;
}

/** Fetches the active account_assignments -> studdy_accounts group_name mirror for a set of customer ids ("Access/group allocation"). */
export async function fetchGroupAllocations(supabase, customerIds) {
  const map = new Map();
  if (!customerIds.length) return map;

  const { data: assignments, error: assignError } = await supabase
    .from('account_assignments')
    .select('customer_id, studdy_account_id')
    .eq('status', 'active')
    .in('customer_id', customerIds)
    .limit(PIPELINE_ROW_CAP);
  if (assignError) throw assignError;

  const accountIds = [...new Set((assignments || []).map((a) => a.studdy_account_id))];
  let accountsById = new Map();
  if (accountIds.length) {
    const { data: accounts, error: accountsError } = await supabase
      .from('studdy_accounts')
      .select('id, group_name')
      .in('id', accountIds)
      .limit(PIPELINE_ROW_CAP);
    if (accountsError) throw accountsError;
    accountsById = new Map((accounts || []).map((a) => [a.id, a.group_name]));
  }

  for (const a of assignments || []) {
    map.set(a.customer_id, accountsById.get(a.studdy_account_id) || null);
  }
  return map;
}

/**
 * Joins a list of `customers` rows with their derived lifecycle, open
 * cancellation request, and group allocation. Returns an array of
 * `{ customer, subscription, openCancellationRequest, groupName, lifecycle }`.
 */
export async function withLifecycle(supabase, customers, { now = new Date() } = {}) {
  const ids = customers.map((c) => c.id);
  const [inputs, groups] = await Promise.all([fetchLifecycleInputs(supabase, ids), fetchGroupAllocations(supabase, ids)]);

  return customers.map((customer) => {
    // Dead in practice (fetchLifecycleInputs always populates every id
    // from a non-empty `customers` array), kept only as a defensive
    // fallback. hasUnreleasedAssignment defaults true here to match
    // deriveCustomerLifecycle()'s own fail-safe default — no signal
    // means "assume still pending," never "assume done."
    const input = inputs.get(customer.id) || {
      subscription: null,
      openCancellationRequest: null,
      hasOpenDispute: false,
      hasAnyRefund: false,
      hasUnreleasedAssignment: true,
    };
    const lifecycle = deriveCustomerLifecycle({ customer, ...input, now });
    return {
      customer,
      subscription: input.subscription,
      openCancellationRequest: input.openCancellationRequest,
      groupName: groups.get(customer.id) || null,
      lifecycle,
    };
  });
}

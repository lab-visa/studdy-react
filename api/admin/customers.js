/**
 * GET /api/admin/customers
 *
 * CRM-3A — Customer & Subscription pipeline list view. Protected,
 * read-only, JS-side filtered/paginated join over customers +
 * subscriptions + cancellation_requests + payment_events + account
 * allocation (api/_lib/customer-pipeline.js) — same style and row cap as
 * api/admin/reconciliation.js and api/_lib/metrics.js, for the same
 * documented reason (current data volume is small; a new Postgres
 * function/view is out of this round's additive-migration-only scope).
 *
 * Query params (all optional):
 *   from, to            — customers.created_at range (ISO 8601). `to` is
 *                          exclusive, matching metrics.js's convention.
 *   country              — exact match, customers.country
 *   salesOwner            — exact match; the literal value "unassigned"
 *                            matches customers.sales_owner IS NULL
 *   accessStatus           — exact match, customers.access_status
 *   plan                    — exact match, subscriptions.plan_type
 *   currency                 — exact match, subscriptions.currency
 *   campaignSource             — matches EITHER latest_utm_source or
 *                                 first_utm_source (case-insensitive)
 *   paymentStatus                — exact match, subscriptions.status
 *   trialOrPaid                    — 'trial' (customers.lifecycle='trial')
 *                                    or 'paid' (lifecycle in
 *                                    converted/retained)
 *   cancellationStatus               — 'requested' (an open
 *                                       cancellation_requests row exists)
 *                                       or 'none'
 *   groupName                          — exact match, assigned Studdy
 *                                        group (account_assignments mirror)
 *   stage                               — exact match against the derived
 *                                         lifecycle.stage string
 *   limit, offset                        — pagination over the (already
 *                                          filtered) result, default 50 /
 *                                          0, capped at PIPELINE_ROW_CAP
 *
 * Every value returned here is already safe for an admin CRM view — no
 * Studdy password/credential (those live only on `leads`/`studdy_accounts`
 * and are never read by this endpoint).
 */
import { getSupabase } from '../_lib/supabase.js';
import { requireAdminSession } from '../_lib/admin-auth.js';
import { withLifecycle, PIPELINE_ROW_CAP } from '../_lib/customer-pipeline.js';

const DEFAULT_PAGE_SIZE = 50;

function matchesTrialOrPaid(customer, value) {
  if (!value) return true;
  if (value === 'trial') return customer.lifecycle === 'trial';
  if (value === 'paid') return customer.lifecycle === 'converted' || customer.lifecycle === 'retained';
  return true;
}

function matchesCampaignSource(customer, value) {
  if (!value) return true;
  const needle = value.toLowerCase();
  const latest = (customer.latest_utm_source || '').toLowerCase();
  const first = (customer.first_utm_source || '').toLowerCase();
  return latest === needle || first === needle;
}

export function applyRowFilters(rows, filters) {
  return rows.filter(({ customer, subscription, openCancellationRequest, groupName, lifecycle }) => {
    if (filters.plan && subscription?.plan_type !== filters.plan) return false;
    if (filters.currency && subscription?.currency !== filters.currency) return false;
    if (filters.paymentStatus && subscription?.status !== filters.paymentStatus) return false;
    if (filters.trialOrPaid && !matchesTrialOrPaid(customer, filters.trialOrPaid)) return false;
    if (filters.cancellationStatus === 'requested' && !openCancellationRequest) return false;
    if (filters.cancellationStatus === 'none' && openCancellationRequest) return false;
    if (filters.groupName && groupName !== filters.groupName) return false;
    if (filters.campaignSource && !matchesCampaignSource(customer, filters.campaignSource)) return false;
    if (filters.stage && lifecycle.stage !== filters.stage) return false;
    return true;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  const adminUser = await requireAdminSession(req, res, supabase);
  if (!adminUser) return;

  const q = req.query || {};
  const limit = Math.min(Number(q.limit) || DEFAULT_PAGE_SIZE, PIPELINE_ROW_CAP);
  const offset = Math.max(Number(q.offset) || 0, 0);

  try {
    let query = supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(PIPELINE_ROW_CAP);
    if (q.from) query = query.gte('created_at', q.from);
    if (q.to) query = query.lt('created_at', q.to);
    if (q.country) query = query.eq('country', q.country);
    if (q.accessStatus) query = query.eq('access_status', q.accessStatus);
    if (q.salesOwner === 'unassigned') query = query.is('sales_owner', null);
    else if (q.salesOwner) query = query.eq('sales_owner', q.salesOwner);

    const { data: customers, error } = await query;
    if (error) throw error;

    const joined = await withLifecycle(supabase, customers || []);
    const filtered = applyRowFilters(joined, q);
    const page = filtered.slice(offset, offset + limit);

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      row_cap: PIPELINE_ROW_CAP,
      total_matching: filtered.length,
      limit,
      offset,
      customers: page.map(({ customer, subscription, openCancellationRequest, groupName, lifecycle }) => ({
        id: customer.id,
        paid_id: customer.paid_id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        country: customer.country,
        sales_owner: customer.sales_owner,
        plan_type: subscription?.plan_type ?? null,
        currency: subscription?.currency ?? null,
        stripe_customer_id: customer.stripe_customer_id,
        stripe_subscription_id: subscription?.stripe_subscription_id ?? null,
        trial_start: subscription?.trial_start ?? null,
        trial_end: subscription?.trial_end ?? null,
        current_period_end: subscription?.current_period_end ?? null,
        first_utm_source: customer.first_utm_source,
        first_utm_campaign: customer.first_utm_campaign,
        latest_utm_source: customer.latest_utm_source,
        latest_utm_campaign: customer.latest_utm_campaign,
        group_name: groupName,
        cancellation_status: openCancellationRequest ? openCancellationRequest.status : null,
        lifecycle,
        created_at: customer.created_at,
      })),
    });
  } catch (err) {
    console.error('admin/customers error:', err);
    return res.status(500).json({ error: 'Customer list query failed' });
  }
}

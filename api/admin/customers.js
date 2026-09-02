/**
 * GET /api/admin/customers
 *
 * CRM-3A — Customer & Subscription pipeline list view. Scalable
 * server-side pagination: every filter (including free-text search)
 * and the total count are computed entirely in Postgres, over the
 * FULL customer population, via the search_customer_pipeline(...)
 * function (migration 0017) — there is no PIPELINE_ROW_CAP-style
 * ceiling on how many customers this endpoint can see or count.
 *
 * Query params (all optional):
 *   search                — matches name/email/phone/paid_id (substring,
 *                            case-insensitive), server-side, across the
 *                            full population, not just the current page.
 *   from, to               — customers.created_at range (ISO 8601). `to`
 *                            is exclusive, matching metrics.js's convention.
 *   country                 — exact match, customers.country
 *   salesOwner               — exact match; the literal value "unassigned"
 *                              matches customers.sales_owner IS NULL
 *   accessStatus              — exact match, customers.access_status
 *   plan                       — exact match, subscriptions.plan_type
 *   currency                    — exact match, subscriptions.currency
 *   campaignSource                — matches EITHER latest_utm_source or
 *                                    first_utm_source (case-insensitive)
 *   paymentStatus                   — exact match, subscriptions.status
 *   trialOrPaid                       — 'trial' (customers.lifecycle='trial')
 *                                       or 'paid' (lifecycle in
 *                                       converted/retained)
 *   cancellationStatus                  — 'requested' (an open
 *                                          cancellation_requests row exists)
 *                                          or 'none'
 *   groupName                             — exact match, assigned Studdy
 *                                           group (account_assignments mirror)
 *   stage                                  — exact match against the derived
 *                                            lifecycle.stage string
 *   page                                    — 1-based page number, default 1.
 *                                            Invalid/non-numeric/negative/
 *                                            non-integer values fall back to
 *                                            1, never a crash or a garbage page.
 *   pageSize                                 — must be exactly 50 or 100;
 *                                              any other value (including
 *                                              missing) falls back to 50.
 *                                              Deliberately not "whatever
 *                                              number the client asks for" —
 *                                              see the CRM-3A pagination
 *                                              requirement this satisfies.
 *
 * Every value returned here is already safe for an admin CRM view — no
 * Studdy password/credential (those live only on `leads`/`studdy_accounts`
 * and are never read by this endpoint).
 */
import { getSupabase } from '../_lib/supabase.js';
import { requireAdminSession } from '../_lib/admin-auth.js';

export const ALLOWED_PAGE_SIZES = [50, 100];
const DEFAULT_PAGE_SIZE = 50;

export function parsePageSize(raw) {
  const n = Number(raw);
  return ALLOWED_PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE;
}

// (page - 1) * pageSize is passed to Postgres as an int4 OFFSET
// (max ~2.147 billion) — an absurdly large page number (a typo, a
// scraping attempt, whatever) must degrade to "no results on this
// page" like any other out-of-range page, never a raw 500 from an
// integer-overflow error at the database. 10,000,000 is far beyond
// any real total_pages this table will ever have, while
// (10,000,000 - 1) * 100 stays safely inside int4 range.
const MAX_PAGE = 10_000_000;

export function parsePage(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  const adminUser = await requireAdminSession(req, res, supabase);
  if (!adminUser) return;

  const q = req.query || {};
  const pageSize = parsePageSize(q.pageSize);
  const page = parsePage(q.page);
  const offset = (page - 1) * pageSize;

  try {
    const { data, error } = await supabase.rpc('search_customer_pipeline', {
      p_search: q.search || null,
      p_from: q.from || null,
      p_to: q.to || null,
      p_country: q.country || null,
      p_sales_owner: q.salesOwner && q.salesOwner !== 'unassigned' ? q.salesOwner : null,
      p_sales_owner_unassigned: q.salesOwner === 'unassigned',
      p_access_status: q.accessStatus || null,
      p_plan: q.plan || null,
      p_currency: q.currency || null,
      p_campaign_source: q.campaignSource || null,
      p_payment_status: q.paymentStatus || null,
      p_trial_or_paid: q.trialOrPaid || null,
      p_cancellation_status: q.cancellationStatus || null,
      p_group_name: q.groupName || null,
      p_stage: q.stage || null,
      p_limit: pageSize,
      p_offset: offset,
    });
    if (error) throw error;

    const rows = data || [];
    // The "marker row" case (search_customer_pipeline's own LEFT JOIN
    // technique, see migration 0017): a page with zero matching
    // customers still returns exactly one row, carrying only
    // total_count with every customer field null. Detect and drop it
    // here rather than showing a single all-blank row.
    const isMarkerOnly = rows.length === 1 && rows[0].id === null;
    const customers = isMarkerOnly ? [] : rows;
    const totalCount = rows.length ? Number(rows[0].total_count) : 0;
    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      total_matching: totalCount,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      has_previous: page > 1,
      has_next: totalPages > 0 && page < totalPages,
      customers: customers.map((r) => ({
        id: r.id,
        paid_id: r.paid_id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        country: r.country,
        sales_owner: r.sales_owner,
        plan_type: r.plan_type,
        currency: r.currency,
        stripe_customer_id: r.stripe_customer_id,
        stripe_subscription_id: r.stripe_subscription_id,
        trial_start: r.trial_start,
        trial_end: r.trial_end,
        current_period_end: r.current_period_end,
        first_utm_source: r.first_utm_source,
        first_utm_campaign: r.first_utm_campaign,
        latest_utm_source: r.latest_utm_source,
        latest_utm_campaign: r.latest_utm_campaign,
        group_name: r.group_name,
        cancellation_status: r.cancellation_status,
        lifecycle: r.lifecycle,
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error('admin/customers error:', err);
    return res.status(500).json({ error: 'Customer list query failed' });
  }
}

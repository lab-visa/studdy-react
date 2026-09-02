/**
 * CRM-2B — TypeScript shape of the GET /api/admin/metrics response.
 *
 * Deliberately mirrors api/_lib/metrics.js's Metric Contract exactly —
 * every field here is one the backend actually returns today. No field is
 * added "for later" and no field here is optional-but-secretly-required;
 * the dashboard must never assume a shape the API doesn't guarantee.
 *
 * `type` on every metric result is the SAME classification the backend
 * already computes (event_period / current_state / cohort) — the
 * dashboard reads this field to decide "does the selected date range
 * affect this number", it never re-derives that classification itself
 * (see MetricType usage in src/utils/metricsFormat.ts).
 */

export type MetricType = 'event_period' | 'current_state' | 'cohort';

export interface EventPeriodCount {
  metric: string;
  type: 'event_period';
  from: string | null;
  to: string | null;
  count: number;
}

export interface CurrentStateCount {
  metric: string;
  type: 'current_state';
  count: number;
}

export interface ByCurrencyResult {
  metric: string;
  type: 'event_period';
  from: string | null;
  to: string | null;
  by_currency: Record<string, number>;
}

export interface OpenDisputeResult {
  metric: 'open_dispute';
  type: 'current_state';
  count: number;
  items: Array<{
    dispute_id: string | null;
    customer_id: string | null;
    amount: number | null;
    currency: string | null;
    occurred_at: string;
  }>;
}

export interface ChurnResult {
  metric: 'churn';
  type: 'event_period';
  from: string | null;
  to: string | null;
  voluntary_churn: number;
  involuntary_churn: number;
  total_churn: number;
  limitation: string;
}

export interface AllocatedSeatsResult {
  metric: 'allocated_seats';
  type: 'current_state';
  allocated_seats: number;
  total_capacity: number;
  remaining_capacity: number;
  by_group: Array<{
    group_name: string;
    max_capacity: number;
    active_customer_count: number;
    remaining: number;
  }>;
}

export interface FunnelTrafficResult {
  metric: 'funnel_traffic';
  type: 'event_period';
  from: string | null;
  to: string | null;
  website_visit: number;
  checkout: number;
  cta: number;
}

export interface TrialToPaid14dResult {
  metric: 'trial_to_paid_14d';
  type: 'cohort';
  cohort_from: string;
  cohort_to: string;
  window_days: number;
  still_maturing: boolean;
  measurable_cohort_size: number;
  converted_within_14d: number;
  conversion_pct: number | null;
  legacy_excluded_count: number;
  legacy_excluded_customer_ids: string[];
  note: string;
}

export interface AdminMetrics {
  trial_started: EventPeriodCount;
  active_trial: CurrentStateCount;
  trial_to_paid_14d: TrialToPaid14dResult | null;
  new_paid_customer: EventPeriodCount;
  active_paid_customer: CurrentStateCount;
  successful_payment: EventPeriodCount;
  failed_payment: EventPeriodCount;
  gross_revenue: ByCurrencyResult;
  refund_amount: ByCurrencyResult;
  net_revenue: ByCurrencyResult;
  open_dispute: OpenDisputeResult;
  cancellation_requested: EventPeriodCount;
  cancelled_customer: EventPeriodCount;
  churn: ChurnResult;
  allocated_seats: AllocatedSeatsResult;
  funnel_traffic: FunnelTrafficResult;
}

export interface AdminMetricsResponse {
  generated_at: string;
  range: { from?: string; to?: string };
  metrics: AdminMetrics;
}

/**
 * CRM-3A — TypeScript shapes for the Customer & Subscription pipeline
 * endpoints (api/admin/customers.js, customer-detail.js, today-actions.js).
 * Mirrors api/_lib/lifecycle.js's deriveCustomerLifecycle() output exactly
 * — stored/calculated/flags kept as three distinct objects here too, never
 * flattened into one ambiguous status string.
 */

export interface LifecycleResult {
  stage: string;
  stored: {
    subscription_status: string | null;
    access_status: string | null;
    lifecycle: string | null;
    cancel_at_period_end: boolean;
  };
  calculated: {
    trial_ending_today: boolean;
    payment_due_today: boolean;
    cancelling_at_period_end: boolean;
  };
  flags: {
    cancellation_requested: boolean;
    disputed: boolean;
    refunded: boolean;
    access_removal_pending: boolean;
  };
}

export interface CustomerListRow {
  id: string;
  paid_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  sales_owner: string | null;
  plan_type: string | null;
  currency: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_start: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  first_utm_source: string | null;
  first_utm_campaign: string | null;
  latest_utm_source: string | null;
  latest_utm_campaign: string | null;
  group_name: string | null;
  cancellation_status: string | null;
  lifecycle: LifecycleResult;
  created_at: string;
}

export interface CustomersListResponse {
  generated_at: string;
  row_cap: number;
  total_matching: number;
  limit: number;
  offset: number;
  customers: CustomerListRow[];
}

export interface CustomerFilters {
  from?: string;
  to?: string;
  country?: string;
  salesOwner?: string;
  accessStatus?: string;
  plan?: string;
  currency?: string;
  campaignSource?: string;
  paymentStatus?: string;
  trialOrPaid?: string;
  cancellationStatus?: string;
  groupName?: string;
  stage?: string;
}

export interface ActivityTimelineEntry {
  type: string;
  label: string;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  reason?: string | null;
  occurred_at: string;
  occurred_at_ist: string | null;
}

export interface CustomerDetailResponse {
  generated_at: string;
  customer: {
    id: string;
    paid_id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    state_province: string | null;
    sales_owner: string | null;
    stripe_customer_id: string | null;
    attribution: {
      first_touch: TouchInfo;
      latest_touch: TouchInfo;
    };
  };
  subscription: {
    stripe_subscription_id: string;
    plan_type: string | null;
    currency: string | null;
    status: string;
    trial_start: string | null;
    trial_start_ist: string | null;
    trial_end: string | null;
    trial_end_ist: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    current_period_end_ist: string | null;
    cancel_at: string | null;
    cancel_at_period_end: boolean;
    cancelled_at: string | null;
    ended_at: string | null;
  } | null;
  billing: {
    expected_amount: number | null;
    expected_currency: string | null;
    next_expected_payment_date: string | null;
    next_expected_payment_date_ist: string | null;
    source: string;
  };
  access: {
    access_status: string | null;
    group_name: string | null;
  };
  cancellation: {
    open_request: { id: string; status: string; reason: string | null; requested_at: string } | null;
    history: Array<{ id: string; status: string; reason: string | null; requested_at: string }>;
  };
  lifecycle: LifecycleResult;
  activity_timeline: ActivityTimelineEntry[];
  row_cap: number;
}

interface TouchInfo {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  ghl_contact_id: string | null;
  ghl_campaign_id: string | null;
  at: string | null;
  at_ist: string | null;
}

export interface TodayActionsResponse {
  generated_at: string;
  today_ist: string;
  row_cap: number;
  trials_ending_today: Array<{ customer_id: string; paid_id: string; name: string | null; email: string | null; sales_owner: string | null; trial_end_ist: string | null }>;
  payments_expected_today: Array<{ customer_id: string; paid_id: string; name: string | null; email: string | null; sales_owner: string | null; currency: string | null; current_period_end_ist: string | null }>;
  failed_payments: Array<{ customer_id: string; paid_id: string; name: string | null; email: string | null; sales_owner: string | null; currency: string | null }>;
  cancellation_requests: Array<{ customer_id: string; paid_id: string; name: string | null; email: string | null; sales_owner: string | null; status: string; requested_at_ist: string | null }>;
  access_removal_pending: { items: Array<{ customer_id: string; paid_id: string; name: string | null; email: string | null; sales_owner: string | null }>; note: string };
  password_change_tasks: { items: unknown[]; note: string };
  overdue: {
    cancellation_requests: Array<{ customer_id: string; paid_id: string; name: string | null; email: string | null; overdue_threshold_days: number }>;
    grace_period_payments: Array<{ customer_id: string; paid_id: string; name: string | null; email: string | null; grace_period_days: number }>;
    note: string;
  };
  checkout_started: {
    items: Array<{ lead_id: string; latest_utm_source: string | null; latest_utm_campaign: string | null; clicked_at_ist: string | null }>;
    lookback_days: number;
    note: string;
  };
}

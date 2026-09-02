/**
 * CRM-2B — Section 1: Executive KPI overview. The at-a-glance headline
 * numbers; deeper breakdowns (revenue by currency, churn split, capacity
 * by group) live in their own sections below, not duplicated here.
 */
import KpiCard from '../KpiCard';
import { formatCount, formatPercent } from '../../../utils/metricsFormat';
import type { AdminMetrics } from '../../../types/adminMetrics';

interface ExecutiveOverviewProps {
  metrics: AdminMetrics;
}

export default function ExecutiveOverview({ metrics }: ExecutiveOverviewProps) {
  const t2p = metrics.trial_to_paid_14d;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Trials started" value={formatCount(metrics.trial_started.count)} kind="event_period" />
      <KpiCard label="Active trials" value={formatCount(metrics.active_trial.count)} kind="current_state" />
      <KpiCard label="New paid customers" value={formatCount(metrics.new_paid_customer.count)} kind="event_period" />
      <KpiCard label="Active paid customers" value={formatCount(metrics.active_paid_customer.count)} kind="current_state" />

      <KpiCard label="Successful payments" value={formatCount(metrics.successful_payment.count)} kind="event_period" />
      <KpiCard
        label="Failed payments"
        value={formatCount(metrics.failed_payment.count)}
        kind="event_period"
        tone={metrics.failed_payment.count > 0 ? 'warning' : 'default'}
      />
      <KpiCard
        label="Trial → paid (14d)"
        value={
          t2p === null
            ? 'Select a cohort'
            : t2p.still_maturing
              ? 'Still maturing'
              : formatPercent(t2p.conversion_pct)
        }
        kind="cohort"
        hint={
          t2p === null
            ? 'Pick a cohort range below to compute this'
            : t2p.still_maturing
              ? 'This cohort’s 14-day window hasn’t elapsed yet'
              : `${formatCount(t2p.converted_within_14d)} of ${formatCount(t2p.measurable_cohort_size)} measurable trials`
        }
      />
      <KpiCard
        label="Open disputes"
        value={formatCount(metrics.open_dispute.count)}
        kind="current_state"
        tone={metrics.open_dispute.count > 0 ? 'warning' : 'default'}
      />
    </div>
  );
}

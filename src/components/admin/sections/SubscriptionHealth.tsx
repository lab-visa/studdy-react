/**
 * CRM-2B — Section: subscription/customer health snapshot. Combines two
 * current-state counts (who's active right now) with one event-period
 * count (cancellation requests filed in the selected period) — each
 * clearly labeled so the two kinds of number are never confused.
 */
import SectionCard from '../SectionCard';
import { formatCount } from '../../../utils/metricsFormat';
import type { AdminMetrics } from '../../../types/adminMetrics';

interface SubscriptionHealthProps {
  metrics: AdminMetrics;
}

export default function SubscriptionHealth({ metrics }: SubscriptionHealthProps) {
  return (
    <SectionCard title="Subscription & customer health">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <HealthStat label="Active trials" sub="Live" value={metrics.active_trial.count} />
        <HealthStat label="Active paid customers" sub="Live" value={metrics.active_paid_customer.count} />
        <HealthStat label="Cancellation requests" sub="Selected period" value={metrics.cancellation_requested.count} />
      </div>
    </SectionCard>
  );
}

function HealthStat({ label, sub, value }: { label: string; sub: string; value: number }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--dim)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11.5px] font-bold" style={{ color: 'var(--soft)' }}>
          {label}
        </span>
        <span
          className="text-[9.5px] font-black uppercase tracking-wide rounded-full px-1.5 py-0.5"
          style={{ background: '#fff', color: 'var(--soft)', border: '1px solid var(--border)' }}
        >
          {sub}
        </span>
      </div>
      <div className="font-black text-[22px]" style={{ color: 'var(--ink)' }}>
        {formatCount(value)}
      </div>
    </div>
  );
}

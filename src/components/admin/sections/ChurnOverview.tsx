/**
 * CRM-2B — Section: cancellation & churn overview. Counts only — no
 * churn_rate anywhere, matching api/_lib/metrics.js's churn() contract
 * (it deliberately doesn't compute one, and this component must never
 * fabricate one client-side either).
 */
import SectionCard from '../SectionCard';
import { formatCount } from '../../../utils/metricsFormat';
import type { AdminMetrics } from '../../../types/adminMetrics';

interface ChurnOverviewProps {
  metrics: AdminMetrics;
}

export default function ChurnOverview({ metrics }: ChurnOverviewProps) {
  const churn = metrics.churn;

  return (
    <SectionCard title="Cancellations & churn" description="Event counts for the selected period">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
        <Stat label="Cancellation requests" value={metrics.cancellation_requested.count} />
        <Stat label="Cancelled customers" value={metrics.cancelled_customer.count} />
        <Stat label="Voluntary churn" value={churn.voluntary_churn} />
        <Stat label="Involuntary churn" value={churn.involuntary_churn} />
      </div>
      <div
        className="rounded-xl px-3.5 py-2.5 flex items-center justify-between mb-3"
        style={{ background: 'var(--dim)' }}
      >
        <span className="text-[12.5px] font-bold" style={{ color: 'var(--ink)' }}>
          Total churn
        </span>
        <span className="font-black text-[16px]" style={{ color: 'var(--ink)' }}>
          {formatCount(churn.total_churn)}
        </span>
      </div>
      <p className="text-[11.5px] font-medium leading-snug" style={{ color: 'var(--soft)' }}>
        {churn.limitation}
      </p>
    </SectionCard>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[11px] font-bold" style={{ color: 'var(--soft)' }}>
        {label}
      </div>
      <div className="font-black text-[19px]" style={{ color: 'var(--ink)' }}>
        {formatCount(value)}
      </div>
    </div>
  );
}

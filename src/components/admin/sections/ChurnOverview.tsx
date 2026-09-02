/**
 * CRM-2B — Section: cancellation & churn overview. Counts only — no
 * churn_rate anywhere, matching api/_lib/metrics.js's churn() contract
 * (it deliberately doesn't compute one, and this component must never
 * fabricate one client-side either). Visual refinement: a voluntary vs.
 * involuntary donut alongside the counts — an empty state (not a
 * misleading full circle) when total_churn is 0.
 */
import SectionCard from '../SectionCard';
import DonutChart from '../charts/DonutChart';
import { formatCount } from '../../../utils/metricsFormat';
import type { AdminMetrics } from '../../../types/adminMetrics';

interface ChurnOverviewProps {
  metrics: AdminMetrics;
}

export default function ChurnOverview({ metrics }: ChurnOverviewProps) {
  const churn = metrics.churn;

  return (
    <SectionCard title="Cancellations & churn" description="Event counts for the selected period">
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">
        <DonutChart
          title="Voluntary vs. involuntary churn"
          srDescription={`${formatCount(churn.voluntary_churn)} voluntary, ${formatCount(churn.involuntary_churn)} involuntary, ${formatCount(churn.total_churn)} total churn for the selected period.`}
          segments={[
            { key: 'voluntary', label: 'Voluntary churn', value: churn.voluntary_churn, tone: 'gradient' },
            { key: 'involuntary', label: 'Involuntary churn', value: churn.involuntary_churn, tone: 'gradientAlt' },
          ]}
          centerValue={churn.total_churn > 0 ? formatCount(churn.total_churn) : undefined}
          centerLabel={churn.total_churn > 0 ? 'total churn' : undefined}
          emptyMessage="No churn in this period"
        />

        <div className="flex flex-col gap-3 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Cancellation requests" value={metrics.cancellation_requested.count} />
            <Stat label="Cancelled customers" value={metrics.cancelled_customer.count} />
            <Stat label="Voluntary churn" value={churn.voluntary_churn} />
            <Stat label="Involuntary churn" value={churn.involuntary_churn} />
          </div>
          <div
            className="rounded-xl px-3.5 py-2.5 flex items-center justify-between"
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
        </div>
      </div>
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

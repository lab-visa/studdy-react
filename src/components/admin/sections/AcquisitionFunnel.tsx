/**
 * CRM-2B — Section 2: acquisition funnel, website visits through paid.
 * Every stage is a real, separately-sourced CRM-2A count for the SAME
 * selected date range (funnel_traffic for visits/CTA/checkout,
 * trial_started and new_paid_customer for the last two stages) —
 * presented together as a funnel because they share one time window,
 * not because any single query computes a "funnel". No conversion
 * percentage between stages is fabricated; each bar's width is scaled
 * to the top-of-funnel count purely for visual comparison.
 */
import SectionCard from '../SectionCard';
import { formatCount } from '../../../utils/metricsFormat';
import type { AdminMetrics } from '../../../types/adminMetrics';

interface AcquisitionFunnelProps {
  metrics: AdminMetrics;
}

export default function AcquisitionFunnel({ metrics }: AcquisitionFunnelProps) {
  const stages = [
    { label: 'Website visits', count: metrics.funnel_traffic.website_visit },
    { label: 'CTA clicks', count: metrics.funnel_traffic.cta },
    { label: 'Checkout viewed', count: metrics.funnel_traffic.checkout },
    { label: 'Trials started', count: metrics.trial_started.count },
    { label: 'New paid customers', count: metrics.new_paid_customer.count },
  ];
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <SectionCard title="Acquisition funnel" description="Visits → CTA → checkout → trial → paid, for the selected period">
      <div className="flex flex-col gap-3">
        {stages.map((s) => (
          <div key={s.label}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[12.5px] font-bold" style={{ color: 'var(--ink)' }}>
                {s.label}
              </span>
              <span className="text-[13px] font-black" style={{ color: 'var(--ink)' }}>
                {formatCount(s.count)}
              </span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--dim)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, (s.count / max) * 100)}%`, background: 'var(--grad)' }}
              />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

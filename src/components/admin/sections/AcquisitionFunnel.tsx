/**
 * CRM-2B — Section: acquisition funnel, website visits through paid.
 * Every stage is a real, separately-sourced CRM-2A count for the SAME
 * selected date range (funnel_traffic for visits/CTA/checkout,
 * trial_started and new_paid_customer for the last two stages) —
 * presented together as a funnel because they share one time window,
 * not because any single query computes a "funnel". Visual refinement:
 * rendered by FunnelChart as a gradient, centered/tapered stepped
 * funnel with real stage-to-stage conversion badges (never fabricated —
 * see stageConversionPct).
 */
import SectionCard from '../SectionCard';
import FunnelChart from '../charts/FunnelChart';
import type { AdminMetrics } from '../../../types/adminMetrics';

interface AcquisitionFunnelProps {
  metrics: AdminMetrics;
}

export default function AcquisitionFunnel({ metrics }: AcquisitionFunnelProps) {
  const stages = [
    { key: 'visits', label: 'Website visits', count: metrics.funnel_traffic.website_visit },
    { key: 'cta', label: 'CTA clicks', count: metrics.funnel_traffic.cta },
    { key: 'checkout', label: 'Checkout viewed', count: metrics.funnel_traffic.checkout },
    { key: 'trial', label: 'Trials started', count: metrics.trial_started.count },
    { key: 'paid', label: 'New paid customers', count: metrics.new_paid_customer.count },
  ];

  return (
    <SectionCard title="Acquisition funnel" description="Visits → CTA → checkout → trial → paid, for the selected period">
      <FunnelChart stages={stages} />
    </SectionCard>
  );
}

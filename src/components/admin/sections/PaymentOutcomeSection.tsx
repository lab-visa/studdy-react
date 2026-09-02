/**
 * CRM-2B (visual refinement) — payment-event outcome donut: successful
 * vs. failed payment EVENTS (counts), for the selected period. This is
 * event-COUNT data, not a revenue figure — never described as "lost
 * revenue" (failed_payment carries no dollar meaning here; actual
 * failed-payment amounts, where stored, live in the ledger, not this
 * chart). An honest empty state renders when both counts are zero.
 */
import SectionCard from '../SectionCard';
import DonutChart from '../charts/DonutChart';
import { paymentSuccessPct } from '../../../utils/chartMath';
import { formatCount, formatPercent } from '../../../utils/metricsFormat';
import type { AdminMetrics } from '../../../types/adminMetrics';

interface PaymentOutcomeSectionProps {
  metrics: AdminMetrics;
}

export default function PaymentOutcomeSection({ metrics }: PaymentOutcomeSectionProps) {
  const successful = metrics.successful_payment.count;
  const failed = metrics.failed_payment.count;
  const successPct = paymentSuccessPct(successful, failed);

  return (
    <SectionCard
      title="Payment outcomes"
      description="Payment-event counts for the selected period — not a revenue figure"
    >
      <DonutChart
        title="Successful vs. failed payment events"
        srDescription={`${formatCount(successful)} successful, ${formatCount(failed)} failed, for the selected period. Success rate ${formatPercent(successPct)}.`}
        segments={[
          { key: 'successful', label: 'Successful payments', value: successful, tone: 'gradient' },
          { key: 'failed', label: 'Failed payments', value: failed, tone: 'neutral' },
        ]}
        centerValue={successPct !== null ? formatPercent(successPct) : undefined}
        centerLabel={successPct !== null ? 'success' : undefined}
        emptyMessage="No payment events in this period"
      />
    </SectionCard>
  );
}

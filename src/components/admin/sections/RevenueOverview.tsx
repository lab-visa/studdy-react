/**
 * CRM-2B — Section 3: payment & revenue overview, always by ORIGINAL
 * currency — gross, refunds and net are three separate CurrencyBreakdown
 * blocks, never summed into one number.
 */
import SectionCard from '../SectionCard';
import CurrencyBreakdown from '../CurrencyBreakdown';
import type { AdminMetrics } from '../../../types/adminMetrics';

interface RevenueOverviewProps {
  metrics: AdminMetrics;
}

export default function RevenueOverview({ metrics }: RevenueOverviewProps) {
  return (
    <SectionCard
      title="Payments & revenue"
      description="By original transaction currency for the selected period — currencies are never combined"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--soft)' }}>
            Gross revenue
          </div>
          <CurrencyBreakdown byCurrency={metrics.gross_revenue.by_currency} />
        </div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--soft)' }}>
            Refunds
          </div>
          <CurrencyBreakdown byCurrency={metrics.refund_amount.by_currency} emptyLabel="No refunds in this period" />
        </div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--soft)' }}>
            Net revenue
          </div>
          <CurrencyBreakdown byCurrency={metrics.net_revenue.by_currency} />
        </div>
      </div>
    </SectionCard>
  );
}

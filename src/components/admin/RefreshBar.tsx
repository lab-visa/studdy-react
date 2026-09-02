/**
 * CRM-2B — "data as of" timestamp + manual refresh. Deliberately the only
 * way data re-fetches besides a range/cohort change — no polling
 * interval, so no uncontrolled repeated API calls.
 */
import { RefreshCw } from 'lucide-react';
import { formatIstTimestamp } from '../../utils/metricsFormat';

interface RefreshBarProps {
  generatedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function RefreshBar({ generatedAt, refreshing, onRefresh }: RefreshBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-[12px] font-semibold" style={{ color: 'var(--soft)' }}>
        Data as of {formatIstTimestamp(generatedAt)}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="gost py-1.5! px-3! text-[12.5px]!"
      >
        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}

/**
 * CRM-2B — trial_to_paid_14d cohort selector. Deliberately separate from
 * RangeControls: this is a COHORT window (customers who started trial in
 * this range), not an event-period filter, and per the CRM-2A metric
 * contract it must never be silently defaulted or derived from the main
 * date range — the user must explicitly pick or confirm it, every time.
 */
import { lastMatureCohortMonth, isValidCustomRange } from '../../utils/reportingRange';

interface CohortControlProps {
  cohortFrom: string;
  cohortTo: string;
  onChange: (cohortFrom: string, cohortTo: string) => void;
}

export default function CohortControl({ cohortFrom, cohortTo, onChange }: CohortControlProps) {
  const preset = lastMatureCohortMonth();
  const hasSelection = Boolean(cohortFrom && cohortTo);
  const isInvalid = hasSelection && !isValidCustomRange(cohortFrom, cohortTo);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(preset.cohortFrom, preset.cohortTo)}
          className="rounded-full px-3.5 py-1.5 text-[12.5px] font-bold"
          style={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)' }}
        >
          Use {preset.label}
        </button>
        <input
          type="date"
          value={cohortFrom}
          onChange={(e) => onChange(e.target.value, cohortTo)}
          aria-label="Cohort start date (trial start)"
          className="rounded-lg px-2 py-1 text-[12.5px] font-semibold"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}
        />
        <span style={{ color: 'var(--soft)' }}>–</span>
        <input
          type="date"
          value={cohortTo}
          onChange={(e) => onChange(cohortFrom, e.target.value)}
          aria-label="Cohort end date (trial start)"
          className="rounded-lg px-2 py-1 text-[12.5px] font-semibold"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}
        />
        {hasSelection && (
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="text-[12px] font-bold underline"
            style={{ color: 'var(--soft)' }}
          >
            Clear
          </button>
        )}
      </div>
      {isInvalid && (
        <p role="alert" className="text-[12px] font-bold" style={{ color: 'var(--warn-text)' }}>
          End date must be on or after the start date.
        </p>
      )}
    </div>
  );
}

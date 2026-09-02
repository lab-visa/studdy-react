/**
 * CRM-2B — reporting-period control. Presets apply immediately; "Custom"
 * reveals two date inputs and only applies once both are filled with a
 * valid, non-inverted range (isValidCustomRange) — never a guessed
 * partial range.
 */
import { Calendar } from 'lucide-react';
import type { RangePreset } from '../../utils/reportingRange';
import { isValidCustomRange } from '../../utils/reportingRange';

const PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

interface RangeControlsProps {
  preset: RangePreset;
  onPresetChange: (preset: RangePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
  rangeLabel: string;
}

export default function RangeControls({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomChange,
  rangeLabel,
}: RangeControlsProps) {
  const customIsInvalid = preset === 'custom' && customFrom && customTo && !isValidCustomRange(customFrom, customTo);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Reporting period">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onPresetChange(p.value)}
            aria-pressed={preset === p.value}
            className="rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
            style={
              preset === p.value
                ? { background: 'var(--grad)', color: '#fff' }
                : { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)' }
            }
          >
            {p.label}
          </button>
        ))}

        {preset === 'custom' && (
          <span className="flex items-center gap-1.5 ml-1">
            <Calendar size={14} style={{ color: 'var(--soft)' }} />
            <input
              type="date"
              value={customFrom}
              onChange={(e) => onCustomChange(e.target.value, customTo)}
              aria-label="Custom range start date"
              className="rounded-lg px-2 py-1 text-[12.5px] font-semibold"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}
            />
            <span style={{ color: 'var(--soft)' }}>–</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => onCustomChange(customFrom, e.target.value)}
              aria-label="Custom range end date"
              className="rounded-lg px-2 py-1 text-[12.5px] font-semibold"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}
            />
          </span>
        )}
      </div>

      {customIsInvalid ? (
        <p role="alert" className="text-[12px] font-bold" style={{ color: 'var(--warn-text)' }}>
          End date must be on or after the start date.
        </p>
      ) : (
        <p className="text-[12px] font-semibold" style={{ color: 'var(--soft)' }}>
          {rangeLabel} · applies to metrics affected by the selected period
        </p>
      )}
    </div>
  );
}

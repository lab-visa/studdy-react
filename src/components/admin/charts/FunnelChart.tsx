/**
 * CRM-2B (visual refinement) — acquisition funnel as a centered, tapered
 * "stepped funnel" (each stage bar is centered and scaled to the
 * top-of-funnel count, so the silhouette actually reads as a funnel,
 * not just a bar chart). Gradient-filled per the Studdy brand direction.
 * Stage-to-stage conversion is only ever shown when mathematically
 * valid (stageConversionPct returns null, never a divide-by-zero, when
 * the previous stage is 0 — the badge is simply omitted then).
 * Pure divs, not SVG — resizes naturally at any width, no fixed
 * dimensions to break on mobile, and the same markup collapses cleanly
 * to a stacked list on narrow screens.
 */
import { ChevronDown } from 'lucide-react';
import { funnelBarWidthPct, stageConversionPct } from '../../../utils/chartMath';

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

interface FunnelChartProps {
  stages: FunnelStage[];
}

export default function FunnelChart({ stages }: FunnelChartProps) {
  const maxCount = Math.max(1, ...stages.map((s) => s.count));
  const srSummary = stages.map((s) => `${s.label}: ${new Intl.NumberFormat('en-US').format(s.count)}`).join(', ');

  return (
    <div role="img" aria-label={`Acquisition funnel — ${srSummary}`} className="flex flex-col items-center gap-1 w-full">
      {stages.map((stage, i) => {
        const widthPct = funnelBarWidthPct(stage.count, maxCount);
        const prevStage = i > 0 ? stages[i - 1] : null;
        const conversionPct = prevStage ? stageConversionPct(stage.count, prevStage.count) : null;

        return (
          <div key={stage.key} className="w-full flex flex-col items-center">
            {i > 0 && (
              <div className="flex flex-col items-center py-1" aria-hidden="true">
                <ChevronDown size={14} style={{ color: 'var(--soft)' }} />
                {conversionPct !== null && (
                  <span
                    className="text-[10.5px] font-black rounded-full px-2 py-0.5 mt-0.5"
                    style={{ background: 'var(--dim)', color: 'var(--soft)', border: '1px solid var(--border)' }}
                  >
                    {conversionPct.toFixed(1)}%
                  </span>
                )}
              </div>
            )}
            <div
              className="rounded-xl px-4 py-3 flex items-center justify-between gap-4 transition-[width]"
              style={{
                width: `${widthPct}%`,
                minWidth: 'min(100%, 220px)',
                background: 'var(--grad)',
                boxShadow: '0 6px 18px rgba(140,121,224,.22)',
              }}
            >
              <span className="text-[12.5px] font-bold text-white truncate">{stage.label}</span>
              <span className="text-[15px] font-black text-white shrink-0">
                {new Intl.NumberFormat('en-US').format(stage.count)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

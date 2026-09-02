/**
 * CRM-2B (visual refinement) — reusable, accessible SVG donut/ring chart.
 *
 * Design rules this component enforces so every caller gets them for
 * free: an all-zero/empty input renders an explicit "no data" ring
 * (never a full or misleadingly-colored circle), every segment's exact
 * value is always printed as real text (never color-only), the chart
 * scales via viewBox (no hard-coded pixel width that breaks on mobile),
 * and it works in both themes because every non-brand color it uses is
 * a CSS custom property (var(--dim) for the empty track, var(--ink)/
 * var(--soft) for text) rather than a literal hex.
 */
import { useId } from 'react';
import { computeDonutArcs, type DonutSegmentInput } from '../../../utils/chartMath';

export interface DonutSegment extends DonutSegmentInput {
  label: string;
  /** 'gradient' = full Studdy pink->blue sweep (reserve for the primary/positive segment). 'gradientAlt' = a narrower slice of the same gradient (a secondary-but-still-brand segment). 'neutral' = plain gray track color. */
  tone: 'gradient' | 'gradientAlt' | 'neutral';
}

interface DonutChartProps {
  title: string;
  /** Extra context for screen readers beyond the visible title, e.g. "42 of 100, selected period". */
  srDescription: string;
  segments: DonutSegment[];
  /** Shown in the ring's center, e.g. a percentage or the primary count. */
  centerValue?: string;
  centerLabel?: string;
  emptyMessage?: string;
  size?: number;
}

const STROKE_WIDTH = 14;

export default function DonutChart({
  title,
  srDescription,
  segments,
  centerValue,
  centerLabel,
  emptyMessage = 'No data yet',
  size = 148,
}: DonutChartProps) {
  const gradId = useId();
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const arcs = computeDonutArcs(
    segments.map((s) => ({ key: s.key, value: s.value })),
    circumference
  );
  const isEmpty = arcs.length === 0;

  const toneStroke = (tone: DonutSegment['tone']) => {
    if (tone === 'gradient') return `url(#${gradId}-full)`;
    if (tone === 'gradientAlt') return `url(#${gradId}-alt)`;
    return 'var(--border)';
  };

  return (
    <figure className="flex flex-col items-center gap-3 m-0">
      <div className="relative shrink-0" style={{ width: size, maxWidth: '100%', aspectRatio: '1 / 1' }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full" role="img" aria-labelledby={`${gradId}-title`} aria-describedby={`${gradId}-desc`}>
          <title id={`${gradId}-title`}>{title}</title>
          <desc id={`${gradId}-desc`}>{isEmpty ? `${title}: ${emptyMessage}.` : srDescription}</desc>
          <defs>
            <linearGradient id={`${gradId}-full`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF55B6" />
              <stop offset="35%" stopColor="#C765C7" />
              <stop offset="65%" stopColor="#8C79E0" />
              <stop offset="100%" stopColor="#25A8F4" />
            </linearGradient>
            <linearGradient id={`${gradId}-alt`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8C79E0" />
              <stop offset="100%" stopColor="#25A8F4" />
            </linearGradient>
          </defs>

          {isEmpty ? (
            <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--dim)" strokeWidth={STROKE_WIDTH} />
          ) : (
            <>
              <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--dim)" strokeWidth={STROKE_WIDTH} />
              {arcs.map((arc, i) => (
                <circle
                  key={arc.key}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={toneStroke(segments[i].tone)}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={arc.dasharray}
                  strokeDashoffset={arc.dashoffset}
                  transform={`rotate(-90 ${center} ${center})`}
                  strokeLinecap="butt"
                />
              ))}
            </>
          )}
        </svg>

        {(centerValue || isEmpty) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
            <span className="font-black text-[18px] leading-none" style={{ color: 'var(--ink)' }}>
              {isEmpty ? '—' : centerValue}
            </span>
            {(centerLabel || isEmpty) && (
              <span className="text-[10px] font-bold mt-1 leading-tight" style={{ color: 'var(--soft)' }}>
                {isEmpty ? emptyMessage : centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Exact values, always as real text — never color-only. */}
      <figcaption className="w-full flex flex-col gap-1.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-3 text-[12px]">
            <span className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--ink)' }}>
              <span
                aria-hidden="true"
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  background:
                    s.tone === 'neutral'
                      ? 'var(--border)'
                      : s.tone === 'gradientAlt'
                        ? 'linear-gradient(90deg,#8C79E0,#25A8F4)'
                        : 'linear-gradient(90deg,#EF55B6,#25A8F4)',
                }}
              />
              {s.label}
            </span>
            <span className="font-black" style={{ color: 'var(--ink)' }}>
              {new Intl.NumberFormat('en-US').format(s.value)}
            </span>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

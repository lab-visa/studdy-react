/**
 * CRM-2B (visual refinement) — pure, JSX-free chart math. Kept separate
 * from the SVG components so the arithmetic that actually decides what
 * gets drawn — stage-to-stage conversion, donut arc geometry, "is this
 * genuinely empty" — is unit-testable the same way
 * test/cases/admin-dashboard-logic.test.mjs already tests reportingRange
 * and metricsFormat. No rendering, no React, no fabricated fallback:
 * every function here either returns a real computed number or null —
 * never a guessed placeholder.
 */

/**
 * Stage-to-stage conversion percentage for the acquisition funnel. Never
 * divides by zero — returns null (caller must omit the badge entirely,
 * not render a fabricated 0%/100%) when the previous stage's count is 0.
 */
export function stageConversionPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return (current / previous) * 100;
}

/**
 * A funnel bar's visual width, as a percentage of the top-of-funnel
 * stage. Floors at a small minimum so a genuinely non-zero stage never
 * renders as an invisible sliver, and returns 0 (not NaN) when the whole
 * funnel is empty.
 */
export function funnelBarWidthPct(count: number, maxCount: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(maxCount) || maxCount <= 0) return 0;
  if (count <= 0) return 0;
  return Math.max(4, (count / maxCount) * 100);
}

export interface DonutSegmentInput {
  key: string;
  value: number;
}

export interface DonutArc {
  key: string;
  value: number;
  /** Fraction of the whole circle this segment occupies, 0..1. */
  fraction: number;
  /** SVG stroke-dasharray "<arcLength> <remainder>", in the same units as circumference. */
  dasharray: string;
  /** SVG stroke-dashoffset, negative cumulative offset so segments chain without gaps/overlaps. */
  dashoffset: number;
}

/**
 * Computes stroke-dasharray/dashoffset for each segment of a ring chart,
 * given a circle's circumference. Segments with a value of 0 still
 * produce a (zero-length) arc rather than being silently dropped, so
 * caller code that zips this array back up against segment labels never
 * gets misaligned. Returns [] for a non-positive circumference or an
 * empty/all-zero input — callers must treat that as "no data", not draw
 * a full circle for any single segment.
 */
export function computeDonutArcs(segments: DonutSegmentInput[], circumference: number): DonutArc[] {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  if (!Number.isFinite(circumference) || circumference <= 0 || total <= 0) return [];

  let cumulative = 0;
  return segments.map((s) => {
    const value = Math.max(0, s.value);
    const fraction = value / total;
    const arcLength = fraction * circumference;
    const arc: DonutArc = {
      key: s.key,
      value,
      fraction,
      dasharray: `${arcLength} ${Math.max(0, circumference - arcLength)}`,
      dashoffset: -cumulative + 0, // '+ 0' normalizes a -0 result (first segment) to 0
    };
    cumulative += arcLength;
    return arc;
  });
}

/** Success percentage of successful vs. failed payment EVENTS (counts) — null (never fabricated) when both are zero. */
export function paymentSuccessPct(successful: number, failed: number): number | null {
  const total = successful + failed;
  if (total <= 0) return null;
  return (successful / total) * 100;
}

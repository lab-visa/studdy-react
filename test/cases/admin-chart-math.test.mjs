/**
 * CRM-2B (visual refinement) — pure chart-math coverage for
 * src/utils/chartMath.ts: funnel conversion percentages, donut arc
 * geometry, and payment success percentage. Same JSX-free, real
 * imported-and-executed testing approach as
 * test/cases/admin-dashboard-logic.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stageConversionPct,
  funnelBarWidthPct,
  computeDonutArcs,
  paymentSuccessPct,
} from '../../src/utils/chartMath.ts';

/* ─────────────────────────── stageConversionPct ────────────────────────── */

test('stageConversionPct computes a normal stage-to-stage rate', () => {
  assert.equal(stageConversionPct(50, 200), 25);
  assert.equal(stageConversionPct(200, 200), 100);
});

test('stageConversionPct never divides by zero — returns null, not Infinity/NaN, when the previous stage is 0', () => {
  assert.equal(stageConversionPct(0, 0), null);
  assert.equal(stageConversionPct(5, 0), null);
});

test('stageConversionPct returns null for non-finite input rather than throwing or fabricating', () => {
  assert.equal(stageConversionPct(NaN, 10), null);
  assert.equal(stageConversionPct(5, NaN), null);
});

/* ─────────────────────────── funnelBarWidthPct ─────────────────────────── */

test('funnelBarWidthPct scales proportionally to the top-of-funnel stage', () => {
  assert.equal(funnelBarWidthPct(100, 100), 100);
  assert.equal(funnelBarWidthPct(50, 100), 50);
});

test('funnelBarWidthPct returns exactly 0 (never NaN) for a zero/empty funnel', () => {
  assert.equal(funnelBarWidthPct(0, 0), 0);
  assert.equal(funnelBarWidthPct(0, 100), 0);
});

test('funnelBarWidthPct floors a real non-zero stage to a minimum visible width', () => {
  const width = funnelBarWidthPct(1, 100000);
  assert.ok(width >= 4, 'a genuinely non-zero stage must never render as an invisible sliver');
});

/* ─────────────────────────── computeDonutArcs ──────────────────────────── */

test('computeDonutArcs splits the circumference exactly proportionally, with no gap/overlap between segments', () => {
  const arcs = computeDonutArcs(
    [
      { key: 'a', value: 75 },
      { key: 'b', value: 25 },
    ],
    100
  );
  assert.equal(arcs.length, 2);
  assert.equal(arcs[0].fraction, 0.75);
  assert.equal(arcs[1].fraction, 0.25);
  assert.equal(arcs[0].dashoffset, 0);
  assert.equal(arcs[1].dashoffset, -75, 'second segment must start exactly where the first ends');
});

test('computeDonutArcs returns [] for an all-zero input — caller must render an explicit empty state, never a misleading full circle', () => {
  assert.deepEqual(computeDonutArcs([{ key: 'a', value: 0 }, { key: 'b', value: 0 }], 100), []);
  assert.deepEqual(computeDonutArcs([], 100), []);
});

test('computeDonutArcs returns [] for a non-positive circumference rather than dividing by zero', () => {
  assert.deepEqual(computeDonutArcs([{ key: 'a', value: 10 }], 0), []);
});

test('computeDonutArcs keeps a zero-value segment in the output (as a zero-length arc), so labels never get misaligned by a dropped entry', () => {
  const arcs = computeDonutArcs(
    [
      { key: 'a', value: 10 },
      { key: 'b', value: 0 },
    ],
    100
  );
  assert.equal(arcs.length, 2);
  assert.equal(arcs[1].key, 'b');
  assert.equal(arcs[1].fraction, 0);
});

/* ─────────────────────────── paymentSuccessPct ─────────────────────────── */

test('paymentSuccessPct computes the success share of total payment events', () => {
  assert.equal(paymentSuccessPct(90, 10), 90);
  assert.equal(paymentSuccessPct(0, 10), 0, 'a real 0% success must render as 0, not "Not available"');
});

test('paymentSuccessPct returns null (never fabricated) when both successful and failed are zero', () => {
  assert.equal(paymentSuccessPct(0, 0), null);
});

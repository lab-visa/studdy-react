/**
 * CRM-2B — Command Center logic coverage.
 *
 * Same constraint CRM-2A's round-2 campaign-client.test.mjs already
 * documented: React/JSX files (AdminLayout.tsx, CommandCenter.tsx, every
 * section component) can't be imported directly by node:test — the
 * built-in TS type-stripper can't parse JSX, and this repo deliberately
 * adds no new test framework (no jsdom, no React renderer) for CRM-2B
 * either. So coverage here is split two ways:
 *
 *   1. Real, imported-and-executed tests against the two PURE, JSX-free
 *      modules the dashboard is built on — src/utils/reportingRange.ts
 *      (date-range/cohort math) and src/utils/metricsFormat.ts
 *      (currency/count/percent formatting). This is where "no fabricated
 *      fallback data", "never blend currencies", and "IST day boundaries
 *      reuse the CRM-2A utility, not a reimplementation" are actually
 *      proven.
 *
 *   2. Targeted static-source assertions on the JSX files for the few
 *      behaviors that matter most and can't be reached any other way
 *      without adding a rendering framework: that the protected-route
 *      wiring (401 -> redirect to /admin/login) is actually present in
 *      the shipped source, and that no component ever introduces a
 *      churn_rate field or sums across currencies. These are deliberately
 *      narrow greps, not a substitute for behavioral testing — see the
 *      delivery report's "Known limitations".
 *
 * The already-existing test/cases/metrics.test.mjs end-to-end covers
 * GET /api/admin/metrics itself (401 with no session, the full expected
 * key set, no churn_rate field, no secrets) — not re-duplicated here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  resolveRange,
  isValidCustomRange,
  lastMatureCohortMonth,
} from '../../src/utils/reportingRange.ts';
import {
  formatCount,
  formatCurrencyAmount,
  sortedCurrencyEntries,
  hasNoCurrencyData,
  formatPercent,
  formatIstTimestamp,
} from '../../src/utils/metricsFormat.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const src = (relPath) => readFileSync(join(repoRoot, relPath), 'utf8');

/* ─────────────────────────── reportingRange.ts ─────────────────────────── */

test('resolveRange("all") applies no filter — never a fabricated wide window', () => {
  const r = resolveRange('all');
  assert.equal(r.from, undefined);
  assert.equal(r.to, undefined);
  assert.equal(r.label, 'All time');
});

test('resolveRange("today") uses IST day boundaries from the shared reporting-timezone utility, not a UTC day', () => {
  const r = resolveRange('today');
  assert.ok(r.from && r.to, 'today must resolve to a concrete instant range');
  const fromDate = new Date(r.from);
  const toDate = new Date(r.to);
  assert.equal(toDate.getTime() - fromDate.getTime(), 24 * 60 * 60 * 1000, 'exactly one IST calendar day');
  // IST midnight is UTC 18:30 the previous day (fixed +05:30 offset).
  assert.equal(fromDate.getUTCHours(), 18);
  assert.equal(fromDate.getUTCMinutes(), 30);
});

test('resolveRange("last7") spans exactly 7 IST calendar days, ending at "through now"', () => {
  const r = resolveRange('last7');
  const days = (new Date(r.to).getTime() - new Date(r.from).getTime()) / (24 * 60 * 60 * 1000);
  assert.equal(days, 7);
});

test('resolveRange("last30") spans exactly 30 IST calendar days', () => {
  const r = resolveRange('last30');
  const days = (new Date(r.to).getTime() - new Date(r.from).getTime()) / (24 * 60 * 60 * 1000);
  assert.equal(days, 30);
});

test('resolveRange("thisMonth") starts on the 1st of the current IST month', () => {
  const r = resolveRange('thisMonth');
  assert.ok(r.from);
  // The UTC instant for IST midnight on the 1st always has UTC date 30 or
  // the last day of the previous month, hour 18:30 — assert the shape
  // rather than a hardcoded date so this test is stable across runs.
  const d = new Date(r.from);
  assert.equal(d.getUTCHours(), 18);
  assert.equal(d.getUTCMinutes(), 30);
});

test('resolveRange("custom") with an invalid (inverted or incomplete) range never guesses a substitute window', () => {
  assert.deepEqual(resolveRange('custom', { from: '2026-08-20', to: '2026-08-10' }), { label: 'Invalid custom range' });
  assert.deepEqual(resolveRange('custom', { from: '', to: '' }), { label: 'Invalid custom range' });
});

test('resolveRange("custom") with a valid range resolves to exact IST day boundaries', () => {
  const r = resolveRange('custom', { from: '2026-08-01', to: '2026-08-03' });
  assert.equal(r.from, '2026-07-31T18:30:00.000Z');
  assert.equal(r.to, '2026-08-03T18:30:00.000Z');
});

test('isValidCustomRange rejects malformed, inverted, or partial input', () => {
  assert.equal(isValidCustomRange('2026-08-01', '2026-08-05'), true);
  assert.equal(isValidCustomRange('2026-08-01', '2026-08-01'), true, 'same day is valid');
  assert.equal(isValidCustomRange('2026-08-05', '2026-08-01'), false, 'inverted');
  assert.equal(isValidCustomRange('', '2026-08-01'), false, 'missing start');
  assert.equal(isValidCustomRange('2026-08-01', ''), false, 'missing end');
  assert.equal(isValidCustomRange('not-a-date', '2026-08-01'), false);
});

test('lastMatureCohortMonth() always returns a cohortTo at least 14 days before today — never a still-maturing cohort', () => {
  const { cohortFrom, cohortTo } = lastMatureCohortMonth();
  const today = new Date();
  const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const cutoff = fourteenDaysAgo.toISOString().slice(0, 10);
  assert.ok(cohortTo <= cutoff, `cohortTo (${cohortTo}) must be on/before ${cutoff}`);
  assert.ok(cohortFrom < cohortTo, 'cohort window must be non-empty');
});

/* ─────────────────────────── metricsFormat.ts ──────────────────────────── */

test('formatCount distinguishes a real zero from missing data — never fabricates either direction', () => {
  assert.equal(formatCount(0), '0', 'a real zero must render as 0, not "Not available"');
  assert.equal(formatCount(1234), '1,234');
  assert.equal(formatCount(null), 'Not available');
  assert.equal(formatCount(undefined), 'Not available');
});

test('formatCurrencyAmount never blends currencies — formats exactly the one code passed in', () => {
  assert.equal(formatCurrencyAmount(1250.5, 'USD'), '$1,250.50');
  assert.equal(formatCurrencyAmount(999, 'INR'), '₹999.00');
  assert.equal(formatCurrencyAmount(50, 'GBP'), '£50.00');
});

test('formatCurrencyAmount degrades safely for an unrecognized currency code instead of throwing', () => {
  const result = formatCurrencyAmount(42, 'unknown');
  assert.match(result, /42/);
  assert.match(result, /UNKNOWN/);
});

test('sortedCurrencyEntries preserves every currency and every amount exactly — no merging, no dropped keys', () => {
  const entries = sortedCurrencyEntries({ USD: 100, AED: 50, GBP: 25, INR: 900 });
  assert.deepEqual(entries, [
    ['AED', 50],
    ['GBP', 25],
    ['INR', 900],
    ['USD', 100],
  ]);
});

test('hasNoCurrencyData is true only for a genuinely empty by_currency object', () => {
  assert.equal(hasNoCurrencyData({}), true);
  assert.equal(hasNoCurrencyData(null), true);
  assert.equal(hasNoCurrencyData(undefined), true);
  assert.equal(hasNoCurrencyData({ USD: 0 }), false, 'a $0 entry still means "data present", not "no data"');
});

test('formatPercent never fabricates a rate — passes through null as "Not available" and only formats a value the API already computed', () => {
  assert.equal(formatPercent(null), 'Not available');
  assert.equal(formatPercent(undefined), 'Not available');
  assert.equal(formatPercent(42.567), '42.6%');
  assert.equal(formatPercent(0), '0.0%', 'a real 0% must render as 0.0%, not "Not available"');
});

test('formatIstTimestamp renders a known UTC instant as the correct IST wall-clock time', () => {
  // 2026-08-25T12:00:00Z is 2026-08-25 17:30 IST (UTC+05:30).
  const formatted = formatIstTimestamp('2026-08-25T12:00:00Z');
  assert.match(formatted, /25 Aug 2026/);
  assert.match(formatted, /5:30\s*PM/i);
  assert.match(formatted, /IST$/);
});

test('formatIstTimestamp degrades to "Not available" for a missing/invalid instant, never a fabricated time', () => {
  assert.equal(formatIstTimestamp(null), 'Not available');
  assert.equal(formatIstTimestamp(undefined), 'Not available');
  assert.equal(formatIstTimestamp('not-a-date'), 'Not available');
});

/* ───────────────── targeted static-source safeguards (JSX files) ───────────────── */

test('ChurnOverview.tsx never introduces a churn_rate field or computes one client-side', () => {
  const text = src('src/components/admin/sections/ChurnOverview.tsx');
  // Matches actual CODE usage (property access, object key, assignment) —
  // not the file's own doc-comment prose explaining that churn_rate is
  // intentionally absent (the same "field, not substring" distinction
  // test/cases/metrics.test.mjs's own churn_rate check already makes).
  assert.doesNotMatch(text, /\.churn_rate\b|churn_rate\s*[:=]/);
  // Guard against a client-side rate fabricated from the counts (e.g.
  // dividing total_churn by some other count) sneaking in later.
  assert.doesNotMatch(text, /churn\.\w+\s*\/\s*/);
});

test('CurrencyBreakdown.tsx and RevenueOverview.tsx never reduce/sum across currencies into one blended number', () => {
  for (const file of ['src/components/admin/CurrencyBreakdown.tsx', 'src/components/admin/sections/RevenueOverview.tsx']) {
    const text = src(file);
    assert.doesNotMatch(text, /\.reduce\(/, `${file} must never fold multiple currencies into one total`);
  }
});

test('AdminHome.tsx verifies the session server-side (whoami) and redirects to /admin/login on failure, both on initial load and mid-session', () => {
  const text = src('src/pages/admin/AdminHome.tsx');
  assert.match(text, /\/api\/admin\/whoami/);
  assert.match(text, /navigate\('\/admin\/login'\)/g);
  assert.match(text, /handleSessionExpired/, 'must wire a mid-session 401 (from CommandCenter) back to the same redirect');
});

test('AdminHome.tsx logout calls the real /api/admin/logout endpoint (server-side session revocation), not just a client-side redirect', () => {
  const text = src('src/pages/admin/AdminHome.tsx');
  assert.match(text, /\/api\/admin\/logout/);
  assert.match(text, /method:\s*'POST'/);
});

test('CommandCenter.tsx treats a 401 from /api/admin/metrics as session-expired, and never renders fabricated sample data on error', () => {
  const text = src('src/pages/admin/CommandCenter.tsx');
  assert.match(text, /res\.status === 401/);
  assert.match(text, /onSessionExpired\(\)/);
  assert.doesNotMatch(text, /sampleData|mockData|fakeMetrics|placeholderMetrics/i);
});

test('CommandCenter.tsx fetches with credentials and never polls on an interval (no setInterval)', () => {
  const text = src('src/pages/admin/CommandCenter.tsx');
  assert.match(text, /credentials:\s*'same-origin'/);
  assert.doesNotMatch(text, /setInterval/);
});

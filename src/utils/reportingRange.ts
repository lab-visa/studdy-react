/**
 * CRM-2B — reporting-period preset calculations for the Command Center's
 * date-range control.
 *
 * Per the CRM-2B handoff: "Reuse the existing CRM-2A reporting-timezone
 * utility. Do not independently recreate timezone logic." api/_lib/
 * reporting-timezone.js is plain, dependency-free JS (only Intl/Date, no
 * Node built-ins) — safe to import directly into the client bundle, so
 * this file imports it rather than reimplementing IST day-boundary math.
 *
 * All presets are IST CALENDAR-DAY windows (matching how every CRM-2A
 * event-period metric and site_traffic_daily already bucket "a day") —
 * never a rolling 24h/168h window from the current instant. `to` is
 * always the exclusive upper bound the API expects (`.lt(column, to)`),
 * so "through today" uses tomorrow's IST midnight as `to`.
 */
import { reportingDayFor, reportingDayBoundsUtc, todayReportingDay } from '../../api/_lib/reporting-timezone.js';

export type RangePreset = 'all' | 'today' | 'last7' | 'last30' | 'thisMonth' | 'custom';

export interface ResolvedRange {
  /** ISO instant, inclusive lower bound, or undefined for "all time". */
  from?: string;
  /** ISO instant, exclusive upper bound, or undefined for "all time". */
  to?: string;
  /** Human-readable label for display, e.g. "Last 7 days (Aug 20 – Aug 26, IST)". */
  label: string;
}

function addDays(day: string, delta: number): string {
  // day is 'YYYY-MM-DD'. Construct at IST noon (not midnight) before
  // shifting, so a +/- N-day shift can never land on the wrong calendar
  // day due to a UTC offset rounding edge.
  const d = new Date(`${day}T12:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + delta);
  return reportingDayFor(d);
}

function formatDayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Tomorrow's IST midnight, as an ISO instant — the exclusive `to` bound covering "through right now". */
function throughNowBound(): string {
  const tomorrow = addDays(todayReportingDay(), 1);
  return reportingDayBoundsUtc(tomorrow).startUtc.toISOString();
}

/**
 * Resolves a preset (or an explicit custom 'YYYY-MM-DD' pair) into the
 * {from, to} instant bounds the API expects. Returns {} (both undefined)
 * for 'all' — the honest "no filter" case, never a fabricated wide range.
 */
export function resolveRange(preset: RangePreset, custom?: { from: string; to: string }): ResolvedRange {
  const today = todayReportingDay();

  switch (preset) {
    case 'all':
      return { label: 'All time' };

    case 'today': {
      const { startUtc, endUtc } = reportingDayBoundsUtc(today);
      return { from: startUtc.toISOString(), to: endUtc.toISOString(), label: `Today (${formatDayLabel(today)}, IST)` };
    }

    case 'last7': {
      const start = addDays(today, -6);
      const { startUtc } = reportingDayBoundsUtc(start);
      return {
        from: startUtc.toISOString(),
        to: throughNowBound(),
        label: `Last 7 days (${formatDayLabel(start)} – ${formatDayLabel(today)}, IST)`,
      };
    }

    case 'last30': {
      const start = addDays(today, -29);
      const { startUtc } = reportingDayBoundsUtc(start);
      return {
        from: startUtc.toISOString(),
        to: throughNowBound(),
        label: `Last 30 days (${formatDayLabel(start)} – ${formatDayLabel(today)}, IST)`,
      };
    }

    case 'thisMonth': {
      const start = `${today.slice(0, 7)}-01`;
      const { startUtc } = reportingDayBoundsUtc(start);
      return {
        from: startUtc.toISOString(),
        to: throughNowBound(),
        label: `This month (${formatDayLabel(start)} – ${formatDayLabel(today)}, IST)`,
      };
    }

    case 'custom': {
      if (!custom || !custom.from || !custom.to || custom.from > custom.to) {
        // Invalid/incomplete custom range — never silently substitute a
        // guessed window. Caller (RangeControls) must treat this as an
        // error state and not fetch.
        return { label: 'Invalid custom range' };
      }
      const { startUtc: fromUtc } = reportingDayBoundsUtc(custom.from);
      const { endUtc: toUtc } = reportingDayBoundsUtc(custom.to);
      return {
        from: fromUtc.toISOString(),
        to: toUtc.toISOString(),
        label: `${formatDayLabel(custom.from)} – ${formatDayLabel(custom.to)}, IST (custom)`,
      };
    }

    default:
      return { label: 'All time' };
  }
}

/** True only for a fully-specified, non-inverted 'YYYY-MM-DD' pair. */
export function isValidCustomRange(from: string, to: string): boolean {
  const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
  return dayPattern.test(from) && dayPattern.test(to) && from <= to;
}

// Mirrors api/_lib/metrics.js's TRIAL_TO_PAID_WINDOW_DAYS. This is only a
// UI convenience preset — the authoritative 14-day window is enforced
// server-side in trialToPaid14d() regardless of which cohort range the
// user actually picks.
const COHORT_MATURITY_DAYS = 14;

function monthStart(year: number, monthIndex0: number): string {
  // monthIndex0 is 0-based (0 = January); Date.UTC normalizes any
  // under/overflow (e.g. monthIndex0 = -1 correctly rolls back a year).
  const d = new Date(Date.UTC(year, monthIndex0, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * A full-calendar-month cohort preset, chosen so cohortTo is always at
 * least COHORT_MATURITY_DAYS in the past — never a still-maturing cohort,
 * regardless of what day of the month this is clicked on. Offered as a
 * convenience button; never applied automatically/silently. The Command
 * Center still requires an explicit user action (clicking this, or
 * entering a custom cohort range) before trial_to_paid_14d is ever
 * requested — see CommandCenter.tsx.
 */
export function lastMatureCohortMonth(): { cohortFrom: string; cohortTo: string; label: string } {
  const today = todayReportingDay();
  const [ty, tm] = today.split('-').map(Number); // tm is 1-based

  // Start from "last full month": [month before this one, this month).
  let cohortFrom = monthStart(ty, tm - 2);
  let cohortTo = monthStart(ty, tm - 1);

  const daysSinceCohortTo = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${cohortTo}T00:00:00Z`)) / (24 * 60 * 60 * 1000);
  if (daysSinceCohortTo < COHORT_MATURITY_DAYS) {
    // Early in the month — last month alone hasn't matured yet. Shift the
    // whole window back one more month so it always has.
    cohortTo = cohortFrom;
    cohortFrom = monthStart(ty, tm - 3);
  }

  return { cohortFrom, cohortTo, label: `${formatDayLabel(cohortFrom)} – ${formatDayLabel(cohortTo)} (last full month)` };
}

/**
 * CRM-2A — shared Asia/Kolkata reporting-timezone utility.
 *
 * StuddyLab's business reporting timezone is Asia/Kolkata (IST, UTC+5:30),
 * approved explicitly during CRM-2A design review. Every table's
 * timestamps stay stored as UTC (`timestamptz`, unchanged) — only
 * DISPLAY/day-bucketing logic converts to IST, and only through this one
 * shared utility. No dashboard/API/metric function computes "today" or a
 * date boundary any other way (e.g. via the server's local Date object or
 * a browser's implicit timezone).
 *
 * IMPORTANT — historical data: `site_traffic_daily.day` rows written
 * before this file existed were bucketed using
 * `new Date().toISOString().slice(0,10)`, which is UTC, not IST. Those
 * historical rows are NEVER rebucketed or rewritten — see
 * api/track-event.js's own comment for the forward-only cutover. Any
 * metric reading `site_traffic_daily` across a date range that spans the
 * cutover must treat pre-cutover days as UTC-bucketed legacy data, not
 * silently claim IST throughout.
 */

const REPORTING_TIME_ZONE = 'Asia/Kolkata';

/**
 * Returns the current business day, in Asia/Kolkata, as 'YYYY-MM-DD'.
 * Uses Intl.DateTimeFormat's en-CA locale, which formats as YYYY-MM-DD
 * directly — no manual offset arithmetic (which would silently break if
 * IST's fixed +5:30 offset were ever wrong, e.g. around a DST rule change
 * for some other zone reused by mistake).
 */
export function reportingDayFor(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORTING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // 'en-CA' => 'YYYY-MM-DD'
}

/** Today's business day, in Asia/Kolkata, as 'YYYY-MM-DD'. */
export function todayReportingDay() {
  return reportingDayFor(new Date());
}

/**
 * Returns the UTC instant boundaries [startUtc, endUtc) for a given
 * Asia/Kolkata calendar day — used when a metric needs to filter a
 * timestamptz column (e.g. payment_events.occurred_at) to "this IST
 * business day" rather than a UTC calendar day. Computed by constructing
 * the IST midnight boundary from its own offset (+05:30, fixed, no DST)
 * rather than string-parsing formatter output, so it's exact.
 */
export function reportingDayBoundsUtc(day) {
  // day is 'YYYY-MM-DD' in Asia/Kolkata. IST is a fixed UTC+05:30 offset
  // (no daylight saving), so IST midnight for this day is this exact UTC
  // instant:
  const startUtc = new Date(`${day}T00:00:00+05:30`);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
}

/**
 * CRM-3A — formats a timestamp for display in Asia/Kolkata, e.g.
 * "2 Sep 2026, 6:45 pm IST". Used anywhere a customer's activity
 * timeline/date is shown to Vish (Customer & Subscription pipeline,
 * Today's Actions) — per the explicit requirement that all dates and
 * operational timing display in IST. Returns null for a null/invalid
 * input rather than throwing or showing "Invalid Date".
 */
export function formatIstDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: REPORTING_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${formatter.format(date)} IST`;
}

export const REPORTING_TIMEZONE = REPORTING_TIME_ZONE;

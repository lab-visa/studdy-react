/**
 * CRM-2A — Asia/Kolkata reporting-timezone utility.
 *
 * Pure-function tests, no database needed: proves the IST day boundary is
 * computed correctly and genuinely differs from a naive UTC
 * `toISOString().slice(0,10)` bucketing at the exact times of day where
 * they diverge — which is precisely the bug being fixed in
 * api/track-event.js (see tracking-http.test.mjs for the handler-level
 * proof that the fix is actually wired in).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportingDayFor, reportingDayBoundsUtc, REPORTING_TIMEZONE } from '../../api/_lib/reporting-timezone.js';

test('REPORTING_TIMEZONE is Asia/Kolkata, per the approved design', () => {
  assert.equal(REPORTING_TIMEZONE, 'Asia/Kolkata');
});

test('a UTC instant late in the UTC day but past IST midnight buckets into the NEXT IST day, not the UTC day', () => {
  // 2026-01-01T19:00:00Z is still "2026-01-01" by UTC slicing, but IST is
  // UTC+05:30, so local time there is 2026-01-02T00:30:00 — the next day.
  const instant = new Date('2026-01-01T19:00:00.000Z');
  const utcDay = instant.toISOString().slice(0, 10); // the OLD, buggy bucketing
  const istDay = reportingDayFor(instant);

  assert.equal(utcDay, '2026-01-01');
  assert.equal(istDay, '2026-01-02', 'IST is 5.5 hours ahead of UTC, so 19:00 UTC is already the next calendar day in Kolkata');
  assert.notEqual(istDay, utcDay, 'this is exactly the case the UTC-bucketing bug got wrong');
});

test('a UTC instant early in the UTC day still buckets into the SAME IST day when IST midnight has not yet passed', () => {
  // 2026-06-15T10:00:00Z + 5:30 = 2026-06-15T15:30 IST — same calendar day both ways.
  const instant = new Date('2026-06-15T10:00:00.000Z');
  assert.equal(reportingDayFor(instant), '2026-06-15');
  assert.equal(instant.toISOString().slice(0, 10), '2026-06-15');
});

test('reportingDayBoundsUtc round-trips: the UTC start of an IST day, converted back, reads as that same IST day', () => {
  const { startUtc, endUtc } = reportingDayBoundsUtc('2026-03-10');
  assert.equal(reportingDayFor(startUtc), '2026-03-10');
  // One millisecond before the end boundary is still the same IST day;
  // the end boundary itself belongs to the next one.
  assert.equal(reportingDayFor(new Date(endUtc.getTime() - 1)), '2026-03-10');
  assert.equal(reportingDayFor(endUtc), '2026-03-11');
  // Exactly 24 hours apart (IST has no DST, unlike some zones).
  assert.equal(endUtc.getTime() - startUtc.getTime(), 24 * 60 * 60 * 1000);
});

test('IST midnight for a given day is UTC 18:30 the previous day (the fixed +05:30 offset)', () => {
  const { startUtc } = reportingDayBoundsUtc('2026-09-02');
  assert.equal(startUtc.toISOString(), '2026-09-01T18:30:00.000Z');
});

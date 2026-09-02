/**
 * Type declarations for reporting-timezone.js, so CRM-2B's client-side
 * code (src/utils/reportingRange.ts) can import the actual CRM-2A
 * runtime module — not a reimplementation — under tsc's checked build.
 * api/ is plain JS and outside src/'s tsconfig "include", so TS has no
 * other way to type this import; this file adds ZERO runtime behavior,
 * it only describes the .js file's existing exported shape.
 */
export declare function reportingDayFor(date?: Date): string;
export declare function todayReportingDay(): string;
export declare function reportingDayBoundsUtc(day: string): { startUtc: Date; endUtc: Date };
export declare const REPORTING_TIMEZONE: string;

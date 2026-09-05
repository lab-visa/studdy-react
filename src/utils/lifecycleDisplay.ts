/**
 * CRM-3A — pure display-tone mapping for a lifecycle stage string, split
 * out of any component (same rationale as checkoutLink.ts/tracking.ts)
 * so it's directly unit-testable with node:test, no JSX/renderer needed.
 * Never invents a stage — only maps stage strings api/_lib/lifecycle.js
 * can actually produce to a visual tone; an unrecognized string still
 * renders, just with the neutral tone, so a future new stage never
 * crashes the UI.
 */
export type StageTone = 'neutral' | 'positive' | 'warning' | 'danger';

const TONE_BY_STAGE: Record<string, StageTone> = {
  'Trial active': 'neutral',
  'Trial ending today': 'warning',
  'Payment due today': 'warning',
  'Active paid': 'positive',
  'Payment failed': 'danger',
  'Retry / grace period': 'warning',
  'Cancelling at period end': 'warning',
  'Cancelled': 'danger',
  'Access removed': 'danger',
  'No subscription synced': 'neutral',
};

export function stageTone(stage: string): StageTone {
  return TONE_BY_STAGE[stage] ?? 'neutral';
}

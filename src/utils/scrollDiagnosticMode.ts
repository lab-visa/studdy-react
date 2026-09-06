export type ScrollTestMode = 'control' | 'no-scrub' | 'stable-height' | 'combined';

const TEST_MODES = new Set<ScrollTestMode>([
  'control',
  'no-scrub',
  'stable-height',
  'combined',
]);

export function parseScrollTestMode(search: string): ScrollTestMode {
  const value = new URLSearchParams(search).get('st_test');
  return value && TEST_MODES.has(value as ScrollTestMode)
    ? value as ScrollTestMode
    : 'control';
}

export function getScrollTestMode(): ScrollTestMode {
  return typeof window === 'undefined'
    ? 'control'
    : parseScrollTestMode(window.location.search);
}

export function shouldDisableScrollScrub(mode = getScrollTestMode()): boolean {
  return mode === 'no-scrub' || mode === 'combined';
}

export function shouldUseStableStoryHeight(mode = getScrollTestMode()): boolean {
  return mode === 'stable-height' || mode === 'combined';
}

export function isScrollDiagnosticVisible(search?: string): boolean {
  const resolved = search ?? (typeof window === 'undefined' ? '' : window.location.search);
  return new URLSearchParams(resolved).get('st_debug') === '1';
}

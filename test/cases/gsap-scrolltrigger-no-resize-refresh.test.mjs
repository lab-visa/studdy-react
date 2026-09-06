/**
 * Regression guard for the WhatsApp in-app-browser scroll-jump bug
 * (Sep 2026), round 2.
 *
 * PR #8 removed MobileStory's forced scroll-snap, but the jump
 * persisted — confirmed on a fresh, cache-busted WhatsApp CTA link,
 * ruling out stale caching. Reading the installed gsap/ScrollTrigger
 * source directly (see src/utils/gsapSetup.ts's own comment for the
 * full trace) showed ScrollTrigger auto-refreshes every registered
 * trigger's start/end pixel positions on window "resize", and its
 * built-in mobile protection only ignores that when the viewport
 * height swings by 25% or less — a threshold WhatsApp's in-app-
 * browser chrome can still exceed while scrolling.
 *
 * The first fix attempt excluded "resize" from autoRefreshEvents
 * unconditionally, which also killed refresh on a real desktop window
 * resize and a genuine phone orientation change — too broad. The
 * revised fix replaces the built-in resize handling with
 * shouldRefreshForResize(): a small pure function (no DOM, no timers)
 * that decides, per resize event, whether it's a real layout change
 * or just a touch device's browser chrome animating. Exported
 * specifically so this decision logic can be exercised directly here
 * rather than only checked by reading the source.
 *
 * If any of these tests start failing, treat it as either a
 * regression of the original bug (height-only touch resize refreshing
 * again) or a regression of the fix from round 1 (desktop/orientation
 * resize silently no longer refreshing) — never as a stale check to
 * delete.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { shouldRefreshForResize, WIDTH_CHANGE_RATIO } from '../../src/utils/scrollRefreshPolicy.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '../../src');

function read(relPath) {
  return readFileSync(join(SRC, relPath), 'utf8');
}

/* ── Decision-logic behaviour (the actual bug + the actual fix) ──── */

test('touch device, height-only change (in-app-browser chrome animating): does NOT refresh', () => {
  // e.g. WhatsApp's in-app-browser chrome collapsing on an iPhone —
  // width stays exactly 390, height grows as the address bar hides.
  assert.equal(
    shouldRefreshForResize({
      prevWidth: 390, prevHeight: 664,
      newWidth: 390, newHeight: 730,
      isTouchPrimary: true,
    }),
    false,
    'A pure height change on a touch device must not trigger refresh — this is exactly what caused the jump.'
  );
});

test('touch device, small width jitter alongside a height change: does NOT refresh', () => {
  // Sub-pixel/rounding noise, nowhere near a real layout change.
  assert.equal(
    shouldRefreshForResize({
      prevWidth: 390, prevHeight: 664,
      newWidth: 392, newHeight: 730, // ~0.5% width change
      isTouchPrimary: true,
    }),
    false,
    'Negligible width jitter must not be mistaken for a material width change.'
  );
});

test('touch device, material width change (genuine orientation change): DOES refresh', () => {
  // iPhone rotating portrait -> landscape: 390x844 -> 844x390.
  assert.equal(
    shouldRefreshForResize({
      prevWidth: 390, prevHeight: 844,
      newWidth: 844, newHeight: 390,
      isTouchPrimary: true,
    }),
    true,
    'A genuine orientation change (large width swing) must still trigger refresh on a touch device.'
  );
});

test('touch device, width change exactly at the configured ratio boundary', () => {
  const prevWidth = 400;
  const justUnder = prevWidth * WIDTH_CHANGE_RATIO - 1; // one px under threshold
  const justOver  = prevWidth * WIDTH_CHANGE_RATIO + 1; // one px over threshold

  assert.equal(
    shouldRefreshForResize({
      prevWidth, prevHeight: 800,
      newWidth: prevWidth + justUnder, newHeight: 850,
      isTouchPrimary: true,
    }),
    false,
    'A width delta just under WIDTH_CHANGE_RATIO must not refresh.'
  );
  assert.equal(
    shouldRefreshForResize({
      prevWidth, prevHeight: 800,
      newWidth: prevWidth + justOver, newHeight: 850,
      isTouchPrimary: true,
    }),
    true,
    'A width delta just over WIDTH_CHANGE_RATIO must refresh.'
  );
});

test('desktop (non-touch), height-only change: DOES refresh — normal desktop resize is untouched', () => {
  // A person dragging their browser window's bottom edge only.
  assert.equal(
    shouldRefreshForResize({
      prevWidth: 1440, prevHeight: 900,
      newWidth: 1440, newHeight: 760,
      isTouchPrimary: false,
    }),
    true,
    'Desktop must always refresh on resize, regardless of which dimension changed — matches ScrollTrigger default behaviour.'
  );
});

test('desktop (non-touch), width change: DOES refresh', () => {
  assert.equal(
    shouldRefreshForResize({
      prevWidth: 1440, prevHeight: 900,
      newWidth: 1024, newHeight: 900,
      isTouchPrimary: false,
    }),
    true
  );
});

test('desktop (non-touch), no actual dimension change: does not need to refresh', () => {
  assert.equal(
    shouldRefreshForResize({
      prevWidth: 1440, prevHeight: 900,
      newWidth: 1440, newHeight: 900,
      isTouchPrimary: false,
    }),
    false
  );
});

/* ── Wiring / source-level checks ─────────────────────────────────── */

test('gsapSetup excludes "resize" from ScrollTrigger.config autoRefreshEvents but keeps load/visibilitychange', () => {
  const setup = read('utils/gsapSetup.ts');

  const configCallMatch = setup.match(/ScrollTrigger\.config\(\{[\s\S]*?\}\);/);
  assert.ok(configCallMatch, 'Could not find the ScrollTrigger.config({...}) call body.');
  const configBody = configCallMatch[0];

  assert.ok(/autoRefreshEvents\s*:/.test(configBody), 'ScrollTrigger.config must set autoRefreshEvents explicitly.');
  assert.ok(
    !/autoRefreshEvents\s*:\s*['"`][^'"`]*resize/i.test(configBody),
    '"resize" must not be in the built-in autoRefreshEvents string — it is now handled by our own gated listener instead.'
  );
  assert.ok(
    configBody.includes('DOMContentLoaded') && configBody.includes('load') && configBody.includes('visibilitychange'),
    'Initial-load and tab-refocus refresh events must be preserved.'
  );
});

test('gsapSetup wires its own debounced resize + orientationchange listeners', () => {
  const setup = read('utils/gsapSetup.ts');
  assert.ok(setup.includes("addEventListener('resize'"), 'A custom resize listener must be attached.');
  assert.ok(setup.includes("addEventListener('orientationchange'"), 'A custom orientationchange listener must be attached.');
  assert.ok(/setTimeout\(/.test(setup), 'The legitimate refresh must be debounced (setTimeout), not run synchronously per event.');
  assert.ok(setup.includes('clearTimeout(debounceTimer)'), 'Each new qualifying resize must restart the debounce, so refresh runs once layout stabilises.');
});

test('main.tsx imports the GSAP setup before rendering the app', () => {
  const main = read('main.tsx');
  const setupImportIdx = main.indexOf('./utils/gsapSetup');
  const renderIdx = main.indexOf('.render(');
  assert.ok(setupImportIdx !== -1, 'main.tsx must import ./utils/gsapSetup for its side effect.');
  assert.ok(renderIdx !== -1, 'main.tsx must call .render(...) to mount the app.');
  assert.ok(setupImportIdx < renderIdx, 'The gsapSetup import must run before the app renders.');
});

test('ScrollDebugOverlay stays inert unless ?debug_scroll=1 is present', () => {
  const overlay = read('components/ScrollDebugOverlay.tsx');
  assert.ok(
    overlay.includes("get('debug_scroll') === '1'"),
    'The diagnostic overlay must gate itself on ?debug_scroll=1 so real visitors never see it.'
  );
  assert.ok(
    /if\s*\(!enabled\)\s*return null/.test(overlay),
    'The overlay must render nothing when not explicitly enabled.'
  );
});

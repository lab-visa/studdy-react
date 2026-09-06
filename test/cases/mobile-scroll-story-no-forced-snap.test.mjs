/**
 * Regression guard for the WhatsApp in-app-browser mobile scroll bug
 * (Sep 2026).
 *
 * Root cause: MobileStory (src/sections/ScrollStory.tsx) used to force
 * the scroll position onto the nearest slide via CSS scroll-snap-type
 * plus a JS scrollend/300ms-debounce handler calling scrollIntoView().
 * That handler measured distance using window.innerHeight, which is
 * NOT stable inside in-app browsers (WhatsApp, Instagram, etc.) — their
 * own chrome grows/shrinks while scrolling, so every resize produced a
 * new "correction" that itself triggered another scroll event: a
 * jump-forward/jump-back feedback loop. It never showed up in real
 * Safari/Chrome because their viewport doesn't animate the same way.
 *
 * There's no component-render harness in this test suite (no
 * jsdom/testing-library), so this guard works at the source level: it
 * asserts the forced-snap mechanics are gone from MobileStory, and
 * that the IntersectionObserver-driven active-slide logic (which needs
 * no snapping to work) is still intact. If someone reintroduces
 * scrollIntoView-based correction here, this test fails and should be
 * treated as a reopening of that bug, not a false positive to silence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = join(__dirname, '../../src/sections/ScrollStory.tsx');
const source = readFileSync(SOURCE_PATH, 'utf8');

function mobileStorySlice(src) {
  const start = src.indexOf('function MobileStory(');
  const end = src.indexOf('\nfunction ', start + 1);
  assert.ok(start !== -1, 'MobileStory function not found in ScrollStory.tsx');
  return end === -1 ? src.slice(start) : src.slice(start, end);
}

test('MobileStory no longer forces scroll-snap correction', () => {
  const mobileStory = mobileStorySlice(source);

  assert.ok(
    !mobileStory.includes('scrollIntoView'),
    'MobileStory must not call scrollIntoView() — this is the exact mechanism that fought ' +
    'in-app-browser (WhatsApp) chrome resizing and produced the jump-forward/jump-back loop.'
  );
  assert.ok(
    !mobileStory.includes('scrollSnapType'),
    'MobileStory must not set CSS scroll-snap-type — forced snapping is the behavior we removed.'
  );
  assert.ok(
    !mobileStory.includes("'scrollend'"),
    'MobileStory must not listen for scrollend to run a snap correction.'
  );
});

test('MobileSlide no longer declares per-slide scroll-snap alignment', () => {
  const start = source.indexOf('const MobileSlide = forwardRef');
  const end = source.indexOf('function MobileStory(');
  assert.ok(start !== -1, 'MobileSlide not found in ScrollStory.tsx');
  const mobileSlide = source.slice(start, end);

  assert.ok(!mobileSlide.includes('scrollSnapAlign'), 'MobileSlide must not set scrollSnapAlign.');
  assert.ok(!mobileSlide.includes('scrollSnapStop'), 'MobileSlide must not set scrollSnapStop.');
});

test('MobileStory still drives the active slide from real visibility (IntersectionObserver)', () => {
  const mobileStory = mobileStorySlice(source);

  assert.ok(
    mobileStory.includes('IntersectionObserver'),
    'Active-slide detection must still exist — video play/pause and text opacity depend on it, ' +
    'and unlike the snap correction it needs no viewport-height math to work correctly.'
  );
  assert.ok(
    mobileStory.includes('threshold: 0.6'),
    'The 0.6 visibility threshold that decides the active slide must be unchanged.'
  );
});

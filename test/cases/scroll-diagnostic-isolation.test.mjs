import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const readSource = path => readFileSync(join(here, '../..', path), 'utf8');

const modeSource = readSource('src/utils/scrollDiagnosticMode.ts');
const heroSource = readSource('src/sections/Hero.tsx');
const howSource = readSource('src/sections/HowItWorks.tsx');
const storySource = readSource('src/sections/ScrollStory.tsx');
const overlaySource = readSource('src/components/ScrollDiagnosticOverlay.tsx');

test('diagnostic behavior is opt-in through st_test only', () => {
  assert.match(modeSource, /get\('st_test'\)/);
  assert.match(modeSource, /: 'control'/);
  assert.doesNotMatch(modeSource, /utm_source|sessionStorage|userAgent/i);
});

test('only the four documented test modes are accepted', () => {
  for (const mode of ['control', 'no-scrub', 'stable-height', 'combined']) {
    assert.ok(modeSource.includes(`'${mode}'`), `missing ${mode} mode`);
  }
});

test('Hero scroll scrub is skipped only by the diagnostic mode gate', () => {
  assert.match(heroSource, /if \(shouldDisableScrollScrub\(\)\) return;/);
  assert.match(heroSource, /scrub: 0\.5/);
});

test('HowItWorks continuous desktop and mobile scrub paths use one gate', () => {
  assert.match(howSource, /!disableScrollScrub && lineRef\.current/);
  assert.match(howSource, /!disableScrollScrub && tokenRef\.current/);
  assert.match(howSource, /disableScrollScrub \? null : document\.getElementById/);
});

test('no-scrub mode supplies complete static decorative state', () => {
  assert.match(howSource, /disableScrollScrub \? 'scaleX\(1\)'/);
  assert.match(howSource, /disableScrollScrub \? 'scaleY\(1\)'/);
  assert.match(howSource, /opacity: disableScrollScrub \? 1 : 0\.35/);
});

test('stable-height mode preserves the existing 100svh control path', () => {
  assert.match(storySource, /stableHeight === null \? '100svh'/);
  assert.match(storySource, /shouldUseStableStoryHeight\(\)/);
  assert.match(storySource, /visualViewport\?\.height \?\? window\.innerHeight/);
});

test('diagnostic overlay is invisible unless st_debug equals 1', () => {
  assert.match(modeSource, /get\('st_debug'\) === '1'/);
  assert.match(overlaySource, /if \(!visible \|\| !metrics\) return null;/);
});

test('overlay reports both layout and separate resize-source measurements', () => {
  for (const label of [
    'scrollY', 'innerHeight', 'visualViewport', 'slide', 'story',
    'HowItWorks top', 'window resizes', 'visual resizes',
  ]) {
    assert.ok(overlaySource.includes(label), `overlay is missing ${label}`);
  }
});

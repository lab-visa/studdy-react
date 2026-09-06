import { useEffect, useState } from 'react';
import {
  getScrollTestMode,
  isScrollDiagnosticVisible,
} from '../utils/scrollDiagnosticMode';

type Metrics = {
  scrollY: number;
  innerHeight: number;
  visualHeight: number;
  slideHeight: number;
  storyHeight: number;
  howItWorksTop: number;
  windowResizes: number;
  visualResizes: number;
  lastWindowDelta: number;
  lastVisualDelta: number;
};

const round = (value: number | undefined) => Math.round(value ?? 0);

function readLayout(
  windowResizes: number,
  visualResizes: number,
  lastWindowDelta: number,
  lastVisualDelta: number,
): Metrics {
  const slide = document.querySelector<HTMLElement>('[data-st-mobile-slide]');
  const story = document.querySelector<HTMLElement>('[data-st-mobile-story]');
  const howItWorks = document.getElementById('hiw');

  return {
    scrollY: round(window.scrollY),
    innerHeight: round(window.innerHeight),
    visualHeight: round(window.visualViewport?.height ?? window.innerHeight),
    slideHeight: round(slide?.getBoundingClientRect().height),
    storyHeight: round(story?.getBoundingClientRect().height),
    howItWorksTop: round(
      howItWorks ? howItWorks.getBoundingClientRect().top + window.scrollY : 0,
    ),
    windowResizes,
    visualResizes,
    lastWindowDelta,
    lastVisualDelta,
  };
}

export default function ScrollDiagnosticOverlay() {
  const visible = isScrollDiagnosticVisible();
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    if (!visible) return;

    let windowResizes = 0;
    let visualResizes = 0;
    let previousWindowHeight = window.innerHeight;
    let previousVisualHeight = window.visualViewport?.height ?? window.innerHeight;
    let lastWindowDelta = 0;
    let lastVisualDelta = 0;
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setMetrics(readLayout(
          windowResizes,
          visualResizes,
          lastWindowDelta,
          lastVisualDelta,
        ));
      });
    };
    const onWindowResize = () => {
      windowResizes += 1;
      lastWindowDelta = window.innerHeight - previousWindowHeight;
      previousWindowHeight = window.innerHeight;
      update();
    };
    const onVisualResize = () => {
      visualResizes += 1;
      const nextHeight = window.visualViewport?.height ?? window.innerHeight;
      lastVisualDelta = round(nextHeight - previousVisualHeight);
      previousVisualHeight = nextHeight;
      update();
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', onWindowResize, { passive: true });
    window.visualViewport?.addEventListener('resize', onVisualResize, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', onWindowResize);
      window.visualViewport?.removeEventListener('resize', onVisualResize);
    };
  }, [visible]);

  if (!visible || !metrics) return null;

  return (
    <output
      aria-label="Scroll diagnostic metrics"
      style={{
        position: 'fixed', top: '76px', left: '10px', zIndex: 10000,
        pointerEvents: 'none', padding: '10px 12px', borderRadius: '10px',
        background: 'rgba(10,10,14,.88)', color: '#48ff65',
        font: '600 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
        whiteSpace: 'pre', boxShadow: '0 2px 12px rgba(0,0,0,.28)',
      }}
    >
      {`mode: ${getScrollTestMode()}\nscrollY: ${metrics.scrollY}px\ninnerHeight: ${metrics.innerHeight}px\nvisualViewport: ${metrics.visualHeight}px\nslide: ${metrics.slideHeight}px\nstory: ${metrics.storyHeight}px\nHowItWorks top: ${metrics.howItWorksTop}px\nwindow resizes: ${metrics.windowResizes} (${metrics.lastWindowDelta}px)\nvisual resizes: ${metrics.visualResizes} (${metrics.lastVisualDelta}px)`}
    </output>
  );
}

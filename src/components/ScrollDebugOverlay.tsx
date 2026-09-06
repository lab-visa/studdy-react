/**
 * ScrollDebugOverlay.tsx
 *
 * Opt-in, on-screen diagnostic overlay for the WhatsApp in-app-browser
 * scroll-jump investigation (Sep 2026). Renders nothing unless the URL
 * has ?debug_scroll=1 — real visitors, including every marketing CTA
 * link, never see or pay any cost for this.
 *
 * Why an on-screen overlay instead of console.log: there's no easy way
 * to attach devtools to WhatsApp's in-app browser on an iPhone, so a
 * console message is invisible to whoever is actually testing there.
 * A small fixed box that's readable in a screen recording gives real
 * numbers from the actual in-app browser instead of a guess made from
 * outside it — scrollY, viewport height, the size of the last resize
 * (this in-app browser's chrome collapsing/expanding is exactly what
 * we're trying to see), and how many times GSAP ScrollTrigger has
 * actually run a refresh() since load (each one is a moment where
 * every scroll-linked animation's position gets recalculated — see
 * src/utils/gsapSetup.ts for why that matters here, and for why most
 * of those refreshes should now be suppressed on a touch device unless
 * the width genuinely changed).
 */
import { useEffect, useRef, useState } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('debug_scroll') === '1';
  } catch {
    return false;
  }
}

export default function ScrollDebugOverlay() {
  const [enabled] = useState(isEnabled);
  const [scrollY, setScrollY] = useState(0);
  const [innerHeight, setInnerHeight] = useState(0);
  const [lastResizeDelta, setLastResizeDelta] = useState<number | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const prevHeightRef = useRef(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    startRef.current = Date.now();
    prevHeightRef.current = window.innerHeight;
    setInnerHeight(window.innerHeight);
    setScrollY(window.scrollY);

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; setScrollY(window.scrollY); });
    };
    const onResize = () => {
      const h = window.innerHeight;
      setLastResizeDelta(h - prevHeightRef.current);
      prevHeightRef.current = h;
      setInnerHeight(h);
    };
    const onRefresh = () => {
      setRefreshCount(c => c + 1);
      setLastRefreshAt(Date.now());
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    ScrollTrigger.addEventListener('refresh', onRefresh);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      ScrollTrigger.removeEventListener('refresh', onRefresh);
    };
  }, [enabled]);

  if (!enabled) return null;

  const secondsSinceLoad = ((Date.now() - startRef.current) / 1000).toFixed(1);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', top: '8px', left: '8px', zIndex: 999999,
        background: 'rgba(0,0,0,.82)', color: '#0f0',
        font: '11px/1.5 monospace', padding: '8px 10px',
        borderRadius: '8px', pointerEvents: 'none',
        whiteSpace: 'pre', maxWidth: '90vw',
      }}
    >
      {`scrollY: ${scrollY}px
innerHeight: ${innerHeight}px
last resize Δh: ${lastResizeDelta === null ? '—' : `${lastResizeDelta > 0 ? '+' : ''}${lastResizeDelta}px`}
ScrollTrigger refreshes: ${refreshCount}${lastRefreshAt ? ` (last @ ${((lastRefreshAt - startRef.current) / 1000).toFixed(1)}s)` : ''}
t+${secondsSinceLoad}s`}
    </div>
  );
}

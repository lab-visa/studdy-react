/**
 * MarketContext — one shared "which country is this visitor in" answer for
 * the whole site.
 *
 * India (region 'in') gets its own offer: pay first (Quarterly / Yearly),
 * "Get Started" buttons and a 7-day refund — no free trial. Every other
 * region keeps the existing Stripe free-trial flow, completely unchanged.
 *
 * If the visitor picks a different country in the Pricing or Checkout
 * country dropdown, that choice updates this shared value, so every button
 * and section on the page switches together.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Region } from '../data/config';
import { detectRegion } from '../utils/geo';

interface MarketValue {
  region: Region;
  detectedRegion: Region | null;
  /** true once detection has finished (or the visitor picked a country) */
  ready: boolean;
  isIndia: boolean;
  setRegion: (r: Region) => void;
}

const MarketContext = createContext<MarketValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const [region, setRegionState] = useState<Region>('us');
  const [detectedRegion, setDetectedRegion] = useState<Region | null>(null);
  const [ready, setReady] = useState(false);
  const [userPicked, setUserPicked] = useState(false);

  useEffect(() => {
    detectRegion().then(r => {
      setDetectedRegion(r);
      setRegionState(prev => (userPicked ? prev : r));
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRegion = (r: Region) => {
    setUserPicked(true);
    setRegionState(r);
    setReady(true);
  };

  return (
    <MarketContext.Provider value={{ region, detectedRegion, ready, isIndia: region === 'in', setRegion }}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket(): MarketValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used inside <MarketProvider>');
  return ctx;
}

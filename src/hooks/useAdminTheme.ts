/**
 * CRM-2B (visual refinement) — light/dark theme state for the admin
 * shell only. Defaults to the viewer's OS preference; an explicit toggle
 * persists to localStorage (per-browser, per-viewer — never sent
 * anywhere, never affects any other visitor). Never touches the public
 * marketing site, which has no dark mode and isn't in scope here.
 */
import { useCallback, useEffect, useState } from 'react';

export type AdminTheme = 'light' | 'dark';

const STORAGE_KEY = 'sl_admin_theme';

function readStoredTheme(): AdminTheme | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    // Private browsing / storage blocked — fall back to system preference.
    return null;
  }
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function useAdminTheme(): { theme: AdminTheme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<AdminTheme>(() => readStoredTheme() ?? (systemPrefersDark() ? 'dark' : 'light'));

  useEffect(() => {
    // Only follow the OS live if the viewer never explicitly chose —
    // once they toggle, that choice sticks regardless of OS changes.
    if (readStoredTheme() !== null) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(mql.matches ? 'dark' : 'light');
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: AdminTheme = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Best-effort only — theme still applies for this page view.
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}

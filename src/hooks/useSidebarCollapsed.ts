/**
 * CRM-2B (shell refinement) — desktop sidebar collapsed/expanded state.
 * Persists per-browser via localStorage (never sent anywhere, never
 * affects any other visitor), mirroring useAdminTheme.ts's pattern.
 *
 * Desktop-only concept: the mobile slide-over nav always shows full
 * labels and never reads or writes this preference (see AdminLayout.tsx
 * and Sidebar.tsx, which only pass `collapsed` into the desktop aside).
 */
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'sl_admin_sidebar_collapsed';

function readStoredCollapsed(): boolean | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
    return null;
  } catch {
    // Private browsing / storage blocked — fall back to expanded.
    return null;
  }
}

export function useSidebarCollapsed(): { collapsed: boolean; toggleCollapsed: () => void } {
  const [collapsed, setCollapsed] = useState<boolean>(() => readStoredCollapsed() ?? false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Best-effort only — the toggle still applies for this page view.
      }
      return next;
    });
  }, []);

  return { collapsed, toggleCollapsed };
}

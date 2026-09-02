/**
 * CRM-2B — Studdy CRM application shell: responsive sidebar (desktop
 * fixed, mobile slide-over), top bar, and content area. Session
 * verification and logout wiring live one level up (AdminHome.tsx) —
 * this component is presentation-only so it can wrap any future admin
 * page, not just Command Center.
 *
 * Visual refinement: the root element carries `admin-shell` +
 * `data-theme` — see src/index.css's scoped light/dark tokens and
 * src/hooks/useAdminTheme.ts. This is the ONLY part of the app with
 * dark-mode support; the public marketing site is unaffected.
 */
import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAdminTheme } from '../../hooks/useAdminTheme';

interface AdminLayoutProps {
  currentPath: string;
  pageTitle: string;
  pageSubtitle?: string;
  displayName: string;
  onLogout: () => void;
  loggingOut: boolean;
  children: ReactNode;
}

export default function AdminLayout({
  currentPath,
  pageTitle,
  pageSubtitle,
  displayName,
  onLogout,
  loggingOut,
  children,
}: AdminLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { theme, toggleTheme } = useAdminTheme();

  return (
    <div className="admin-shell min-h-screen flex" data-theme={theme} style={{ background: 'var(--dim)', color: 'var(--ink)' }}>
      {/* Desktop sidebar — w-[21rem] (not w-64) gives the longer CRM-2B
          nav labels ("Customer & Subscription", "Operations & Capacity")
          comfortable room to render in full on one line instead of
          truncating (w-80 fit them to within a sub-pixel and still
          triggered the ellipsis on some renders — this leaves real
          margin). */}
      <aside
        className="hidden lg:flex lg:flex-col w-[21rem] shrink-0 sticky top-0 h-screen"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        <BrandHeader />
        <div className="flex-1 overflow-y-auto">
          <Sidebar currentPath={currentPath} />
        </div>
        <SidebarFooter />
      </aside>

      {/* Mobile slide-over sidebar */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 w-[21rem] max-w-[85vw] flex flex-col"
            style={{ background: 'var(--surface)' }}
          >
            <div className="flex items-center justify-between px-4 pt-4">
              <BrandHeader compact />
              <button
                type="button"
                aria-label="Close navigation"
                className="p-2 -mr-2"
                onClick={() => setMobileNavOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar currentPath={currentPath} onNavigate={() => setMobileNavOpen(false)} />
            </div>
            <SidebarFooter />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          title={pageTitle}
          subtitle={pageSubtitle}
          displayName={displayName}
          onLogout={onLogout}
          loggingOut={loggingOut}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="flex-1 px-4 sm:px-6 py-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

function BrandHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'px-2 pb-4' : 'px-5 pt-6 pb-5'}>
      <div className="font-black text-[18px]">
        <span className="grad-text">studdy</span>
        <span style={{ color: 'var(--soft)' }}> CRM</span>
      </div>
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="px-5 py-4 text-[11px] font-semibold" style={{ color: 'var(--soft)', borderTop: '1px solid var(--border)' }}>
      Studdy Business OS
    </div>
  );
}

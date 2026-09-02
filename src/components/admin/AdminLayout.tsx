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
 *
 * Shell refinement: the desktop sidebar collapses to an icon-only rail
 * (see src/hooks/useSidebarCollapsed.ts for the persisted preference).
 * This is desktop-only — the mobile slide-over below always renders
 * Sidebar expanded (no `collapsed` prop passed) regardless of the
 * desktop preference, per "do not force the desktop collapsed sidebar
 * onto mobile."
 */
import { useState, type ReactNode } from 'react';
import { X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAdminTheme } from '../../hooks/useAdminTheme';
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed';

const SIDEBAR_EXPANDED_WIDTH = '20rem';
const SIDEBAR_COLLAPSED_WIDTH = '4.75rem';

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
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();

  return (
    <div className="admin-shell min-h-screen flex" data-theme={theme} style={{ background: 'var(--dim)', color: 'var(--ink)' }}>
      {/* Desktop sidebar — collapsible between SIDEBAR_EXPANDED_WIDTH
          (full labels, section headings, "Later" badges) and
          SIDEBAR_COLLAPSED_WIDTH (icon-only rail, tooltip on hover/
          focus — see Sidebar.tsx). Width is set inline (not swapped
          Tailwind classes) so the `transition-[width]` below animates
          it smoothly; the global prefers-reduced-motion rule in
          index.css zeroes that duration automatically for anyone who
          asked for reduced motion.
          The toggle button pokes out past the right border via a
          negative offset, so `overflow-hidden` lives on the INNER
          content wrapper (which keeps the brief expand transition from
          letting full-width labels spill past a still-narrow rail),
          never on the aside itself — an overflow-hidden aside would
          clip the toggle button along with everything else. */}
      <aside
        className="hidden lg:flex lg:flex-col shrink-0 sticky top-0 h-screen relative transition-[width] duration-200 ease-in-out"
        style={{
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <BrandHeader collapsed={collapsed} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <Sidebar currentPath={currentPath} collapsed={collapsed} />
          </div>
          <SidebarFooter collapsed={collapsed} />
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          className="absolute -right-3.5 top-[4.25rem] z-10 flex items-center justify-center rounded-full p-1.5 shadow-sm cursor-pointer"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        >
          {collapsed ? <PanelLeftOpen size={14} strokeWidth={2.5} /> : <PanelLeftClose size={14} strokeWidth={2.5} />}
        </button>
      </aside>

      {/* Mobile slide-over sidebar — always expanded; the desktop
          collapsed preference never applies here. */}
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

function BrandHeader({ compact = false, collapsed = false }: { compact?: boolean; collapsed?: boolean }) {
  // Collapsed rail (76px) can't fit the full "studdy CRM" wordmark —
  // fall back to a small monogram rather than truncating or wrapping it.
  if (collapsed) {
    return (
      <div className="pt-6 pb-5 flex justify-center" title="Studdy CRM">
        <span className="font-black text-[20px] grad-text">S</span>
      </div>
    );
  }
  return (
    <div className={compact ? 'px-2 pb-4' : 'px-5 pt-6 pb-5'}>
      <div className="font-black text-[18px]">
        <span className="grad-text">studdy</span>
        <span style={{ color: 'var(--soft)' }}> CRM</span>
      </div>
    </div>
  );
}

function SidebarFooter({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return <div style={{ borderTop: '1px solid var(--border)' }} className="h-4" />;
  }
  return (
    <div className="px-5 py-4 text-[11px] font-semibold" style={{ color: 'var(--soft)', borderTop: '1px solid var(--border)' }}>
      Studdy Business OS
    </div>
  );
}

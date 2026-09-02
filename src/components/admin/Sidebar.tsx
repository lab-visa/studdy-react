/**
 * CRM-2B — admin sidebar navigation.
 *
 * Only Command Center has a real route today, so every other item is
 * rendered as a disabled control with a "Later" badge — never a Link to
 * a route that doesn't exist (App.tsx registers no route for any of
 * them yet). Active-state styling comes from the current route, not
 * from local component state, so it stays correct if this ever renders
 * on a different admin page.
 *
 * CRM-2B navigation-architecture refinement: items now render grouped
 * under visible section labels (Workspace / Analytics / Intelligence /
 * Administration) so the full planned CRM is legible today — this is
 * presentation only, `navConfig.ts` is still the single source of truth
 * and no new routes or data are introduced here.
 */
import type { AdminNavItem } from './navConfig';
import { ADMIN_NAV_SECTIONS } from './navConfig';

interface SidebarProps {
  currentPath: string;
  /** Called after a nav click on mobile, so the slide-over sidebar closes. */
  onNavigate?: () => void;
}

export default function Sidebar({ currentPath, onNavigate }: SidebarProps) {
  return (
    <nav aria-label="Studdy CRM sections" className="flex flex-col gap-4 px-3 py-4">
      {ADMIN_NAV_SECTIONS.map((section) => (
        <div key={section.key} className="flex flex-col gap-1">
          {section.label && (
            <div
              className="px-3 pt-2 pb-1 text-[10.5px] font-black uppercase tracking-wider"
              style={{ color: 'var(--soft)' }}
            >
              {section.label}
            </div>
          )}
          {section.items.map((item) => (
            <NavRow key={item.key} item={item} currentPath={currentPath} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}

function NavRow({
  item,
  currentPath,
  onNavigate,
}: {
  item: AdminNavItem;
  currentPath: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const isActive = item.status === 'active' && currentPath === item.path;

  if (item.status === 'comingLater') {
    return (
      <div
        aria-disabled="true"
        title="Later"
        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold cursor-not-allowed select-none"
        style={{ color: 'var(--soft)', opacity: 0.55 }}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Icon size={17} strokeWidth={2.25} className="shrink-0" />
          <span className="truncate min-w-0">{item.label}</span>
        </span>
        <span
          className="text-[9px] font-black uppercase tracking-wide rounded-full px-1.5 py-0.5 shrink-0"
          style={{ background: 'var(--dim)', color: 'var(--soft)', border: '1px solid var(--border)' }}
        >
          Later
        </span>
      </div>
    );
  }

  return (
    <a
      href={item.path}
      onClick={(e) => {
        // Command Center is the only active route today, and it's
        // already where /admin renders — a real navigation would be a
        // full reload of the same page. Keep the click a no-op
        // scroll-to-top instead, and still fire onNavigate so a mobile
        // slide-over closes.
        if (currentPath === item.path) e.preventDefault();
        onNavigate?.();
      }}
      aria-current={isActive ? 'page' : undefined}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-bold transition-colors"
      style={
        isActive
          ? { background: 'linear-gradient(135deg,rgba(239,85,182,.10),rgba(140,121,224,.10))', color: 'var(--ink)' }
          : { color: 'var(--ink)' }
      }
    >
      <Icon size={17} strokeWidth={2.5} style={{ color: isActive ? 'var(--g1)' : 'var(--soft)' }} />
      {item.label}
    </a>
  );
}

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
 * CRM-2B navigation-architecture refinement: items render grouped
 * under visible section labels (Workspace / Analytics / Intelligence /
 * Administration) so the full planned CRM is legible today — this is
 * presentation only, `navConfig.ts` is still the single source of truth
 * and no new routes or data are introduced here.
 *
 * CRM-2B shell refinement: an optional `collapsed` prop switches every
 * row to an icon-only rendering (labels, section headings and "Later"
 * badges hidden) for the desktop sidebar's collapsed state. This prop
 * is desktop-only — AdminLayout never passes `collapsed` to the mobile
 * slide-over's <Sidebar>, which always renders expanded regardless of
 * the desktop preference. In collapsed mode every row keeps its full
 * name available to assistive tech via `aria-label` (the icon alone
 * has no accessible name otherwise) and shows it to sighted users via
 * a hover/focus tooltip rendered through a portal, so it is never
 * clipped by the nav's vertically-scrolling container.
 */
import { useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { AdminNavItem } from './navConfig';
import { ADMIN_NAV_SECTIONS } from './navConfig';

interface SidebarProps {
  currentPath: string;
  /** Called after a nav click on mobile, so the slide-over sidebar closes. */
  onNavigate?: () => void;
  /** Icon-only rendering for the desktop collapsed state. Default false (always expanded — used by the mobile slide-over). */
  collapsed?: boolean;
}

export default function Sidebar({ currentPath, onNavigate, collapsed = false }: SidebarProps) {
  return (
    <nav aria-label="Studdy CRM sections" className="flex flex-col gap-4 px-3 py-4">
      {ADMIN_NAV_SECTIONS.map((section) => (
        <div key={section.key} className="flex flex-col gap-1">
          {section.label &&
            (collapsed ? (
              <div className="mx-2 my-1 border-t" style={{ borderColor: 'var(--border)' }} />
            ) : (
              <div
                className="px-3 pt-2 pb-1 text-[10.5px] font-black uppercase tracking-wider"
                style={{ color: 'var(--soft)' }}
              >
                {section.label}
              </div>
            ))}
          {section.items.map((item) => (
            <NavRow key={item.key} item={item} currentPath={currentPath} onNavigate={onNavigate} collapsed={collapsed} />
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
  collapsed,
}: {
  item: AdminNavItem;
  currentPath: string;
  onNavigate?: () => void;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const isActive = item.status === 'active' && currentPath === item.path;
  const tooltip = useRowTooltip();

  if (item.status === 'comingLater') {
    return (
      <div
        ref={tooltip.ref as RefObject<HTMLDivElement>}
        aria-disabled="true"
        // tabIndex 0 (rather than the default non-interactive div) so a
        // keyboard user tabbing through the collapsed sidebar can reach
        // every icon and trigger its tooltip/aria-label, per "hovering
        // OR focusing an icon in collapsed mode must show its complete
        // name". Harmless in expanded mode too — the row is still
        // inert (no onClick/onKeyDown), just discoverable.
        tabIndex={0}
        title={collapsed ? undefined : 'Later'}
        aria-label={collapsed ? `${item.label} — coming later` : undefined}
        onMouseEnter={collapsed ? tooltip.show : undefined}
        onMouseLeave={collapsed ? tooltip.hide : undefined}
        onFocus={collapsed ? tooltip.show : undefined}
        onBlur={collapsed ? tooltip.hide : undefined}
        className={
          collapsed
            ? 'flex items-center justify-center rounded-xl px-2 py-2.5 cursor-not-allowed select-none'
            : 'flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-2.5 text-[13.5px] font-semibold cursor-not-allowed select-none'
        }
        style={{ color: 'var(--soft)', opacity: 0.55 }}
      >
        {collapsed ? (
          <Icon size={18} strokeWidth={2.25} />
        ) : (
          <>
            <span className="flex items-center gap-2 min-w-0">
              <Icon size={17} strokeWidth={2.25} className="shrink-0" />
              <span className="truncate min-w-0">{item.label}</span>
            </span>
            <span
              className="text-[9px] font-black uppercase tracking-wide rounded-full px-1 py-0.5 shrink-0"
              style={{ background: 'var(--dim)', color: 'var(--soft)', border: '1px solid var(--border)' }}
            >
              Later
            </span>
          </>
        )}
        <RowTooltip label={`${item.label} — Later`} tooltip={tooltip} active={collapsed} />
      </div>
    );
  }

  return (
    <a
      ref={tooltip.ref as RefObject<HTMLAnchorElement>}
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
      onMouseEnter={collapsed ? tooltip.show : undefined}
      onMouseLeave={collapsed ? tooltip.hide : undefined}
      onFocus={collapsed ? tooltip.show : undefined}
      onBlur={collapsed ? tooltip.hide : undefined}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={
        collapsed
          ? 'flex items-center justify-center rounded-xl px-2 py-2.5 font-bold transition-colors'
          : 'flex items-center gap-2 rounded-xl px-2.5 py-2.5 text-[13.5px] font-bold transition-colors'
      }
      style={
        isActive
          ? { background: 'linear-gradient(135deg,rgba(239,85,182,.10),rgba(140,121,224,.10))', color: 'var(--ink)' }
          : { color: 'var(--ink)' }
      }
    >
      <Icon size={collapsed ? 18 : 17} strokeWidth={2.5} style={{ color: isActive ? 'var(--g1)' : 'var(--soft)' }} />
      {!collapsed && item.label}
      <RowTooltip label={item.label} tooltip={tooltip} active={collapsed} />
    </a>
  );
}

// ── Collapsed-mode tooltip ──────────────────────────────────────────
// Rendered through a portal to document.body and positioned via the
// trigger's real bounding rect, so it always escapes the nav's
// `overflow-y-auto` scroll container instead of being clipped at its
// right edge (a plain CSS `overflow: hidden` ancestor clips ANY
// absolutely-positioned descendant that pokes outside it, including
// one meant to visually float past the sidebar's border). Purely
// decorative — `aria-hidden` — because the row's own `aria-label`
// already gives assistive tech the full name regardless of hover/
// focus, so nothing depends on this portal actually mounting.

interface RowTooltipState {
  ref: RefObject<HTMLElement | null>;
  visible: boolean;
  show: () => void;
  hide: () => void;
}

function useRowTooltip(): RowTooltipState {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  return {
    ref,
    visible,
    show: () => setVisible(true),
    hide: () => setVisible(false),
  };
}

function RowTooltip({ label, tooltip, active }: { label: string; tooltip: RowTooltipState; active: boolean }) {
  if (!active || !tooltip.visible || typeof document === 'undefined') return null;
  const rect = tooltip.ref.current?.getBoundingClientRect();
  if (!rect) return null;
  return createPortal(
    <span
      aria-hidden="true"
      className="fixed z-50 rounded-lg px-2.5 py-1.5 text-[12px] font-bold whitespace-nowrap shadow-lg pointer-events-none"
      style={{
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
        transform: 'translateY(-50%)',
        // Hardcoded, not var(--ink)/var(--surface): this portal renders
        // to document.body, OUTSIDE .admin-shell, so the scoped theme
        // custom properties (defined only within .admin-shell — see
        // index.css) aren't in scope here and would silently resolve to
        // the wrong (or, for --surface, no) value — a dark-on-dark
        // invisible tooltip in light mode. A fixed dark bubble regardless
        // of the page theme is also the more common tooltip convention
        // (VS Code, GitHub, etc. all do this) so it's the right choice
        // even setting the scoping issue aside.
        background: '#15131F',
        color: '#F8F7FC',
      }}
    >
      {label}
    </span>,
    document.body
  );
}

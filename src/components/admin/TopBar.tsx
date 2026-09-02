/**
 * CRM-2B — admin top bar: mobile menu toggle, page title/subtitle slot,
 * logged-in administrator identity, light/dark toggle, logout.
 */
import { Menu, LogOut, Sun, Moon } from 'lucide-react';
import type { AdminTheme } from '../../hooks/useAdminTheme';

interface TopBarProps {
  title: string;
  subtitle?: string;
  displayName: string;
  onLogout: () => void;
  onOpenMobileNav: () => void;
  loggingOut: boolean;
  theme: AdminTheme;
  onToggleTheme: () => void;
}

export default function TopBar({
  title,
  subtitle,
  displayName,
  onLogout,
  onOpenMobileNav,
  loggingOut,
  theme,
  onToggleTheme,
}: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 sm:px-6 py-4"
      style={{ background: 'rgba(var(--surface-rgb),.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="lg:hidden flex items-center justify-center rounded-lg p-2 -ml-2"
          style={{ color: 'var(--ink)' }}
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="font-black text-[17px] sm:text-[19px] truncate" style={{ color: 'var(--ink)' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--soft)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <span className="hidden sm:inline text-[13px] font-semibold" style={{ color: 'var(--soft)' }}>
          {displayName}
        </span>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={theme === 'dark'}
          className="flex items-center justify-center rounded-full p-2"
          style={{ border: '1.5px solid var(--border)', color: 'var(--ink)' }}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="gost py-2! px-3.5! text-[13px]!"
          style={{ background: 'var(--surface)', color: 'var(--ink)' }}
          aria-label="Log out"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">{loggingOut ? 'Logging out…' : 'Logout'}</span>
        </button>
      </div>
    </header>
  );
}

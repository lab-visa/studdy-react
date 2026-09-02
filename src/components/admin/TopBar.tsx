/**
 * CRM-2B — admin top bar: mobile menu toggle, page title/subtitle slot,
 * logged-in administrator identity, logout.
 */
import { Menu, LogOut } from 'lucide-react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  displayName: string;
  onLogout: () => void;
  onOpenMobileNav: () => void;
  loggingOut: boolean;
}

export default function TopBar({ title, subtitle, displayName, onLogout, onOpenMobileNav, loggingOut }: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 sm:px-6 py-4"
      style={{ background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--border)' }}
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

      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden sm:inline text-[13px] font-semibold" style={{ color: 'var(--soft)' }}>
          {displayName}
        </span>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="gost py-2! px-3.5! text-[13px]!"
          aria-label="Log out"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">{loggingOut ? 'Logging out…' : 'Logout'}</span>
        </button>
      </div>
    </header>
  );
}

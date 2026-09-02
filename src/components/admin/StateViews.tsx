/**
 * CRM-2B — shared loading / error / empty presentational states for the
 * Command Center, so each is defined once instead of re-implemented per
 * section.
 */
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true" aria-live="polite">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl p-5 h-[104px] animate-pulse"
          style={{ background: '#fff', border: '1px solid var(--border)' }}
        >
          <div className="h-3 w-2/3 rounded mb-4" style={{ background: 'var(--dim)' }} />
          <div className="h-6 w-1/2 rounded" style={{ background: 'var(--dim)' }} />
        </div>
      ))}
      <span className="sr-only">Loading dashboard metrics…</span>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl p-8 flex flex-col items-center text-center gap-3"
      style={{ background: '#fff', border: '1.5px solid rgba(239,85,182,.35)' }}
    >
      <AlertTriangle size={28} style={{ color: 'var(--g1)' }} />
      <div>
        <div className="font-black text-[15px]" style={{ color: 'var(--ink)' }}>
          Couldn't load dashboard data
        </div>
        <p className="text-[13px] font-medium mt-1" style={{ color: 'var(--soft)' }}>
          {message}
        </p>
      </div>
      <button type="button" onClick={onRetry} className="gost mt-1!">
        <RefreshCw size={14} />
        Try again
      </button>
    </div>
  );
}

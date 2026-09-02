/**
 * CRM-2B — shared card chrome for every dashboard section, so section
 * components only implement their own content, not repeated
 * border/padding/heading markup.
 */
import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export default function SectionCard({ title, description, action, children }: SectionCardProps) {
  return (
    <section className="rounded-2xl p-5 sm:p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-black text-[15px]" style={{ color: 'var(--ink)' }}>
            {title}
          </h2>
          {description && (
            <p className="text-[12.5px] font-medium mt-0.5" style={{ color: 'var(--soft)' }}>
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

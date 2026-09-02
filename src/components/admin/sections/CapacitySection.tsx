/**
 * CRM-2B — Section: Studdy account capacity. Current-state, independent
 * of the selected date range — matches allocatedSeats()'s own
 * `type: 'current_state'`. Visual refinement: a donut/radial visual
 * (allocated vs. remaining) alongside the exact numbers and the
 * existing group table. total_capacity === 0 renders as an explicit
 * "not configured yet" empty state — never as "full", which would be
 * misleading (see AlertsBanner's identical distinction).
 */
import SectionCard from '../SectionCard';
import DonutChart from '../charts/DonutChart';
import { formatCount } from '../../../utils/metricsFormat';
import type { AdminMetrics } from '../../../types/adminMetrics';

interface CapacitySectionProps {
  metrics: AdminMetrics;
}

export default function CapacitySection({ metrics }: CapacitySectionProps) {
  const seats = metrics.allocated_seats;
  const isFull = seats.total_capacity > 0 && seats.remaining_capacity <= 0;

  return (
    <SectionCard title="Studdy account capacity" description="Live snapshot — not affected by the selected date range">
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start mb-5">
        <DonutChart
          title="Allocated vs. remaining Studdy account capacity"
          srDescription={`${formatCount(seats.allocated_seats)} allocated, ${formatCount(seats.remaining_capacity)} remaining, of ${formatCount(seats.total_capacity)} total capacity.`}
          segments={[
            { key: 'allocated', label: 'Allocated', value: seats.allocated_seats, tone: isFull ? 'neutral' : 'gradient' },
            { key: 'remaining', label: 'Remaining', value: Math.max(0, seats.remaining_capacity), tone: 'neutral' },
          ]}
          centerValue={seats.total_capacity > 0 ? formatCount(seats.remaining_capacity) : undefined}
          centerLabel={seats.total_capacity > 0 ? 'remaining' : undefined}
          emptyMessage="Not configured yet"
        />

        <div className="grid grid-cols-3 gap-4">
          <Stat label="Allocated" value={seats.allocated_seats} />
          <Stat label="Remaining" value={seats.remaining_capacity} warn={isFull} />
          <Stat label="Total capacity" value={seats.total_capacity} />
        </div>
      </div>

      {seats.by_group.length === 0 ? (
        <p className="text-[13px] font-medium" style={{ color: 'var(--soft)' }}>
          No Studdy account groups with valid capacity yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr style={{ color: 'var(--soft)' }}>
                <th className="font-bold pb-2 pr-4">Group</th>
                <th className="font-bold pb-2 pr-4">Allocated</th>
                <th className="font-bold pb-2 pr-4">Capacity</th>
                <th className="font-bold pb-2">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {seats.by_group.map((g) => (
                <tr key={g.group_name} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-2 pr-4 font-bold" style={{ color: 'var(--ink)' }}>
                    {g.group_name}
                  </td>
                  <td className="py-2 pr-4 font-semibold" style={{ color: 'var(--ink)' }}>
                    {formatCount(g.active_customer_count)}
                  </td>
                  <td className="py-2 pr-4 font-semibold" style={{ color: 'var(--ink)' }}>
                    {formatCount(g.max_capacity)}
                  </td>
                  <td
                    className="py-2 font-semibold"
                    style={{ color: g.remaining <= 0 ? 'var(--warn-text)' : 'var(--ink)' }}
                  >
                    {formatCount(g.remaining)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-bold" style={{ color: 'var(--soft)' }}>
        {label}
      </div>
      <div className="font-black text-[19px]" style={{ color: warn ? 'var(--warn-text)' : 'var(--ink)' }}>
        {formatCount(value)}
      </div>
    </div>
  );
}

/**
 * CRM-2B — Section: Studdy account capacity. Current-state, independent
 * of the selected date range — matches allocatedSeats()'s own
 * `type: 'current_state'`.
 */
import SectionCard from '../SectionCard';
import { formatCount } from '../../../utils/metricsFormat';
import type { AdminMetrics } from '../../../types/adminMetrics';

interface CapacitySectionProps {
  metrics: AdminMetrics;
}

export default function CapacitySection({ metrics }: CapacitySectionProps) {
  const seats = metrics.allocated_seats;
  const pctFull = seats.total_capacity > 0 ? Math.min(100, (seats.allocated_seats / seats.total_capacity) * 100) : 0;

  return (
    <SectionCard title="Studdy account capacity" description="Live snapshot — not affected by the selected date range">
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Stat label="Allocated" value={seats.allocated_seats} />
        <Stat label="Remaining" value={seats.remaining_capacity} warn={seats.total_capacity > 0 && seats.remaining_capacity <= 0} />
        <Stat label="Total capacity" value={seats.total_capacity} />
      </div>
      <div className="h-2.5 rounded-full overflow-hidden mb-5" style={{ background: 'var(--dim)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pctFull}%`, background: seats.total_capacity > 0 && seats.remaining_capacity <= 0 ? '#c4278c' : 'var(--grad)' }}
        />
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
                    style={{ color: g.remaining <= 0 ? '#c4278c' : 'var(--ink)' }}
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
      <div className="font-black text-[19px]" style={{ color: warn ? '#c4278c' : 'var(--ink)' }}>
        {formatCount(value)}
      </div>
    </div>
  );
}

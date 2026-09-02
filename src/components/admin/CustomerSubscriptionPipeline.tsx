/**
 * CRM-3A — Customer & Subscription pipeline page content. Fetches
 * GET /api/admin/today-actions once, and GET /api/admin/customers on
 * mount + whenever a filter changes. Read-only except for the Sales
 * Owner edit inside CustomerDetailDrawer.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import SectionCard from './SectionCard';
import { ErrorState } from './StateViews';
import CustomerDetailDrawer from './CustomerDetailDrawer';
import { stageTone } from '../../utils/lifecycleDisplay';
import type { CustomerFilters, CustomerListRow, CustomersListResponse, TodayActionsResponse } from '../../types/customerPipeline';

interface Props {
  onSessionExpired: () => void;
}

const TONE_COLORS: Record<string, string> = {
  neutral: 'var(--soft)',
  positive: 'var(--g4)',
  warning: '#b8860b',
  danger: 'var(--g1)',
};

function TodayTile({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-xl px-3 py-2.5 flex flex-col gap-0.5" style={{ background: 'var(--dim)', border: '1px solid var(--border)' }}>
      <span className="font-black text-[20px] leading-none" style={{ color: 'var(--ink)' }}>{count}</span>
      <span className="text-[11px] font-bold" style={{ color: 'var(--soft)' }}>{label}</span>
    </div>
  );
}

export default function CustomerSubscriptionPipeline({ onSessionExpired }: Props) {
  const [filters, setFilters] = useState<CustomerFilters>({});
  const [listData, setListData] = useState<CustomersListResponse | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [todayData, setTodayData] = useState<TodayActionsResponse | null>(null);
  const [todayError, setTodayError] = useState<string | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const loadCustomers = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/admin/customers${queryString ? `?${queryString}` : ''}`, { credentials: 'same-origin' });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CustomersListResponse;
      setListData(json);
    } catch {
      setListError('Could not load customers. Check your connection and try again.');
    } finally {
      setListLoading(false);
    }
  }, [queryString, onSessionExpired]);

  const loadToday = useCallback(async () => {
    setTodayError(null);
    try {
      const res = await fetch('/api/admin/today-actions', { credentials: 'same-origin' });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTodayData((await res.json()) as TodayActionsResponse);
    } catch {
      setTodayError('Could not load today’s actions.');
    }
  }, [onSessionExpired]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const updateFilter = (key: keyof CustomerFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const handleSalesOwnerSaved = (customerId: string, salesOwner: string | null) => {
    setListData((prev) =>
      prev
        ? { ...prev, customers: prev.customers.map((c) => (c.id === customerId ? { ...c, sales_owner: salesOwner } : c)) }
        : prev
    );
  };

  if (listLoading && !listData) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-busy="true" aria-live="polite">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-5 h-[104px] animate-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
        ))}
        <span className="sr-only">Loading customers…</span>
      </div>
    );
  }

  if (listError && !listData) {
    return <ErrorState message={listError} onRetry={loadCustomers} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Today’s Actions" description="Everything time-sensitive right now, in Asia/Kolkata (IST).">
        {todayError && (
          <p role="alert" className="text-[12.5px] font-bold mb-3" style={{ color: 'var(--g1)' }}>
            {todayError}
          </p>
        )}
        {todayData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <TodayTile label="Trials ending today" count={todayData.trials_ending_today.length} />
            <TodayTile label="Payments due today" count={todayData.payments_expected_today.length} />
            <TodayTile label="Failed payments" count={todayData.failed_payments.length} />
            <TodayTile label="Cancellation requests" count={todayData.cancellation_requests.length} />
            <TodayTile label="Access removal pending" count={todayData.access_removal_pending.items.length} />
            <TodayTile label="Overdue" count={todayData.overdue.cancellation_requests.length + todayData.overdue.grace_period_payments.length} />
            <TodayTile label="Checkout started, not converted" count={todayData.checkout_started.items.length} />
          </div>
        ) : (
          !todayError && <div className="text-[12.5px] font-semibold" style={{ color: 'var(--soft)' }}>Loading…</div>
        )}
      </SectionCard>

      <SectionCard title="Filters">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <FilterInput label="Country" value={filters.country ?? ''} onChange={(v) => updateFilter('country', v)} />
          <FilterInput label="Sales Owner" value={filters.salesOwner ?? ''} onChange={(v) => updateFilter('salesOwner', v)} placeholder="or 'unassigned'" />
          <FilterSelect
            label="Access status"
            value={filters.accessStatus ?? ''}
            onChange={(v) => updateFilter('accessStatus', v)}
            options={['pending', 'active', 'grace', 'suspended', 'ended']}
          />
          <FilterInput label="Plan" value={filters.plan ?? ''} onChange={(v) => updateFilter('plan', v)} placeholder="Monthly / Yearly" />
          <FilterInput label="Currency" value={filters.currency ?? ''} onChange={(v) => updateFilter('currency', v)} />
          <FilterInput label="Campaign / source" value={filters.campaignSource ?? ''} onChange={(v) => updateFilter('campaignSource', v)} />
          <FilterSelect
            label="Payment status"
            value={filters.paymentStatus ?? ''}
            onChange={(v) => updateFilter('paymentStatus', v)}
            options={['trialing', 'active', 'past_due', 'cancelled', 'unpaid', 'incomplete']}
          />
          <FilterSelect
            label="Trial / paid"
            value={filters.trialOrPaid ?? ''}
            onChange={(v) => updateFilter('trialOrPaid', v)}
            options={['trial', 'paid']}
          />
          <FilterSelect
            label="Cancellation status"
            value={filters.cancellationStatus ?? ''}
            onChange={(v) => updateFilter('cancellationStatus', v)}
            options={['requested', 'none']}
          />
          <FilterInput label="Studdy group" value={filters.groupName ?? ''} onChange={(v) => updateFilter('groupName', v)} />
          <FilterInput label="From (created)" type="date" value={filters.from ?? ''} onChange={(v) => updateFilter('from', v)} />
          <FilterInput label="To (created)" type="date" value={filters.to ?? ''} onChange={(v) => updateFilter('to', v)} />
        </div>
      </SectionCard>

      <SectionCard title="Customers" description={listData ? `${listData.total_matching} matching (capped at ${listData.row_cap})` : undefined}>
        {listError && listData && (
          <p role="alert" className="text-[12.5px] font-bold mb-3" style={{ color: 'var(--g1)' }}>
            Last refresh failed — showing the most recently loaded data. {listError}
          </p>
        )}
        {listData && listData.customers.length === 0 ? (
          <div className="text-[13px] font-semibold py-8 text-center" style={{ color: 'var(--soft)' }}>
            No customers match these filters.
          </div>
        ) : (
          <CustomerTable rows={listData?.customers ?? []} onSelect={setSelectedCustomerId} />
        )}
      </SectionCard>

      {selectedCustomerId && (
        <CustomerDetailDrawer
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onSessionExpired={onSessionExpired}
          onSalesOwnerSaved={handleSalesOwnerSaved}
        />
      )}
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: 'var(--soft)' }}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl px-3 py-2 text-[13px] font-semibold"
        style={{ background: 'var(--dim)', border: '1px solid var(--border)', color: 'var(--ink)' }}
      />
    </label>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: 'var(--soft)' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl px-3 py-2 text-[13px] font-semibold"
        style={{ background: 'var(--dim)', border: '1px solid var(--border)', color: 'var(--ink)' }}
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function CustomerTable({ rows, onSelect }: { rows: CustomerListRow[]; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Customer', 'Stage', 'Plan', 'Source', 'Sales Owner', 'Group'].map((h) => (
              <th key={h} className="text-left py-2 px-2 font-black uppercase tracking-wide text-[10.5px]" style={{ color: 'var(--soft)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row.id)}
              className="cursor-pointer"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <td className="py-2.5 px-2">
                <div className="font-bold" style={{ color: 'var(--ink)' }}>{row.name || row.email || row.paid_id}</div>
                <div style={{ color: 'var(--soft)' }}>{row.email}</div>
              </td>
              <td className="py-2.5 px-2">
                <span className="font-bold" style={{ color: TONE_COLORS[stageTone(row.lifecycle.stage)] }}>
                  {row.lifecycle.stage}
                </span>
              </td>
              <td className="py-2.5 px-2" style={{ color: 'var(--ink)' }}>
                {row.plan_type ?? '—'} {row.currency ?? ''}
              </td>
              <td className="py-2.5 px-2" style={{ color: 'var(--ink)' }}>{row.latest_utm_source ?? row.first_utm_source ?? 'direct'}</td>
              <td className="py-2.5 px-2" style={{ color: 'var(--ink)' }}>{row.sales_owner ?? 'Unassigned'}</td>
              <td className="py-2.5 px-2" style={{ color: 'var(--ink)' }}>{row.group_name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

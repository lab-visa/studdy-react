/**
 * CRM-2B — Command Center: the Executive Command Center page. Fetches
 * GET /api/admin/metrics (the existing, unmodified CRM-2A endpoint),
 * manages the reporting-period + cohort controls, and composes every
 * dashboard section from the one response. Read-only — this page never
 * writes anything back to the API.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RangePreset } from '../../utils/reportingRange';
import { resolveRange, isValidCustomRange } from '../../utils/reportingRange';
import type { AdminMetricsResponse } from '../../types/adminMetrics';
import RangeControls from '../../components/admin/RangeControls';
import CohortControl from '../../components/admin/CohortControl';
import RefreshBar from '../../components/admin/RefreshBar';
import AlertsBanner from '../../components/admin/AlertsBanner';
import { DashboardSkeleton, ErrorState } from '../../components/admin/StateViews';
import ExecutiveOverview from '../../components/admin/sections/ExecutiveOverview';
import AcquisitionFunnel from '../../components/admin/sections/AcquisitionFunnel';
import SubscriptionHealth from '../../components/admin/sections/SubscriptionHealth';
import RevenueOverview from '../../components/admin/sections/RevenueOverview';
import ChurnOverview from '../../components/admin/sections/ChurnOverview';
import CapacitySection from '../../components/admin/sections/CapacitySection';
import DisputesSection from '../../components/admin/sections/DisputesSection';

interface CommandCenterProps {
  /** Called when the metrics endpoint itself reports the session is no longer valid (401 after initial load). */
  onSessionExpired: () => void;
}

export default function CommandCenter({ onSessionExpired }: CommandCenterProps) {
  const [preset, setPreset] = useState<RangePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [cohortFrom, setCohortFrom] = useState('');
  const [cohortTo, setCohortTo] = useState('');

  const [data, setData] = useState<AdminMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true); // first load only
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolved = useMemo(
    () => resolveRange(preset, preset === 'custom' ? { from: customFrom, to: customTo } : undefined),
    [preset, customFrom, customTo]
  );
  const rangeIsUsable = preset !== 'custom' || isValidCustomRange(customFrom, customTo);

  const cohortHasSelection = Boolean(cohortFrom && cohortTo);
  const cohortIsUsable = !cohortHasSelection || isValidCustomRange(cohortFrom, cohortTo);

  // One stable key describing "what should currently be fetched" — the
  // effect below re-fetches exactly when this changes, and never on a
  // timer. Deliberately excludes the invalid states above so an
  // in-progress/invalid custom range never triggers a request.
  const fetchKey = rangeIsUsable && cohortIsUsable
    ? JSON.stringify({ from: resolved.from ?? null, to: resolved.to ?? null, cohortFrom: cohortHasSelection ? cohortFrom : null, cohortTo: cohortHasSelection ? cohortTo : null })
    : null;

  const runFetch = useCallback(async () => {
    if (fetchKey === null) return;
    const parsed = JSON.parse(fetchKey) as { from: string | null; to: string | null; cohortFrom: string | null; cohortTo: string | null };

    setError(null);
    const params = new URLSearchParams();
    if (parsed.from) params.set('from', parsed.from);
    if (parsed.to) params.set('to', parsed.to);
    if (parsed.cohortFrom && parsed.cohortTo) {
      params.set('cohortFrom', parsed.cohortFrom);
      params.set('cohortTo', parsed.cohortTo);
    }

    try {
      const res = await fetch(`/api/admin/metrics?${params.toString()}`, { credentials: 'same-origin' });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      if (!res.ok) {
        throw new Error(`Request failed (HTTP ${res.status})`);
      }
      const json = (await res.json()) as AdminMetricsResponse;
      setData(json);
    } catch {
      setError('The dashboard couldn’t reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchKey, onSessionExpired]);

  useEffect(() => {
    if (fetchKey === null) return;
    if (data !== null) setRefreshing(true);
    runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    runFetch();
  };

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={runFetch} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className="rounded-2xl p-4 sm:p-5 flex flex-col gap-4"
        style={{ background: '#fff', border: '1px solid var(--border)' }}
      >
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wide mb-1.5" style={{ color: 'var(--soft)' }}>
              Reporting period
            </div>
            <RangeControls
              preset={preset}
              onPresetChange={setPreset}
              customFrom={customFrom}
              customTo={customTo}
              onCustomChange={(f, t) => {
                setCustomFrom(f);
                setCustomTo(t);
              }}
              rangeLabel={resolved.label}
            />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-wide mb-1.5" style={{ color: 'var(--soft)' }}>
              Trial → paid cohort (14-day window)
            </div>
            <CohortControl
              cohortFrom={cohortFrom}
              cohortTo={cohortTo}
              onChange={(f, t) => {
                setCohortFrom(f);
                setCohortTo(t);
              }}
            />
          </div>
        </div>
        <RefreshBar generatedAt={data?.generated_at ?? null} refreshing={refreshing} onRefresh={handleManualRefresh} />
      </div>

      {error && data && (
        <p role="alert" className="text-[12.5px] font-bold" style={{ color: '#c4278c' }}>
          Last refresh failed — showing the most recently loaded data. {error}
        </p>
      )}

      {data && (
        <>
          <AlertsBanner metrics={data.metrics} />
          <ExecutiveOverview metrics={data.metrics} />
          <AcquisitionFunnel metrics={data.metrics} />
          <SubscriptionHealth metrics={data.metrics} />
          <RevenueOverview metrics={data.metrics} />
          <ChurnOverview metrics={data.metrics} />
          <CapacitySection metrics={data.metrics} />
          <DisputesSection metrics={data.metrics} />
        </>
      )}
    </div>
  );
}

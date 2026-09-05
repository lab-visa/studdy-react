/**
 * CRM-3A — full single-customer detail panel. Fetches
 * GET /api/admin/customer-detail?id=... on open, renders the required
 * field list (Name/Email/Phone/Country/Original+Latest source/Plan/
 * Currency/Stripe refs/Trial dates/Next payment/Subscription status/
 * Cancellation status/Access+group/Sales Owner) plus the IST activity
 * timeline, and lets an admin set/clear Sales Owner
 * (PATCH /api/admin/customer-sales-owner) — the one write action this
 * round ships.
 */
import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import type { ActivityTimelineCursor, CustomerDetailResponse } from '../../types/customerPipeline';
import { stageTone } from '../../utils/lifecycleDisplay';

interface Props {
  customerId: string;
  onClose: () => void;
  onSessionExpired: () => void;
  /** Called after a successful Sales Owner save, so the list behind this drawer can refresh. */
  onSalesOwnerSaved: (customerId: string, salesOwner: string | null) => void;
}

const TONE_COLORS: Record<string, string> = {
  neutral: 'var(--soft)',
  positive: 'var(--g4)',
  warning: '#b8860b',
  danger: 'var(--g1)',
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: 'var(--soft)' }}>
        {label}
      </div>
      <div className="text-[13.5px] font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

export default function CustomerDetailDrawer({ customerId, onClose, onSessionExpired, onSalesOwnerSaved }: Props) {
  const [data, setData] = useState<CustomerDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownerDraft, setOwnerDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // CRM-3A ChatGPT review round 3 — "genuine server-side pagination":
  // the Activity Timeline is now cursor/keyset-paginated (migration
  // 0018's search_customer_activity_timeline), not OFFSET/page-number.
  // cursorStack[0] is always null (the first page); cursorStack[i] for
  // i>0 is the cursor that fetches page i+1. cursorIndex is which page
  // is currently displayed — Previous just moves the index back
  // (no refetch of a NEW cursor needed, the stack already holds it);
  // Next either reuses an already-known cursor (the user went back then
  // forward again) or, at the tail, pushes the cursor the last response
  // just gave us.
  const [cursorStack, setCursorStack] = useState<Array<ActivityTimelineCursor | null>>([null]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const currentCursor = cursorStack[cursorIndex] ?? null;

  useEffect(() => {
    setCursorStack([null]);
    setCursorIndex(0);
  }, [customerId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ id: customerId });
      if (currentCursor) {
        params.set('timelineCursorSortAt', currentCursor.sort_at);
        params.set('timelineCursorEventKey', currentCursor.event_key);
      }
      const res = await fetch(`/api/admin/customer-detail?${params.toString()}`, { credentials: 'same-origin' });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CustomerDetailResponse;
      setData(json);
      setOwnerDraft(json.customer.sales_owner ?? '');
    } catch {
      setError('Could not load this customer.');
    } finally {
      setLoading(false);
    }
  }, [customerId, currentCursor, onSessionExpired]);

  const handleTimelineNext = () => {
    setCursorStack((prev) => {
      // Discard any stale forward history past the current page (the
      // user went back and is now paging forward again down a
      // different tail) and append the cursor the last response gave
      // us for "the page after this one".
      const next = prev.slice(0, cursorIndex + 1);
      if (data?.timeline_next_cursor) next.push(data.timeline_next_cursor);
      return next;
    });
    setCursorIndex((i) => i + 1);
  };

  const handleTimelinePrevious = () => {
    setCursorIndex((i) => Math.max(0, i - 1));
  };

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveOwner = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/admin/customer-sales-owner', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, salesOwner: ownerDraft.trim() || null }),
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      onSalesOwnerSaved(customerId, json.customer.sales_owner ?? null);
      await load();
    } catch {
      setSaveError('Could not save Sales Owner — try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Customer detail">
      <button aria-label="Close" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside
        className="relative h-full w-full sm:w-[480px] max-w-full overflow-y-auto p-5 sm:p-6 flex flex-col gap-5"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="font-black text-[17px]" style={{ color: 'var(--ink)' }}>
              {data?.customer.name || 'Customer detail'}
            </div>
            {data && (
              <div className="text-[12px] font-semibold mt-0.5" style={{ color: 'var(--soft)' }}>
                {data.customer.paid_id}
              </div>
            )}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 -mr-1.5 -mt-1.5">
            <X size={18} />
          </button>
        </div>

        {loading && <div className="text-[13px] font-semibold" style={{ color: 'var(--soft)' }}>Loading…</div>}
        {error && (
          <div role="alert" className="text-[13px] font-semibold" style={{ color: 'var(--g1)' }}>
            {error}
          </div>
        )}

        {data && (
          <>
            <div
              className="rounded-xl px-3 py-2 text-[12.5px] font-black inline-block w-fit"
              style={{ background: 'var(--dim)', color: TONE_COLORS[stageTone(data.lifecycle.stage)] }}
            >
              {data.lifecycle.stage}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Email" value={data.customer.email} />
              <Field label="Phone" value={data.customer.phone} />
              <Field label="Country / region" value={data.customer.country} />
              <Field label="Plan" value={data.subscription?.plan_type} />
              <Field label="Stripe customer" value={data.customer.stripe_customer_id} />
              <Field label="Stripe subscription" value={data.subscription?.stripe_subscription_id} />
              <Field label="Subscription status" value={data.subscription?.status} />
              <Field label="Trial start (IST)" value={data.subscription?.trial_start_ist} />
              <Field label="Trial end (IST)" value={data.subscription?.trial_end_ist} />
              <Field label={`${data.billing.next_expected_payment_label} (IST)`} value={data.billing.next_expected_payment_date_ist} />
              <Field
                label="Expected amount"
                value={data.billing.expected_amount != null ? `${data.billing.expected_currency ?? ''} ${data.billing.expected_amount}` : null}
              />
              <Field label="Cancellation status" value={data.cancellation.open_request?.status ?? 'None open'} />
              <Field label="Access status" value={data.access.access_status} />
              <Field label="Studdy group" value={data.access.group_name} />
            </div>

            <div>
              <div className="text-[10.5px] font-black uppercase tracking-wide mb-1" style={{ color: 'var(--soft)' }}>
                Campaign attribution
              </div>
              <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                <div>
                  <div className="font-bold" style={{ color: 'var(--soft)' }}>Original (first touch)</div>
                  <div style={{ color: 'var(--ink)' }}>{data.customer.attribution.first_touch.utm_source ?? 'direct'}</div>
                  <div style={{ color: 'var(--soft)' }}>{data.customer.attribution.first_touch.utm_campaign ?? '—'}</div>
                </div>
                <div>
                  <div className="font-bold" style={{ color: 'var(--soft)' }}>Latest touch</div>
                  <div style={{ color: 'var(--ink)' }}>{data.customer.attribution.latest_touch.utm_source ?? 'direct'}</div>
                  <div style={{ color: 'var(--soft)' }}>{data.customer.attribution.latest_touch.utm_campaign ?? '—'}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[10.5px] font-black uppercase tracking-wide mb-1.5" style={{ color: 'var(--soft)' }}>
                Sales Owner
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ownerDraft}
                  onChange={(e) => setOwnerDraft(e.target.value)}
                  placeholder="Unassigned"
                  className="flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold"
                  style={{ background: 'var(--dim)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                />
                <button type="button" onClick={handleSaveOwner} disabled={saving} className="gbtn py-2! px-4!">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              {saveError && (
                <div role="alert" className="text-[12px] font-semibold mt-1" style={{ color: 'var(--g1)' }}>
                  {saveError}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <div className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: 'var(--soft)' }}>
                  Activity timeline (IST)
                </div>
                {data.timeline_total_count > 0 && (
                  <div className="text-[11px] font-semibold" style={{ color: 'var(--soft)' }}>
                    {`${cursorIndex * data.timeline_page_size + 1}–${Math.min(cursorIndex * data.timeline_page_size + data.activity_timeline.length, data.timeline_total_count)} of ${data.timeline_total_count}`}
                  </div>
                )}
              </div>
              {data.activity_timeline.length === 0 ? (
                <div className="text-[12.5px] font-medium" style={{ color: 'var(--soft)' }}>No activity recorded yet.</div>
              ) : (
                <>
                  <ul className="flex flex-col gap-2">
                    {/* Backend already sorts newest-first with a stable,
                        genuinely unique secondary key — each entry's own
                        event_key (migration 0018's
                        search_customer_activity_timeline), used as the
                        list key below instead of the array index — no
                        client-side re-sort. */}
                    {data.activity_timeline.map((entry) => (
                      <li key={entry.event_key} className="text-[12.5px]" style={{ borderLeft: '2px solid var(--border)', paddingLeft: '10px' }}>
                        <div className="font-bold" style={{ color: 'var(--ink)' }}>{entry.label}</div>
                        <div style={{ color: 'var(--soft)' }}>{entry.occurred_at_ist ?? 'Date unavailable'}</div>
                        {entry.detail && <div style={{ color: 'var(--soft)' }}>{entry.detail}</div>}
                      </li>
                    ))}
                  </ul>
                  {(data.timeline_has_previous || data.timeline_has_next) && (
                    <div className="flex items-center justify-between mt-2.5">
                      <button
                        type="button"
                        className="gbtn py-1.5! px-3! text-[12px]!"
                        disabled={!data.timeline_has_previous || loading}
                        onClick={handleTimelinePrevious}
                      >
                        Previous
                      </button>
                      <div className="text-[11px] font-semibold" style={{ color: 'var(--soft)' }}>
                        Page {cursorIndex + 1}
                        {data.timeline_total_count > 0
                          ? ` of ${Math.ceil(data.timeline_total_count / data.timeline_page_size)}`
                          : ''}
                      </div>
                      <button
                        type="button"
                        className="gbtn py-1.5! px-3! text-[12px]!"
                        disabled={!data.timeline_has_next || loading}
                        onClick={handleTimelineNext}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

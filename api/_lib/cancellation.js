/**
 * Single shared definition of "open cancellation workflow" — used by both
 * api/cancel-request.js (application-level pre-check) and
 * api/admin/reconciliation.js (check #5), so the two can never disagree
 * with each other or with the database constraint
 * (cancellation_requests_one_open_per_customer, migration 0013).
 *
 * Verified directly against migration 0006's own column comment on
 * cancellation_requests.status:
 *   pending_discussion | retained | approved_for_cancellation |
 *   cancel_scheduled | cancelled
 * The three below are the non-terminal ("open") states; retained and
 * cancelled are resolved/terminal and do not block a future request.
 */
export const OPEN_CANCELLATION_STATUSES = [
  'pending_discussion',
  'approved_for_cancellation',
  'cancel_scheduled',
];

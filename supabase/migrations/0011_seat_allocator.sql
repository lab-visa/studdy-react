-- ============================================================
-- HISTORICAL BASELINE — ALREADY APPLIED TO PRODUCTION.
-- Confirmed live via CRM-0B (read-only Supabase verification,
-- Aug 2026). Committed here for version-control history only.
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- ============================================================
-- 0011_seat_allocator.sql — Phase 4
--
-- The atomic, concurrency-safe Studdy AI seat allocator that was
-- deliberately left out of 0007. This is what makes it impossible for two
-- customers starting a trial at nearly the same instant to both be handed
-- the same last-open seat.
--
-- How it stays safe under concurrency: instead of "read the current count,
-- then decide, then write" (which has a gap where two transactions can
-- both read the same "6 of 7 full" count and both decide there's room),
-- this takes a transaction-scoped lock on ONE candidate account at a time
-- before checking its real, current count. A second transaction trying
-- the same account simply waits for the first to finish (commit or roll
-- back) before it's allowed to check that account's count itself — so the
-- count it sees is always genuinely up to date, never stale.
--
-- "Earliest account first" = ordered by group_name. If your account
-- naming isn't already in creation order (Group A before Group B before
-- Group C, etc.), tell me and I'll switch this to a real created_at
-- column instead.
--
-- IMPORTANT — scope: this only manages the NEW account_assignments ledger
-- (used for CRM seat reporting). It does NOT touch, replace, or influence
-- which real Studdy AI login a paying customer actually receives today —
-- that still runs entirely through the existing, unchanged logic in
-- api/_lib/sync-checkout-session.js. The two are wired to run side by
-- side, not merged, so nothing about a real customer's actual credentials
-- can be affected by this change.

create or replace function allocate_studdy_seat(p_customer_id uuid) returns uuid as $$
declare
  v_account record;
  v_current_count integer;
begin
  for v_account in
    select id, max_capacity from studdy_accounts order by group_name asc
  loop
    -- Held only for the rest of THIS transaction — released automatically
    -- the instant this function's caller commits or rolls back.
    perform pg_advisory_xact_lock(hashtext(v_account.id::text));

    select count(*) into v_current_count
    from account_assignments
    where studdy_account_id = v_account.id
      and status in ('active', 'reserved');

    if v_current_count < v_account.max_capacity then
      insert into account_assignments (studdy_account_id, customer_id, status)
      values (v_account.id, p_customer_id, 'active')
      on conflict do nothing;
      return v_account.id;
    end if;
  end loop;

  -- Every account is genuinely full — nothing unsafe happened, there's
  -- just nowhere left to put them. Needs a new studdy_accounts row added
  -- manually, same as the existing legacy system already requires today.
  return null;
end;
$$ language plpgsql;

comment on function allocate_studdy_seat is
  'Atomically assigns a customer to the earliest Studdy AI account with a free seat, in the new account_assignments ledger only. Returns the account id, or null if every account is full. Never overfills an account, even under two simultaneous calls.';

-- Companion release function — frees a seat when a subscription actually
-- ends, so the allocator above sees the true, current count next time.
create or replace function release_studdy_seat(p_customer_id uuid) returns void as $$
begin
  update account_assignments
  set status = 'released', released_at = now(), updated_at = now()
  where customer_id = p_customer_id and status = 'active';
end;
$$ language plpgsql;

comment on function release_studdy_seat is
  'Marks a customer''s current seat assignment released, freeing that spot for allocate_studdy_seat to hand to someone else.';

-- 0019_restrict_rls_auto_enable.sql
--
-- CRM-3A Round-5 Codex review — read-only production Supabase preflight
-- found that Supabase's security advisor flags public.rls_auto_enable()
-- (a SECURITY DEFINER function, owned by postgres) as EXECUTE-able by
-- PUBLIC, anon, and authenticated. This migration narrowly revokes that
-- and confirms service-role/administrative access is preserved. Nothing
-- else about the function is touched.
--
-- WHAT THIS FUNCTION ACTUALLY IS (confirmed via live, read-only catalog
-- inspection against production — no application code in this repo
-- created it, and it predates every tracked migration; it was created
-- directly against the database, which is also why "Supabase migration
-- history is empty" per the preflight):
--
--   * It is the handler function for an existing DDL event trigger named
--     `ensure_rls` (event ddl_command_end, enabled), whose job is to
--     automatically `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on every
--     new table created in the public schema. Helpful safety net; this
--     migration does not touch the event trigger itself, only who may
--     directly EXECUTE the function it calls.
--   * Its return type is `event_trigger` — a pseudo-type. Postgres
--     refuses to invoke ANY function with this return type through a
--     normal call (`SELECT rls_auto_enable()`) for every role, including
--     superusers: it raises "trigger functions can only be called as
--     triggers" once the EXECUTE-privilege check has already passed.
--     Confirmed by direct experiment (see delivery report). In other
--     words, the EXECUTE grant this migration revokes was never
--     practically callable by anon/authenticated to begin with — Postgres
--     itself was already the backstop — but the grant is still a real,
--     unnecessary attack-surface entry the advisor is right to flag
--     (defense in depth: least privilege regardless of a second,
--     independent restriction; also protects against any future Postgres
--     change to that restriction). This migration closes it explicitly.
--   * search_path is already pinned (`SET search_path TO 'pg_catalog'`)
--     — this migration does not change the function body, its
--     SECURITY DEFINER attribute, or its search_path; only its grants.
--
-- Idempotent / safely repeatable: guarded by to_regprocedure() so this
-- is a no-op wherever the function doesn't exist (every local/CI test
-- database built from this migration set, since no migration file
-- creates it) and a stable, repeatable no-op change in production if run
-- more than once. REVOKE of a privilege that isn't held, and GRANT of a
-- privilege already held, are both no-ops in Postgres — never errors.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    -- Matches this repo's established pattern for locking down a
    -- function's EXECUTE privilege (see 0017_customer_pipeline_pagination.sql
    -- and 0018_customer_activity_timeline.sql's own REVOKE/GRANT pairs):
    -- explicit REVOKE from every browser-facing role, explicit GRANT to
    -- service_role only.
    revoke execute on function public.rls_auto_enable() from public;
    revoke execute on function public.rls_auto_enable() from anon;
    revoke execute on function public.rls_auto_enable() from authenticated;

    -- service_role is the only role this repo's backend ever connects
    -- as with elevated privileges (see api/_lib/supabase.js) — preserved
    -- explicitly so a future REVOKE-from-PUBLIC-style cleanup can never
    -- accidentally take this away too. postgres (the function's owner)
    -- always retains implicit EXECUTE regardless of any GRANT/REVOKE
    -- here, so it needs no explicit grant.
    grant execute on function public.rls_auto_enable() to service_role;

    comment on function public.rls_auto_enable() is
      'DDL event-trigger handler for the ensure_rls event trigger (auto-enables RLS on new public-schema tables). SECURITY DEFINER; EXECUTE restricted to service_role/postgres only as of migration 0019 — PUBLIC/anon/authenticated must never be able to call this directly, even though its event_trigger return type already makes any direct call fail regardless of privilege.';
  end if;
end;
$$;

-- Stint + Stint Ledger household lockdown (2026-10-22).
-- APPLIED 2026-10-22; do not re-run. Run by hand in the Supabase SQL Editor for project
-- xxsjfeafpzzcmadyvuue, after Anyone Can Parent's household setup (part 1),
-- which creates public.household_members and public.is_household().
-- Rollback: 2026-10-22_stint_rollback.sql.
--
-- Tables: Stint owns stint_clients, stint_projects, stint_time_entries,
-- stint_pencils, stint_invoices, stint_settings, stint_day_notes. Stint Ledger
-- reads the first six and owns ledger_sync. Nothing else in the suite reads them.
--
-- For each table that exists:
--   * RLS on
--   * revoke all from anon (anon has a select grant on all eight today;
--     RLS hides the rows, but the grant goes)
--   * drop EVERY existing policy on the table, not only the
--     "auth.uid() is not null" ones: permissive policies are OR-ed, so a leftover
--     "Authenticated read ... using (true)" (added by hand on 2026-03-26) would
--     keep the table open to any signed-in account
--   * one policy, household_only: for all to authenticated
--     using (public.is_household()) with check (public.is_household())
-- authenticated and service_role grants are left as they are.
--
-- Before changing anything, the first run saves the live policies, anon grants
-- and RLS flags to the private schema lockdown_backup (not exposed by the API).
-- Re-runs keep that first snapshot, so the rollback always restores the state
-- from before the first run. Re-runnable: every step is guarded.

begin;

do $$
begin
  if to_regprocedure('public.is_household()') is null then
    raise exception 'public.is_household() is missing: run the ACP household setup (part 1) first';
  end if;
end $$;

-- 1. Snapshot for the rollback (first run only)
create schema if not exists lockdown_backup;
revoke all on schema lockdown_backup from public, anon, authenticated;

create table if not exists lockdown_backup.stint_2026_10_22_policies as
select p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
from pg_policies p
where p.schemaname = 'public'
  and p.tablename = any (array['stint_clients','stint_projects','stint_time_entries','stint_pencils',
                               'stint_invoices','stint_settings','stint_day_notes','ledger_sync']);

create table if not exists lockdown_backup.stint_2026_10_22_anon_grants as
select c.relname::text as table_name, a.privilege_type
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(c.relacl) a
where n.nspname = 'public'
  and a.grantee = 'anon'::regrole
  and c.relname = any (array['stint_clients','stint_projects','stint_time_entries','stint_pencils',
                             'stint_invoices','stint_settings','stint_day_notes','ledger_sync']);

create table if not exists lockdown_backup.stint_2026_10_22_rls as
select c.relname::text as table_name, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname = any (array['stint_clients','stint_projects','stint_time_entries','stint_pencils',
                             'stint_invoices','stint_settings','stint_day_notes','ledger_sync']);

revoke all on all tables in schema lockdown_backup from public, anon, authenticated;

-- 2. Lock each table
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['stint_clients','stint_projects','stint_time_entries','stint_pencils',
                           'stint_invoices','stint_settings','stint_day_notes','ledger_sync']
  loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'skipping %: table does not exist', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);

    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t and policyname <> 'household_only'
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format('drop policy if exists household_only on public.%I', t);
    execute format(
      'create policy household_only on public.%I as permissive for all to authenticated '
      'using (public.is_household()) with check (public.is_household())', t);
  end loop;
end $$;

commit;

-- 3. Verify (read-only). Expect for every table: rls_on = true,
--    policies = household_only [ALL to authenticated], anon_grants = null.
select c.relname as table_name,
       c.relrowsecurity as rls_on,
       (select string_agg(p.policyname || ' [' || p.cmd || ' to ' || array_to_string(p.roles, ',') || ']', '; '
                          order by p.policyname)
          from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as policies,
       (select string_agg(a.privilege_type, ',' order by a.privilege_type)
          from aclexplode(c.relacl) a
         where a.grantee = 'anon'::regrole) as anon_grants
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = any (array['stint_clients','stint_projects','stint_time_entries','stint_pencils',
                             'stint_invoices','stint_settings','stint_day_notes','ledger_sync'])
order by 1;

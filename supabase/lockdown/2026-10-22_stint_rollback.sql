-- Rollback for 2026-10-22_stint.sql. WRITTEN, NOT APPLIED.
-- Restores the Stint and Stint Ledger tables to exactly the state saved by the
-- lockdown's first run: every policy as it was (name, permissive/restrictive,
-- command, roles, using, with check), the anon grants, and the RLS flags.
-- Refuses to run if that snapshot is missing. Drops the snapshot at the end, so
-- running the lockdown again takes a fresh one.
--
-- For reference, the state the repo documents (live may differ; the snapshot is
-- what gets restored):
--   stint_clients, stint_projects, stint_time_entries, stint_pencils,
--   stint_invoices, stint_settings (stint 001/002):
--     "auth_stint_<name>" for all to public
--       using (auth.uid() is not null) with check (auth.uid() is not null)
--   stint_day_notes (stint 004): "auth_stint_day_notes", same shape
--   the six tables above except stint_day_notes (by hand, 2026-03-26):
--     "Authenticated read" for select to authenticated using (true)
--   ledger_sync (by hand, 2026-03-26):
--     "Authenticated read/write" for all to authenticated using (true) with check (true)
--   anon: select, insert, update, delete granted on all stint_* tables by the
--   migrations; select confirmed live on all eight tables on 2026-10-22.

begin;

do $$
begin
  if to_regclass('lockdown_backup.stint_2026_10_22_policies') is null
     or to_regclass('lockdown_backup.stint_2026_10_22_anon_grants') is null
     or to_regclass('lockdown_backup.stint_2026_10_22_rls') is null then
    raise exception 'snapshot missing in schema lockdown_backup: the lockdown was never applied here, nothing to roll back';
  end if;
end $$;

do $$
declare
  t text;
  p record;
  g record;
  r record;
begin
  -- Remove the household policy (and anything else added since), table by table
  foreach t in array array['stint_clients','stint_projects','stint_time_entries','stint_pencils',
                           'stint_invoices','stint_settings','stint_day_notes','ledger_sync']
  loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;

  -- Recreate the saved policies exactly
  for p in select * from lockdown_backup.stint_2026_10_22_policies loop
    if to_regclass(format('public.%I', p.tablename)) is null then
      raise notice 'skipping policy % on %: table does not exist', p.policyname, p.tablename;
      continue;
    end if;
    execute format(
      'create policy %I on public.%I as %s for %s to %s%s%s',
      p.policyname, p.tablename, lower(p.permissive), lower(p.cmd),
      (select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ')
         from unnest(p.roles::text[]) as x),
      case when p.qual is not null then ' using (' || p.qual || ')' else '' end,
      case when p.with_check is not null then ' with check (' || p.with_check || ')' else '' end);
  end loop;

  -- Restore the anon grants
  for g in select * from lockdown_backup.stint_2026_10_22_anon_grants loop
    if to_regclass(format('public.%I', g.table_name)) is null then
      continue;
    end if;
    execute format('grant %s on table public.%I to anon', g.privilege_type, g.table_name);
  end loop;

  -- Restore the RLS flags
  for r in select * from lockdown_backup.stint_2026_10_22_rls loop
    if to_regclass(format('public.%I', r.table_name)) is null then
      continue;
    end if;
    execute format('alter table public.%I %s row level security', r.table_name,
                   case when r.relrowsecurity then 'enable' else 'disable' end);
    execute format('alter table public.%I %s row level security', r.table_name,
                   case when r.relforcerowsecurity then 'force' else 'no force' end);
  end loop;
end $$;

drop table lockdown_backup.stint_2026_10_22_policies;
drop table lockdown_backup.stint_2026_10_22_anon_grants;
drop table lockdown_backup.stint_2026_10_22_rls;

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'lockdown_backup') then
    execute 'drop schema lockdown_backup';
  end if;
end $$;

commit;

-- Verify (read-only): policies, RLS and anon grants should match the snapshot.
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

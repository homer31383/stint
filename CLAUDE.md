### Table grants (required since Supabase change, Oct 30 2026)

- Every new table in `public` must be granted explicitly in the same SQL that creates it, whether it's a migration file or run in the dashboard SQL editor:
  `grant select, insert, update, delete on public.<table> to anon, authenticated, service_role;`
- RLS is enabled on every table here. The grant only opens the door; policies still control which rows each role can read or write. Grant all three roles anyway so new tables match the existing ones. Do not copy Supabase's default example, which gives anon select only.
- If supabase-js returns "permission denied" on a table, check for a missing grant first, then check that table's RLS policies.
- To list public tables that are missing anon write access:
  `select table_name from information_schema.tables t where table_schema = 'public' and table_type = 'BASE TABLE' and not exists (select 1 from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name = t.table_name and g.grantee = 'anon' and g.privilege_type = 'INSERT');`

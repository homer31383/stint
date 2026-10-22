> **Security source of truth:** read `D:\AI\Claude\SECURITY-STATE.md` before changing sign-in, keys, grants, RLS, storage or any public-facing page. It overrides anything in this file that says otherwise (PIN gates, user pickers, RLS off, anon grants, legacy anon or service_role keys, public tables).

### Table grants (required since Supabase change, Oct 30 2026)

- Every new table in `public` gets explicit grants in the same SQL that creates it, whether it's a migration file or run in the dashboard SQL editor. Never grant anon.
  - Default (server-only table): `grant select, insert, update, delete on public.<table> to service_role;`
  - Browser-readable table: also grant `authenticated`, but only together with `alter table public.<table> enable row level security;` and RLS policies that limit which rows each user can read or write.
- Do not copy Supabase's default example, which grants anon.
- If supabase-js returns "permission denied" on a table, check for a missing grant first, then check that table's RLS policies.
- To list public tables anon can still reach (the project is shared, so other apps' tables may appear; none of ours should):
  `select distinct table_name from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon' order by 1;`

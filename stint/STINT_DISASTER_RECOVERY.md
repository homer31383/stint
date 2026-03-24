# Stint — Disaster Recovery & Full Rebuild Guide

If you need to rebuild Stint from scratch, this document contains everything needed.

## 1. Clone & Install

```bash
git clone https://github.com/homer31383/stint.git
cd stint
npm install
```

## 2. Environment Variables

Create `.env.local` in the project root:
```
VITE_SUPABASE_URL=https://xxsjfeafpzzcmadyvuue.supabase.co
VITE_SUPABASE_ANON_KEY=<get from Supabase dashboard → Settings → API → anon/public key>
```

The Supabase project is shared with Axiom. Log in at https://supabase.com/dashboard with the account that owns the `xxsjfeafpzzcmadyvuue` project.

**For Vercel**, set the same two vars in the Vercel dashboard under Settings → Environment Variables.

## 3. Database Setup (Supabase SQL Editor)

Run these migrations **in order** in the Supabase SQL Editor. Skip any that have already been applied.

### Migration 001 — Tables, Indexes, RLS

```sql
create table if not exists stint_clients (
  id text primary key, name text not null, email text, notes text,
  service_rates jsonb default '{}',
  created_at bigint default (extract(epoch from now()) * 1000)
);

create table if not exists stint_projects (
  id text primary key,
  client_id text references stint_clients(id) on delete cascade,
  name text not null,
  status text default 'active',
  director text, director_email text, producer text, producer_email text,
  production_company text, creative_director text,
  lead_3d text, lead_2d text, my_role text, due_date text, notes text,
  created_at bigint default (extract(epoch from now()) * 1000)
);

create table if not exists stint_time_entries (
  id text primary key,
  project_id text references stint_projects(id) on delete cascade,
  date text not null, hour integer,
  service_type text not null default 'day_rate',
  hours numeric default 1, rate numeric default 0, amount numeric default 0,
  notes text,
  created_at bigint default (extract(epoch from now()) * 1000)
);

create table if not exists stint_pencils (
  id text primary key,
  project_id text references stint_projects(id) on delete cascade,
  start_date text not null, end_date text not null,
  priority integer default 1, notes text,
  created_at bigint default (extract(epoch from now()) * 1000)
);

create table if not exists stint_invoices (
  id text primary key, number text,
  client_id text references stint_clients(id) on delete set null,
  client_name text, client_email text,
  entry_ids jsonb default '[]',
  line_items jsonb default '[]',
  total numeric default 0,
  status text default 'draft',
  issue_date text, due_date text, invoice_code text, notes text,
  date_range text, dates_worked jsonb default '[]',
  created_at bigint default (extract(epoch from now()) * 1000)
);

create table if not exists stint_settings (
  id text primary key default 'default',
  business_name text, business_email text, business_phone text, business_address text,
  bank_name text, routing text, account_number text,
  invoice_prefix text default 'CB', next_invoice_number integer default 2,
  payment_terms integer default 30, hide_dollars boolean default true,
  service_rates jsonb default '{}'
);

create index if not exists idx_stint_te_date on stint_time_entries(date);
create index if not exists idx_stint_te_proj on stint_time_entries(project_id);
create index if not exists idx_stint_pencils_dates on stint_pencils(start_date, end_date);
create index if not exists idx_stint_proj_client on stint_projects(client_id);
create index if not exists idx_stint_inv_status on stint_invoices(status);

alter table stint_clients enable row level security;
alter table stint_projects enable row level security;
alter table stint_time_entries enable row level security;
alter table stint_pencils enable row level security;
alter table stint_invoices enable row level security;
alter table stint_settings enable row level security;
```

### Migration 002 — Auth RLS Policies

```sql
create policy "auth_stint_clients" on stint_clients
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "auth_stint_projects" on stint_projects
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "auth_stint_time_entries" on stint_time_entries
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "auth_stint_pencils" on stint_pencils
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "auth_stint_invoices" on stint_invoices
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "auth_stint_settings" on stint_settings
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
```

### Migration 003 — updated_at Column

```sql
ALTER TABLE stint_clients ADD COLUMN IF NOT EXISTS updated_at bigint;
ALTER TABLE stint_projects ADD COLUMN IF NOT EXISTS updated_at bigint;
ALTER TABLE stint_time_entries ADD COLUMN IF NOT EXISTS updated_at bigint;
ALTER TABLE stint_pencils ADD COLUMN IF NOT EXISTS updated_at bigint;
ALTER TABLE stint_invoices ADD COLUMN IF NOT EXISTS updated_at bigint;
ALTER TABLE stint_settings ADD COLUMN IF NOT EXISTS updated_at bigint;

UPDATE stint_clients SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE stint_projects SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE stint_time_entries SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE stint_pencils SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE stint_invoices SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE stint_settings SET updated_at = extract(epoch from now()) * 1000 WHERE updated_at IS NULL;
```

### Migration 004 — contacts, paid_date, pencil client_id & rates

```sql
ALTER TABLE stint_clients ADD COLUMN IF NOT EXISTS contacts jsonb default '[]';
ALTER TABLE stint_invoices ADD COLUMN IF NOT EXISTS paid_date text;
ALTER TABLE stint_pencils ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE stint_pencils ADD COLUMN IF NOT EXISTS rates jsonb;
```

## 4. Supabase Auth Setup

1. Go to Authentication → Providers → ensure Email is enabled
2. Go to Authentication → Users → Create a user with your email and password
3. The app uses `supabase.auth.signInWithPassword()` — no OAuth providers needed

## 5. Vercel Setup

1. Go to https://vercel.com → Import Git Repository → select `homer31383/stint`
2. Framework preset: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
6. Deploy

Or from CLI:
```bash
npm install -g vercel
vercel login
npx vercel --prod
```

Production URL: https://stint-iota.vercel.app

## 6. Data Restoration

### From JSON Export
If you have a backup from Settings → Export JSON:
1. Open the app in browser
2. Open DevTools console
3. Paste:
```js
const backup = /* paste JSON here */;
Object.entries(backup).forEach(([key, val]) => {
  if (key !== 'exportedAt') localStorage.setItem('stint_' + (key === 'timeEntries' ? 'time' : key), JSON.stringify(val));
});
location.reload();
```
The sync hook will push all localStorage data to Supabase on next load.

### From Supabase directly
If the `stint_*` tables still have data, the app will pull them automatically on load. No restoration needed.

## 7. Verification Checklist

After rebuild, verify:
- [ ] App loads at production URL
- [ ] Can log in with email/password
- [ ] Dashboard shows stats (if data exists)
- [ ] Time tab: can select project, click cells to log time
- [ ] Pencils tab: can create booking, edit by clicking, see calendar
- [ ] Invoices tab: can create invoice from time entries
- [ ] Clients tab: can add client with contacts, edit
- [ ] Reports tab: shows period breakdowns
- [ ] Settings tab: bank details are masked, can toggle visibility
- [ ] Search icon in header opens search modal
- [ ] Data syncs to Supabase (check tables in dashboard)
- [ ] PWA installs on mobile (Add to Home Screen)

## 8. Data Model

```
stint_clients (1)
  ├── contacts: [{name, role, email}]  (jsonb)
  ├── service_rates: {day_rate: X, ...}  (jsonb)
  └──< stint_projects (many)     [client_id FK, ON DELETE CASCADE]
         ├──< stint_time_entries  [project_id FK, ON DELETE CASCADE]
         └──< stint_pencils       [project_id FK, ON DELETE CASCADE]
               └── rates: {day_rate: X, ...}  (jsonb, optional per-booking overrides)
  └──< stint_invoices            [client_id FK, ON DELETE SET NULL]
         └── paid_date: text  (ISO date when payment received)

stint_settings (single row, id = "default")
```

## 9. Rollback

To rollback a bad deploy:
1. Go to Vercel dashboard → Deployments
2. Find the last known good deployment
3. Click "..." → "Promote to Production"

To rollback code:
```bash
git log --oneline  # find the commit to revert to
git revert <commit-hash>
git push origin main
npx vercel --prod
```

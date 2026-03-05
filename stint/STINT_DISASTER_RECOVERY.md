# Stint — Disaster Recovery & Full Rebuild Spec

If you need to rebuild Stint from scratch, this document contains everything needed.

## 1. Infrastructure

### Supabase
- **Project**: Shared with Axiom (same Supabase instance)
- **Region**: Check Supabase dashboard
- **Auth**: Email/password auth enabled
- **All tables prefixed with `stint_`** to avoid collision with Axiom tables

### Vercel
- **Project name**: stint
- **Framework**: Vite
- **Build command**: `npm run build`
- **Output dir**: `dist`
- **Environment variables** (set in Vercel dashboard):
  - `VITE_SUPABASE_URL` — Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key

### Domain
- Production URL: `https://stint-iota.vercel.app`

## 2. Database Schema (run in order)

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

## 3. Data Model Relationships

```
stint_clients (1)
  └──< stint_projects (many)     [client_id FK, ON DELETE CASCADE]
         ├──< stint_time_entries  [project_id FK, ON DELETE CASCADE]
         └──< stint_pencils       [project_id FK, ON DELETE CASCADE]
  └──< stint_invoices            [client_id FK, ON DELETE SET NULL]

stint_settings (single row, id = "default")
```

## 4. Application Data

### Default Settings
```json
{
  "businessName": "Chris Bernier",
  "businessEmail": "chris@chrisbernier.com",
  "businessPhone": "413-219-9595",
  "businessAddress": "162 Adelphi St Apt 2D\nBrooklyn NY 11205",
  "bankName": "Santander Bank",
  "routing": "231372691",
  "accountNumber": "0116041492",
  "invoicePrefix": "CB",
  "nextInvoiceNumber": 2,
  "paymentTerms": 30,
  "hideDollars": true,
  "serviceRates": {
    "day_rate": 1200,
    "shoot_attend": 1500,
    "hourly": 150,
    "overtime": 187.5,
    "expense": 0
  }
}
```

### Service Types
| ID | Label | Default Rate | Billing |
|----|-------|-------------|---------|
| day_rate | Day Rate | $1,200 | Flat per day (divided by 8 for hourly cells) |
| shoot_attend | Shoot Attend | $1,500 | Flat per day |
| hourly | Hourly | $150 | Per hour |
| overtime | Overtime | $187.50 | Per hour |
| expense | Expense | $0 | Line item on invoices |

### Pencil Priority Levels
| Value | Label | Color |
|-------|-------|-------|
| 0 | Booked | Blue |
| 1 | 1st Pencil | Green |
| 2 | 2nd Pencil | Yellow |
| 3 | 3rd Pencil | Red |

### Invoice Statuses
draft → sent → paid (or overdue)

## 5. Design Spec

### Theme Colors
```
bg:            #f8f7f4   (warm off-white)
surface:       #ffffff   (cards)
surfaceAlt:    #f2f1ee   (secondary backgrounds)
border:        #e5e3de
text:          #1a1a1a
textSecondary: #5c5b57
textTertiary:  #9c9a94
green:         #2d8a4e   (primary accent)
red:           #c53030
yellow:        #b7791f
blue:          #2b6cb0
```

### Typography
- Font: Instrument Sans (Google Fonts)
- Weights: 400, 500, 550, 600, 700, 750
- Letter spacing: tight (-0.02em to -0.03em for headings)

### Layout
- Desktop: max-width 1100px centered, 52px header with tab nav
- Mobile: bottom nav (4 tabs + "More" overflow), sheet-style modals from bottom
- Breakpoint: 767px

### PWA Manifest
- Name: "Stint"
- Theme color: #1a1a1a
- Background: #f8f7f4
- Display: standalone
- Icons: 192px and 512px PNG

## 6. Dependencies (package.json)

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0",
    "vite-plugin-pwa": "^0.20.0"
  }
}
```

## 7. Sync Architecture

The sync hook (`src/hooks/useOfflineFirst.js`) follows a simple model:

1. **Supabase is source of truth**
2. **Pull** (mount + 10s interval): `SELECT *` from table, replace local state entirely (except local-only "personal" items)
3. **Push** (immediate, inside setter): Every `setData()` call diffs prev vs next state, fires `upsert` for new/changed items and `delete` for removed items
4. **localStorage**: Write-through mirror for offline fallback. On app load, state initializes from localStorage; Supabase pull replaces it within seconds
5. **Case conversion**: JS uses camelCase, Supabase uses snake_case. Converted at the sync boundary by `camelToSnake`/`snakeToCamel`

### Key: useOfflineFirst(key, fallback)
Returns `[data, setData]`. Used for: clients, projects, time, pencils, invoices.

### Key: useOfflineSettings(key, fallback)
Returns `[data, setData]`. Used for the single settings row.

## 8. Rebuild Steps

1. **Create new Vercel project** linked to the GitHub repo
2. **Set environment variables** in Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. **Run migrations** in Supabase SQL Editor (001 → 002 → 003 in order)
4. **Create a Supabase auth user** for yourself (Authentication → Users → Create User)
5. `npm install && npm run build && npx vercel --prod`
6. **Restore data** from most recent JSON export backup (Settings → Export JSON), or from Supabase directly if tables still exist

## 9. Backup & Restore

### Export
Settings tab → "Export JSON" button. Downloads a JSON file with all data:
```json
{
  "settings": {...},
  "clients": [...],
  "projects": [...],
  "pencils": [...],
  "timeEntries": [...],
  "invoices": [...],
  "exportedAt": "2026-03-05T..."
}
```

### Restore (manual)
To restore from a JSON backup, paste into browser console:
```js
const backup = /* paste JSON here */;
Object.entries(backup).forEach(([key, val]) => {
  if (key !== 'exportedAt') localStorage.setItem('stint_' + (key === 'timeEntries' ? 'time' : key), JSON.stringify(val));
});
location.reload();
```
The sync hook will push all localStorage data to Supabase on next load.

### Supabase Direct
All data is in the `stint_*` tables. You can query/export directly from the Supabase dashboard or use `pg_dump` targeting only stint-prefixed tables.

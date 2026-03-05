# CLAUDE.md — Stint

## What
Stint is a freelance management PWA built for Chris Bernier, a freelance creative director in advertising post-production. It handles time tracking, bookings/pencils, invoicing, client/project management, and reporting.

## Stack
- **Frontend**: React 18 + Vite (single-page app, no router)
- **Database**: Supabase (PostgreSQL) — shared instance with Axiom/Kristory
- **Hosting**: Vercel
- **PWA**: vite-plugin-pwa with Workbox (installable on iOS/Android/desktop)
- **Auth**: Supabase Auth (email/password)
- **Font**: Instrument Sans (loaded from Google Fonts at runtime)

## Commands
```
npm install          # install deps
npm run dev          # local dev server (Vite)
npm run build        # production build
npx vercel --prod    # deploy to production
```

## Environment
Copy `env.example` to `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
The app works without Supabase (localStorage-only mode) if these are missing.

## File Structure
```
stint/
  index.html              # Entry HTML
  package.json            # Dependencies (react, supabase-js, vite, vite-plugin-pwa)
  vite.config.js          # Vite + PWA config
  supabase.js             # Supabase client init (exports supabase, isSupabaseConfigured)
  env.example             # Env var template
  favicon.svg             # Dark "S" on rounded rect
  public/                 # Static assets (icon-192.png, icon-512.png)
  src/
    main.jsx              # React mount point
    App.jsx               # ~2840 lines — ALL UI components in one file
    hooks/
      useOfflineFirst.js  # Sync hook: Supabase ↔ localStorage
  001_initial_schema.sql  # Table creation + indexes + RLS policies
  002_auth_rls.sql        # Auth-required RLS policy migration
  003_add_updated_at.sql  # Adds updated_at column to all tables
```

## Architecture

### Single-file UI
The entire UI lives in `src/App.jsx`. Do not split unless asked. Components:
- **App** — root: auth gate, tab router, nav, data hooks
- **Dashboard** — stats, quick-log, upcoming bookings, recent time
- **Time** — weekly hour-grid timesheet (desktop grid / mobile day view), project color coding, batch fill, copy last week, undo (Ctrl+Z), timer
- **Pencils** — bookings & pencils calendar, conflict detection, priority levels (Booked/1st/2nd/3rd)
- **Invoices** — day-based invoice creation from time entries, expense line items, status tracking, printable view
- **Clients** — client CRUD with per-client service rate overrides, project CRUD with production crew fields
- **Reports** — period-based (week/month/quarter/year) revenue & utilization breakdown by client/project
- **Settings** — business info, bank details, default rates, invoice numbering, display prefs, data export

Shared primitives: `Btn`, `Field`, `Sel`, `TextArea`, `Tag`, `Modal`, `Empty`, `Stat`, `Section`, `Row`, `Card`

### Sync model (useOfflineFirst.js)
Supabase is the source of truth. The sync is simple:
- **Pull**: On mount + every 10s, fetch full table from Supabase, replace local state. Local-only items (id contains "personal") are preserved.
- **Push**: Inside the `setData` wrapper, every mutation diffs prev vs next. New/changed items get an immediate `upsert`. Removed items get an immediate `delete`.
- **localStorage**: Mirror only — used as offline fallback on app load if Supabase is unavailable.
- **Settings**: `useOfflineSettings` — same pattern but single-row (id="default").

### Key conventions
- **camelCase in JS**, **snake_case in Supabase** — converted by `camelToSnake`/`snakeToCamel` in the sync hook
- All localStorage keys use `stint_` prefix
- All Supabase tables use `stint_` prefix
- IDs are random 8-char base36 strings via `uid()`
- Dates stored as ISO strings (`"2026-03-05"`)
- Timestamps stored as epoch milliseconds (bigint)

## Supabase Schema
Shared Supabase instance with Axiom — **never touch non-stint tables**.

### Tables
**stint_clients** — `id` (text PK), `name`, `email`, `notes`, `service_rates` (jsonb), `created_at`, `updated_at`

**stint_projects** — `id` (text PK), `client_id` (FK → stint_clients ON DELETE CASCADE), `name`, `status` (active/on_hold/complete), `director`, `director_email`, `producer`, `producer_email`, `production_company`, `creative_director`, `lead_3d`, `lead_2d`, `my_role`, `due_date`, `notes`, `created_at`, `updated_at`

**stint_time_entries** — `id` (text PK), `project_id` (FK → stint_projects ON DELETE CASCADE), `date` (text ISO), `hour` (integer 0-23), `service_type` (day_rate/shoot_attend/hourly/overtime/expense), `hours`, `rate`, `amount`, `notes`, `created_at`, `updated_at`

**stint_pencils** — `id` (text PK), `project_id` (FK → stint_projects ON DELETE CASCADE), `start_date`, `end_date`, `priority` (0=booked, 1-3=pencils), `notes`, `created_at`, `updated_at`

**stint_invoices** — `id` (text PK), `number`, `client_id` (FK → stint_clients ON DELETE SET NULL), `client_name`, `client_email`, `entry_ids` (jsonb), `line_items` (jsonb), `total`, `status` (draft/sent/paid/overdue), `issue_date`, `due_date`, `invoice_code`, `notes`, `date_range`, `dates_worked` (jsonb), `created_at`, `updated_at`

**stint_settings** — `id` (text PK, default "default"), `business_name`, `business_email`, `business_phone`, `business_address`, `bank_name`, `routing`, `account_number`, `invoice_prefix`, `next_invoice_number`, `payment_terms`, `hide_dollars`, `service_rates` (jsonb), `updated_at`

### Indexes
- `idx_stint_te_date` on time_entries(date)
- `idx_stint_te_proj` on time_entries(project_id)
- `idx_stint_pencils_dates` on pencils(start_date, end_date)
- `idx_stint_proj_client` on projects(client_id)
- `idx_stint_inv_status` on invoices(status)

### RLS
All tables have RLS enabled. Policy: `auth.uid() is not null` for all operations.

## Service Types & Default Rates
| ID | Label | Default Rate |
|----|-------|-------------|
| day_rate | Day Rate | $1,200 |
| shoot_attend | Shoot Attend | $1,500 |
| hourly | Hourly | $150 |
| overtime | Overtime | $187.50 |
| expense | Expense | $0 |

Clients can override any rate via `service_rates` jsonb.

## Design
- Light theme: bg `#f8f7f4`, white cards, green accent `#2d8a4e`
- Desktop-first for the timesheet grid; responsive with mobile bottom nav
- Inline styles everywhere (no CSS files)
- Pencil priorities: Booked (blue), 1st (green), 2nd (yellow), 3rd (red)

## Local-only items
A "Personal" client (`__personal_client__`) and project (`__personal__`) are created automatically and never synced to Supabase. They're detected by `isLocalOnly()` which checks for "personal" in the id or clientId.

## Gotchas
- **Single file UI**: `src/App.jsx` is ~2840 lines. All components, styles, and constants are in this one file. Do not split.
- **Shared Supabase**: The database is shared with Axiom. Only touch `stint_` prefixed tables.
- **No CSS files**: All styling is inline JS objects. The theme object `t` holds all colors.
- **Time entries = hour cells**: Each hour on the timesheet grid is one time_entry row. A "day rate" is 8 entries (9am-5pm), each worth rate/8.
- **Invoice line items are day-based**: When creating an invoice, you select days (not individual time entries). Each day becomes one line item. The `entry_ids` jsonb tracks which time entries were invoiced.
- **Personal project auto-creates**: On mount, if the Personal project doesn't exist, it's added. Every client auto-gets an "Internal Meeting" project.
- **Timer state**: Active timer is stored in localStorage (`stint_timer`), not in Supabase.
- **Undo**: Time tab has a local undo stack (not persisted). Ctrl+Z works.
- **`flushPending()`**: Exported but is a no-op. Kept for API compatibility.

## Sync history & lessons learned
The sync layer was rewritten multiple times in the March 2026 session. Key lessons:
- **Keep it simple**: The original "offline-first" approach (localStorage as source of truth, diffing, batched FK-ordered push queues, conditional timestamp guards, persistent deletion tracking) caused duplicates, ghost records, and stale overwrites. All of that complexity was replaced with ~130 lines: pull-replace + push-on-change.
- **Don't diff local vs remote**: For a single-user app, comparing local and remote arrays creates race conditions. Instead, push changes as they happen (inside the `setData` updater) and let the pull fully replace local state.
- **Deletes need immediate push**: The biggest recurring bug was deleted items reappearing. The fix was pushing `DELETE` from inside the state updater itself, not from a separate effect that could be skipped by `fromPullRef` gates.
- **Side effects in React state updaters**: The `setData` wrapper fires Supabase calls from inside `setDataRaw(prev => ...)`. This is technically impure but is the only reliable way to diff prev/next and push immediately. It works fine in practice.
- **`updated_at` column exists but isn't used for conflict resolution**: Migration 003 added `updated_at` to all tables. The `setData` wrapper stamps `updatedAt: Date.now()` on every changed record. This is useful metadata but the app no longer does conditional timestamp-guarded writes — simple `upsert` won.

## GitHub
- **Repo**: https://github.com/homer31383/stint (private)
- **Remote**: `origin` → `https://github.com/homer31383/stint.git`
- Previous repo was `homer31383/stint-ledger` (may still exist, now stale)

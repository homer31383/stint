# CLAUDE.md — Stint

## What
Stint is a freelance management PWA built for Chris Bernier, a freelance creative director in advertising post-production. It handles time tracking, bookings/pencils, invoicing, client/project management, and reporting.

## Stack & Versions
- **Frontend**: React 18.3.1 + Vite 5.4.x (single-page app, no router)
- **Database**: Supabase (PostgreSQL) via `@supabase/supabase-js` 2.45.x — shared instance with Axiom/Kristory
- **Hosting**: Vercel (auto-deploy disabled; manual `npx vercel --prod`)
- **PWA**: vite-plugin-pwa 0.20.x with Workbox (installable on iOS/Android/desktop)
- **Auth**: Supabase Auth (email/password)
- **Font**: Instrument Sans (loaded from Google Fonts at runtime)
- **Build tooling**: @vitejs/plugin-react 4.3.x
- **No CSS files, no router, no state management library** — all inline styles, tab-based nav, React useState/useEffect

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
  package.json            # Dependencies
  vite.config.js          # Vite + PWA config (workbox, manifest, font caching)
  supabase.js             # Supabase client init (exports supabase, isSupabaseConfigured)
  env.example             # Env var template
  favicon.svg             # Dark "S" on rounded rect
  public/                 # Static assets (icon-192.png, icon-512.png)
  src/
    main.jsx              # React mount point
    App.jsx               # ~3170 lines — ALL UI components in one file
    hooks/
      useOfflineFirst.js  # Sync hook: Supabase ↔ localStorage (~155 lines)
  001_initial_schema.sql  # Table creation + indexes + RLS policies
  002_auth_rls.sql        # Auth-required RLS policy migration
  003_add_updated_at.sql  # Adds updated_at column to all tables
  004_day_notes.sql       # Per-day notes table
  CLAUDE.md               # This file
  STINT_DISASTER_RECOVERY.md
  STINT_REBUILD_PROMPT.md
```

## Architecture

### Single-file UI
The entire UI lives in `src/App.jsx` (~3170 lines). Do not split unless asked. Components:
- **App** — root: auth gate, tab router, nav, data hooks, global search, getRate()
- **Dashboard** — stats, quick-log, upcoming bookings, recent time
- **Time** — weekly hour-grid timesheet (desktop grid / mobile day view), project color coding, batch fill, copy last week, undo (Ctrl+Z), timer. Project bar filters to booked projects by default. Each day header has a small pencil icon (top-right) that opens a day-note modal; populated notes render as italic text under the day header (desktop) or as a banner above the hour list (mobile).
- **Pencils** — bookings & pencils with edit modal, calendar view, conflict detection, priority levels (Booked/1st/2nd/3rd), per-booking rate cards
- **Invoices** — day-based invoice creation from time entries, expense line items, status tracking (with paid date), printable PDF view
- **Clients** — client CRUD with contacts array and per-client service rate overrides, project CRUD with production crew fields
- **Reports** — period-based (week/month/quarter/year) revenue, utilization, days-to-payment breakdown by client/project
- **Settings** — business info, masked bank details (routing/account), default rates, invoice numbering, display prefs, data export

Shared primitives: `Btn`, `Field`, `Sel`, `TextArea`, `Tag`, `Modal`, `Empty`, `Stat`, `Section`, `Row`, `Card`

### Sync model (useOfflineFirst.js)
Supabase is the source of truth. The sync is simple:
- **Pull**: On mount + every 10s, fetch full table from Supabase, replace local state. Local-only items (id contains "personal") are preserved.
- **Push**: Inside the `setData` wrapper, every mutation diffs prev vs next. New/changed items get an immediate `upsert`. Removed items get an immediate `delete`.
- **localStorage**: Mirror only — used as offline fallback on app load if Supabase is unavailable.
- **Settings**: `useOfflineSettings` — same pattern but single-row (id="default").

### Rate priority cascade
`getRate(client, serviceType, { date, projectId })` checks in order:
1. **Booking rate** — finds a pencil/booking where date is in range and project/client matches, uses its `rates[serviceType]`
2. **Client rate** — `client.serviceRates[serviceType]`
3. **Default rate** — `settings.serviceRates[serviceType]` or `SERVICE_TYPES` hardcoded default

### Key conventions
- **camelCase in JS**, **snake_case in Supabase** — converted by `camelToSnake`/`snakeToCamel` in the sync hook
- All localStorage keys use `stint_` prefix
- All Supabase tables use `stint_` prefix
- IDs are random 8-char base36 strings via `uid()`
- Dates stored as ISO strings (`"2026-03-05"`)
- Timestamps stored as epoch milliseconds (bigint)
- **No CSS files**: All styling is inline JS objects. The theme object `t` holds all colors.
- Do not add `Co-Authored-By` lines to commit messages.

## Supabase Schema
Shared Supabase instance (`xxsjfeafpzzcmadyvuue`) with Axiom — **never touch non-stint tables**.

### Tables
**stint_clients** — `id` (text PK), `name`, `email`, `contacts` (jsonb, `[{name, role, email}]`), `notes`, `service_rates` (jsonb), `created_at`, `updated_at`

**stint_projects** — `id` (text PK), `client_id` (FK → stint_clients ON DELETE CASCADE), `name`, `status` (active/on_hold/complete), `director`, `director_email`, `producer`, `producer_email`, `production_company`, `creative_director`, `lead_3d`, `lead_2d`, `my_role`, `due_date`, `notes`, `created_at`, `updated_at`

**stint_time_entries** — `id` (text PK), `project_id` (FK → stint_projects ON DELETE CASCADE), `date` (text ISO), `hour` (integer 0-23), `service_type` (day_rate/shoot_attend/hourly/overtime/expense), `hours`, `rate`, `amount`, `notes`, `created_at`, `updated_at`

**stint_pencils** — `id` (text PK), `project_id` (FK → stint_projects ON DELETE CASCADE), `client_id` (text), `start_date`, `end_date`, `priority` (0=booked, 1-3=pencils), `notes`, `rates` (jsonb, `{day_rate: X, ...}`), `created_at`, `updated_at`

**stint_invoices** — `id` (text PK), `number`, `client_id` (FK → stint_clients ON DELETE SET NULL), `client_name`, `client_email`, `entry_ids` (jsonb), `line_items` (jsonb), `total`, `status` (draft/sent/paid/overdue), `issue_date`, `due_date`, `paid_date` (text), `invoice_code`, `notes`, `date_range`, `dates_worked` (jsonb), `created_at`, `updated_at`

**stint_settings** — `id` (text PK, default "default"), `business_name`, `business_email`, `business_phone`, `business_address`, `bank_name`, `routing`, `account_number`, `invoice_prefix`, `next_invoice_number`, `payment_terms`, `hide_dollars`, `service_rates` (jsonb), `updated_at`

**stint_day_notes** — `id` (text PK = ISO date string, one row per day), `note`, `created_at`, `updated_at`. Backs the per-day note feature on the Time tab.

### Indexes
- `idx_stint_te_date` on time_entries(date)
- `idx_stint_te_proj` on time_entries(project_id)
- `idx_stint_pencils_dates` on pencils(start_date, end_date)
- `idx_stint_proj_client` on projects(client_id)
- `idx_stint_inv_status` on invoices(status)

### RLS
All tables have RLS enabled. Policy: `auth.uid() is not null` for all operations.

### Migrations applied (do NOT re-run)
1. `001_initial_schema.sql` — tables, indexes, RLS enable
2. `002_auth_rls.sql` — auth-required RLS policies
3. `003_add_updated_at.sql` — updated_at column on all tables
4. Manual: `ALTER TABLE stint_clients ADD COLUMN IF NOT EXISTS contacts jsonb default '[]';`
5. Manual: `ALTER TABLE stint_invoices ADD COLUMN IF NOT EXISTS paid_date text;`
6. Manual: `ALTER TABLE stint_pencils ADD COLUMN IF NOT EXISTS client_id text;`
7. Manual: `ALTER TABLE stint_pencils ADD COLUMN IF NOT EXISTS rates jsonb;`
8. `004_day_notes.sql` — `stint_day_notes` table for per-day notes on the Time tab

## Service Types & Default Rates
| ID | Label | Default Rate |
|----|-------|-------------|
| day_rate | Day Rate | $1,200 |
| shoot_attend | Shoot Attend | $1,500 |
| hourly | Hourly | $150 |
| overtime | Overtime | $187.50 |
| expense | Expense | $0 |

Clients can override any rate via `service_rates` jsonb. Bookings can override per-engagement via `rates` jsonb.

## Design
- Light theme: bg `#f8f7f4`, white cards, green accent `#2d8a4e`
- Desktop-first for the timesheet grid; responsive with mobile bottom nav at 767px
- Inline styles everywhere (no CSS files) — theme object `t` holds all colors
- Pencil priorities: Booked (blue), 1st (green), 2nd (yellow), 3rd (red)
- Font: Instrument Sans weights 400-750, tight letter spacing for headings

## Local-only items
A "Personal" client (`__personal_client__`) and project (`__personal__`) are created automatically and never synced to Supabase. They're detected by `isLocalOnly()` which checks for "personal" in the id or clientId.

## Gotchas
- **Single file UI**: `src/App.jsx` is ~3170 lines. All components, styles, and constants are in this one file. Do not split.
- **Shared Supabase**: The database is shared with Axiom. Only touch `stint_` prefixed tables.
- **Time entries = hour cells**: Each hour on the timesheet grid is one time_entry row. A "day rate" is 8 entries (9am-5pm), each worth rate/8.
- **Invoice line items are day-based**: When creating an invoice, you select days (not individual time entries). Each day becomes one line item. The `entry_ids` jsonb tracks which time entries were invoiced.
- **Internal Meeting dedup**: A useEffect ensures every client has one Internal Meeting project. A separate one-time cleanup (via `useRef` guard) removes duplicates, keeping the one with the most time entry/pencil references. This was a recurring bug — the effect used to read stale `projects` state. Now both use `setProjects(prev => ...)` updaters to always read latest state.
- **Timer state**: Active timer is stored in localStorage (`stint_timer`), not in Supabase.
- **Undo**: Time tab has a local undo stack (not persisted). Ctrl+Z works.
- **`flushPending()`**: Exported but is a no-op. Kept for API compatibility.
- **Masked bank fields**: Routing and account numbers in Settings are masked by default with eye toggle. Fields are `readOnly` when masked to prevent editing the masked string.
- **Search modal**: Global search in header, 200ms debounce, searches clients/projects/invoices/bookings. Full-screen on mobile.
- **Timesheet project filter**: Defaults to showing only projects with active bookings for the current week. "All projects" option in the dropdown shows everything.
- **jsonb fields pass through sync untouched**: `camelToSnake`/`snakeToCamel` skip arrays, so `contacts`, `rates`, `serviceRates`, `entryIds`, `lineItems` etc. all work without conversion since their inner keys are lowercase or the field is an array.

## Sync history & lessons learned
The sync layer was rewritten multiple times in the March 2026 session. Key lessons:
- **Keep it simple**: The original "offline-first" approach (localStorage as source of truth, diffing, batched FK-ordered push queues, conditional timestamp guards, persistent deletion tracking) caused duplicates, ghost records, and stale overwrites. All of that complexity was replaced with ~155 lines: pull-replace + push-on-change.
- **Don't diff local vs remote**: For a single-user app, comparing local and remote arrays creates race conditions. Instead, push changes as they happen (inside the `setData` updater) and let the pull fully replace local state.
- **Deletes need immediate push**: The biggest recurring bug was deleted items reappearing. The fix was pushing `DELETE` from inside the state updater itself, not from a separate effect that could be skipped by `fromPullRef` gates.
- **Side effects in React state updaters**: The `setData` wrapper fires Supabase calls from inside `setDataRaw(prev => ...)`. This is technically impure but is the only reliable way to diff prev/next and push immediately. It works fine in practice.
- **`updated_at` column exists but isn't used for conflict resolution**: Migration 003 added `updated_at` to all tables. The `setData` wrapper stamps `updatedAt: Date.now()` on every changed record. This is useful metadata but the app no longer does conditional timestamp-guarded writes — simple `upsert` won.

## GitHub & Deploy
- **Repo**: https://github.com/homer31383/stint (private)
- **Remote**: `origin` → `https://github.com/homer31383/stint.git`
- **Production URL**: https://stint-iota.vercel.app
- **Deploy**: `npx vercel --prod` from stint/ dir
- **Rollback**: Go to Vercel dashboard → Deployments → click any previous deployment → "Promote to Production"
- Previous repo was `homer31383/stint-ledger` (may still exist, now stale)

## Known Issues
- **No edit for past bookings in Past section**: The Past section in Pencils tab renders with simpler `Row` components that don't have the `openEdit` click handler. Only upcoming bookings/pencils are editable by clicking.
- **Mobile project filter**: The client/booking filter dropdown is only shown on desktop (`!isMobile`). Mobile users see all booked projects but can't switch to "All projects" filter.

## Next Feature Ideas (discussed but not built)
- Email invoices directly from the app (SendGrid/Resend integration)
- Recurring bookings (weekly repeat)
- Multi-user support (team timesheets, shared projects)
- Time entry notes bulk-edit
- Booking-to-time auto-fill (pre-populate timesheet from confirmed bookings)

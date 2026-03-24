# Stint Ledger — Complete Disaster Recovery Guide

Last updated: March 2026

This document contains everything needed to rebuild Stint Ledger from scratch if all code, files, and project data are lost. It is written to be readable by a human and usable as a prompt for Claude / Claude Code.

## What Is Stint Ledger?

A personal financial dashboard PWA for a freelance Creative Director. It pulls real booking/income data from a shared Supabase backend (populated by the Stint time-tracking app), combines it with manually-entered account balances stored in IndexedDB, and provides financial modeling across 8 views. Runs on a home LAN, installable on desktop and mobile, works offline.

## Tech Stack

| Layer | Tool | Version |
|-------|------|---------|
| Framework | React + TypeScript (strict) | 18.3, 5.5 |
| Build | Vite | 5.4 |
| Styling | Tailwind CSS | 3.4 |
| Data | Supabase (read-only stint tables, read-write ledger_sync) | 2.45 |
| Local DB | IndexedDB via `idb` | 8.0 |
| PWA | vite-plugin-pwa (Workbox) | 0.20 |
| Charts | Recharts (dep exists, views use custom bars) | 2.12 |
| Fonts | IBM Plex Sans (UI), IBM Plex Mono (numbers) | Google Fonts |

## Environment

**.env** (gitignored):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Commands:**
```bash
npm install
npm run dev          # http://localhost:5173 (LAN: http://192.168.29.152:5173)
npm run build        # tsc && vite build -> dist/
npm run preview      # Preview production build
npx tsc --noEmit     # Type check only
```

Vite config: `server: { host: '0.0.0.0' }` for LAN access.

## Complete File Structure

```
stint-ledger/
├── index.html                     HTML shell, IBM Plex fonts, dark body
├── vite.config.ts                 React plugin, PWA manifest/workbox, LAN host
├── tailwind.config.js             Custom dark theme colors, IBM Plex fonts
├── tsconfig.json                  Strict TS, ES2020, bundler resolution
├── package.json                   All dependencies
├── .env                           Supabase credentials (gitignored)
├── public/
│   ├── favicon.svg
│   ├── icon-192.png
│   └── icon-512.png
└── src/
    ├── main.tsx                   Entry: ReactDOM.createRoot -> <App />
    ├── App.tsx                    ErrorBoundary, Navigation, view router
    ├── index.css                  Tailwind directives, scrollbar/slider styling
    ├── vite-env.d.ts              VITE_SUPABASE_URL/KEY type defs
    ├── lib/
    │   ├── types.ts               All TS interfaces, account mapping, defaults
    │   ├── supabase.ts            Supabase client, fetchStintData()
    │   ├── storage.ts             IndexedDB CRUD, settings gather/apply, scenarios
    │   ├── tax.ts                 estimateTaxes(), estimateW2Taxes()
    │   └── helpers.ts             fmt(), fmtPct(), weekdays, dates, clamp
    ├── hooks/
    │   ├── useStintData.ts        Supabase fetch -> IDB cache -> data/loading/error
    │   ├── useAccountBalances.ts  DetailedBalances -> aggregate AccountBalances
    │   ├── usePlannerSettings.ts  Slider state, IDB persistence, merge defaults
    │   ├── useExpenseModel.ts     Recurring/one-time CRUD, reorder, replace, uuid fallback
    │   ├── useRetirementSettings.ts  Retirement sliders, IDB persistence
    │   ├── useSavedScenarios.ts   Save/load/compare scenario snapshots
    │   └── useSettingsSync.ts     Push/pull to Supabase ledger_sync
    ├── components/
    │   ├── Navigation.tsx         Desktop sidebar + mobile bottom tabs + sync UI
    │   ├── Panel.tsx              Card container with title + action slot
    │   ├── StatCard.tsx           Label + monospace value + sub text
    │   ├── Slider.tsx             Range input with formatted value
    │   ├── MiniBar.tsx            Horizontal progress bar
    │   └── StatusTag.tsx          Color-coded status badge
    └── views/
        ├── Dashboard.tsx          YTD income, utilization, invoices, bookings, NW, runway
        ├── Utilization.tsx        Year selector, monthly/client/service breakdowns
        ├── Pipeline.tsx           Booked/penciled deals, weighted pipeline
        ├── Invoices.tsx           Invoice list, status breakdown, outstanding/overdue
        ├── Planner.tsx            Days-to-target, scenarios, compare, 5-year projection
        ├── Expenses.tsx           Drag-reorder recurring, mute, financial impact sim
        ├── NetWorth.tsx           Per-account editing, allocation, FI progress, runway
        └── Retirement.tsx         Age->95 projection, depletion, safe withdrawal
```

## Supabase SQL Schema

### Read-only tables (owned by Stint app)

```sql
CREATE TABLE stint_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  service_rates JSONB DEFAULT '{}',
  created_at BIGINT NOT NULL
);

CREATE TABLE stint_projects (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  director TEXT, director_email TEXT,
  producer TEXT, producer_email TEXT,
  production_company TEXT, creative_director TEXT,
  lead_3d TEXT, lead_2d TEXT, my_role TEXT,
  due_date TEXT, notes TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE stint_time_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  hour INTEGER,
  service_type TEXT NOT NULL,
  hours NUMERIC NOT NULL,
  rate NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  notes TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE stint_pencils (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  project_id TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE stint_invoices (
  id TEXT PRIMARY KEY,
  number TEXT,
  client_id TEXT, client_name TEXT, client_email TEXT,
  entry_ids TEXT[] DEFAULT '{}',
  line_items JSONB DEFAULT '[]',
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  issue_date TEXT, due_date TEXT,
  invoice_code TEXT, notes TEXT,
  date_range TEXT, dates_worked TEXT[] DEFAULT '{}',
  created_at BIGINT NOT NULL
);

CREATE TABLE stint_settings (
  id TEXT PRIMARY KEY,
  business_name TEXT, business_email TEXT,
  business_phone TEXT, business_address TEXT,
  bank_name TEXT, routing TEXT, account_number TEXT,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  next_invoice_number INTEGER NOT NULL DEFAULT 1,
  payment_terms INTEGER NOT NULL DEFAULT 30,
  hide_dollars BOOLEAN NOT NULL DEFAULT FALSE,
  service_rates JSONB DEFAULT '{}'
);
```

### Ledger-owned table

```sql
CREATE TABLE ledger_sync (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### CRITICAL: Disable RLS on all tables

```sql
ALTER TABLE stint_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_pencils DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_sync DISABLE ROW LEVEL SECURITY;
```

## Account Mapping (DetailedBalances -> AccountBalances)

```
checking    = advRelationship + santanderChecking + advantageSavings
hys         = highYieldSavings + openbankHYS
moneyMarket = santanderMM
brokerage   = nonRetirement
tradIRA     = traditionalIRA
rolloverIRA = rolloverIRA
hsa         = hsa
ccDebt      = citiDoubleCash  (negative)
```

## Return Rate Assignments

| Account | Rate Variable | Default |
|---------|--------------|---------|
| checking | 0% | — |
| hys, moneyMarket | cashReturn | 4% |
| brokerage, tradIRA, hsa | equityReturn | 7% |
| rolloverIRA | rolloverReturn | 4% |

## Tax Formulas

### Freelance (estimateTaxes)
- SE tax: 15.3% on 92.35% of gross
- Federal: progressive brackets on (AGI - halfSE - $15k)
- NY State: 7% flat on AGI
- Brackets: 10%/$11,925 | 12%/$48,475 | 22%/$103,350 | 24%/$197,300 | 32%/$250,525 | 35%/$626,350 | 37%+

### Full-Time W-2 (estimateW2Taxes)
- SS: 6.2% (capped $176,100) + Medicare: 1.45%
- 401k reduces taxable income (pre-tax)
- Federal: same brackets on (gross - 401k - $15k)
- NY State: 7% on (gross - 401k)

## IndexedDB Schema

Database: `stint-ledger`, version 1, stores: `stint`, `accounts`

| Store | Key | Value |
|-------|-----|-------|
| stint | clients, projects, timeEntries, pencils, invoices, settings, lastSynced | Stint data cache |
| stint | planner-settings | PlannerSettings |
| stint | retirement-settings | RetirementSettings |
| stint | expense-model | ExpenseModel |
| stint | saved-scenarios | SavedScenario[] |
| accounts | balances | DetailedBalances |

## Settings Sync

PC is source of truth. Push from PC, pull on phone.

**Synced blob keys:** plannerSettings, retirementSettings, expenseModel, detailedBalances, savedScenarios

**Push flow:** gatherAllSettings() reads 5 IDB keys -> upserts to ledger_sync row (id='default') -> saves timestamp to localStorage

**Pull flow:** reads ledger_sync row -> applyAllSettings() writes to IDB -> saves timestamp -> window.location.reload()

## View Details

### Dashboard
- YTD income (sum of all time entry amounts for current year)
- Days worked (unique day_rate dates)
- Utilization (days worked / weekdays elapsed)
- Outstanding invoices (sent + overdue totals)
- Net worth snapshot (all accounts)
- Runway (accessible / monthly expenses)
- Monthly income bar chart
- Upcoming bookings list

### Utilization
- Year selector (current + 1 prior year)
- Monthly breakdown table (income, days, utilization per month)
- By-client breakdown
- By-service-type breakdown

### Pipeline
- Weighted pipeline: booked 100%, pencil 70%, pencil 2 40%, pencil 3 20%
- Booked/penciled day counts
- Confirmed revenue
- Active bookings and pencils lists

### Invoices
- Status breakdown (draft, sent, paid, overdue counts + totals)
- All invoices sorted by issue_date desc
- Outstanding and overdue totals

### Planner (largest view, ~1100 lines)
Sections in order:
1. **Days to Target** (freelance only) - target util slider, bookings/pencils toggles, 3-segment progress bar
2. **Saved Scenarios** - collapsible list with load/delete/compare
3. **Scenario Comparison** (compare mode) - current + up to 3 saved, 14 metrics, green best / red worst
4. **Scenario Inputs** - all sliders (mode-dependent)
5. **Financial Picture Toggle** - full vs income-only
6. **Monthly Snapshot** - stat cards grid
7. **Employment Mode Toggle** - freelance/full-time
8. **Annual View** - stat cards grid
9. **Summary Callout** - health message
10. **Scenario Comparison Table** (freelance) - 8 predefined combos
11. **Freelance vs FT Comparison** (FT mode)
12. **5-Year Net Worth Projection** - stacked bar + inflation slider
13. **Rollover IRA Deployment** - return rate comparison table

### Expenses (~980 lines)
Sections:
1. Income Summary (read-only from Planner settings)
2. Recurring Expenses - drag-to-reorder, category dropdown, mute toggle, add/remove
3. One-Time Expenses - month picker, mute toggle, add/remove
4. Expense Summary - totals, averages, highest month
5. Financial Impact - toggle full year vs one-time, balance projections, month-by-month table
6. Monthly Timeline - stacked bar chart
7. Category Breakdown - pie chart + legend

**Drag-to-reorder:** Desktop HTML5 DnD, mobile long-press (400ms) touch with floating clone. `reorderRecurring(fromIndex, toIndex)` persists to IDB.

**Mute toggle:** Dims expense row (opacity-40), excludes from all calculations without deleting.

**Account cascade:** Deficits draw HYS -> Money Market -> Checking.

### Net Worth
- Per-account editable inputs grouped by: Banking (Cash & Checking, Credit, Savings), Investments (Non-retirement, Retirement, Other)
- Asset allocation bar chart
- Debt-to-asset ratio
- Liquid runway (months)
- FI progress (% of 25x annual expenses target)

### Retirement
- Scenario sliders: current age, retirement age, contributions, return rates, inflation, spending, SS
- Include Taxable toggle
- Age-to-95 projection with accumulation/distribution/depletion phases
- Stacked bar chart color-coded by phase
- Key outputs: balance at retirement, portfolio longevity, safe withdrawal rate, depletion age

## Saved Scenarios

Each scenario captures:
- Full PlannerSettings snapshot
- Full ExpenseModel snapshot (all recurring + one-time with muted state)
- Computed metrics: mode, day rate/salary, utilization, gross/net annual, cash flow (income-only + full), savings (income-only + full), year-5 NW, expenses, recurring total, one-time total

Loading replaces both planner settings AND expense model (with confirmation dialog).

Compare mode shows current + up to 3 saved scenarios in a table with green (best) / red (worst) highlighting per row. Expense rows use inverted highlighting (lower = better).

## Tailwind Custom Theme

```javascript
colors: {
  'surface-0': '#0a0c10',  // darkest background
  'surface-1': '#12151c',  // card background
  'surface-2': '#1a1e28',  // input/hover background
  'surface-3': '#232836',  // borders/dividers
  accent: '#5b8def',       // blue - primary actions
  positive: '#34d399',     // green - good values
  negative: '#f87171',     // red - bad values
  caution: '#fbbf24',      // yellow - warnings
  retirement: '#a78bfa',   // purple - retirement accounts
  highlight: '#22d3ee',    // cyan - secondary highlights
}
```

## Known Gotchas

1. **uuid() fallback** - crypto.randomUUID() unavailable on older Safari. Feature-detect and fallback to Math.random. NEVER replace_all on crypto.randomUUID.
2. **IndexedDB empty state** - All reads return null on fresh device. Every hook initializes with defaults.
3. **RLS** - Supabase re-enables on table recreation. Always disable.
4. **Select styling** - Needs explicit bg-surface-2 text-gray-300 for dark theme.
5. **ErrorBoundary** - Required or view crashes blank the entire app.
6. **PostgrestError** - Plain object, not Error. Check .message property.
7. **Mobile padding** - pb-28 on main content clears bottom tabs + sync bar.
8. **Touch drag** - Uses touch-none CSS and body overflow:hidden during drag.
9. **Service worker** - Caches aggressively. Ctrl+Shift+R or unregister to see updates.

## GitHub

Repository: `homer31383/stint-ledger` (private)
Remote: `https://github.com/homer31383/stint-ledger.git`
Branch: `main`

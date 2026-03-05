# Stint Ledger — Project Guide for Claude Code

Stint Ledger is a personal financial dashboard PWA for a freelance Creative Director. It pulls real booking/income data from a shared Supabase backend (populated by the Stint time-tracking app), combines it with manually-entered account balances stored in IndexedDB, and provides financial modeling across 8 views: Dashboard, Utilization, Pipeline, Invoices, Planner, Expenses, Net Worth, and Retirement. The app runs on a home LAN, is installable on desktop and mobile, and works offline.

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | React 18, TypeScript (strict) |
| Build | Vite 5, `tsc && vite build` |
| Styling | Tailwind CSS 3 (custom dark theme in `tailwind.config.js`) |
| Data source | Supabase (read-only from Stint tables, read-write for `ledger_sync`) |
| Local storage | IndexedDB via `idb` library — balances, planner/retirement/expense settings |
| PWA | `vite-plugin-pwa` (Workbox, service worker, installable) |
| Fonts | IBM Plex Sans (UI), IBM Plex Mono (numbers) |
| Charts | Recharts (dependency exists but views use custom bars) |

## How to Run

```bash
npm install
npm run dev          # Dev server at http://localhost:5173 (LAN: http://192.168.29.152:5173)
npm run build        # Production: tsc + vite build → dist/
npm run preview      # Preview production build
```

Vite is configured with `server: { host: '0.0.0.0' }` so the dev server is accessible on the LAN for mobile testing. The `.env` file (gitignored) contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## File Structure

```
├── index.html                          HTML shell with IBM Plex font imports, dark body class
├── vite.config.ts                      Vite config: React plugin, PWA manifest/workbox, LAN host
├── tailwind.config.js                  Custom colors (surface-0..3, accent, positive, negative, etc.)
├── tsconfig.json                       Strict TS, ES2020 target, bundler module resolution
├── package.json                        Dependencies: react, supabase-js, idb, recharts, tailwindcss
├── .env                                VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (gitignored)
├── public/
│   ├── favicon.svg                     App icon (SVG)
│   ├── icon-192.png                    PWA icon 192x192
│   └── icon-512.png                    PWA icon 512x512
└── src/
    ├── main.tsx                         React entry point, mounts <App /> into #root
    ├── App.tsx                          Root component: ErrorBoundary, Navigation, view router, hooks
    ├── index.css                        Tailwind directives, scrollbar/slider styling, tap-highlight off
    ├── vite-env.d.ts                    Type defs for VITE_SUPABASE_URL/KEY env vars
    ├── lib/
    │   ├── types.ts                     All TypeScript interfaces (Stint data, balances, view IDs)
    │   ├── supabase.ts                  Supabase client, fetchStintData() fetches all 6 tables
    │   ├── storage.ts                   IndexedDB helpers: save/load for cache, balances, settings, sync
    │   ├── tax.ts                       estimateTaxes() (freelance SE+fed+state), estimateW2Taxes() (W-2)
    │   └── helpers.ts                   fmt(), fmtPct(), weekdaysElapsedYTD(), currentYear(), parseDate()
    ├── hooks/
    │   ├── useStintData.ts              Fetches Supabase → caches IDB → returns data/loading/error/refresh
    │   ├── useAccountBalances.ts        Loads DetailedBalances from IDB, computes aggregate AccountBalances
    │   ├── usePlannerSettings.ts        Planner slider state, persists to IDB, merge-on-load with defaults
    │   ├── useExpenseModel.ts           Recurring/one-time expenses, persists to IDB, uuid() fallback
    │   ├── useRetirementSettings.ts     Retirement scenario sliders, persists to IDB
    │   └── useSettingsSync.ts           Push/pull settings to Supabase ledger_sync table
    ├── components/
    │   ├── Navigation.tsx               Desktop sidebar + mobile bottom tabs + settings sync UI
    │   ├── Panel.tsx                    Card container with optional title and action slot
    │   ├── StatCard.tsx                 Label + large monospace value + optional sub text
    │   ├── Slider.tsx                   Range input with label, formatted value, optional subtitle
    │   ├── MiniBar.tsx                  Small horizontal progress bar (value/max)
    │   └── StatusTag.tsx                Color-coded status badge (draft/sent/paid/overdue/pencil)
    └── views/
        ├── Dashboard.tsx                YTD income, utilization, invoices, bookings, NW snapshot, runway
        ├── Utilization.tsx              Year selector, monthly breakdown, by-client, by-service-type
        ├── Pipeline.tsx                 Booked/penciled deals, weighted pipeline value, priority tiers
        ├── Invoices.tsx                 Invoice list sorted by date, status breakdown, outstanding/overdue
        ├── Planner.tsx                  Scenario modeler: freelance/FT toggle, sliders, 5-year projection
        ├── Expenses.tsx                 Recurring + one-time expenses, financial impact simulation
        ├── NetWorth.tsx                 Per-account editing, asset allocation, FI progress
        └── Retirement.tsx               Long-term projection age→95, portfolio longevity, safe withdrawal
```

## Architecture & Data Flow

```
Supabase (stint_* tables)
  ↓ fetchStintData()
useStintData hook → caches to IDB "stint" store
  ↓
App.tsx passes data + balances as props to views
  ↓
Views call local hooks (useExpenseModel, usePlannerSettings, etc.)
  ↓
All local settings persist to IndexedDB
  ↓
Settings sync: PC pushes to ledger_sync table, phone pulls from it
```

**Shared state (via App.tsx props):** `data` (StintData), `balances` (AccountBalances), `detailed` (DetailedBalances)

**Local to each view:** Planner settings, expense model, retirement settings — each managed by their own hook with IDB persistence.

**IndexedDB stores:**
- `stint` — cached Supabase data + `planner-settings` + `retirement-settings` + `expense-model`
- `accounts` — `balances` (DetailedBalances)

## Supabase Tables

### Read-only (owned by Stint app)
| Table | What |
|-------|------|
| `stint_clients` | Client names, emails, service rates |
| `stint_projects` | Projects with status, roles, client link |
| `stint_time_entries` | Daily time entries with service_type, rate, amount |
| `stint_pencils` | Booked/penciled date ranges with priority 1-4 |
| `stint_invoices` | Invoices with line items, status, totals |
| `stint_settings` | Business info, invoice config, service rates |

### Owned by Ledger
| Table | What |
|-------|------|
| `ledger_sync` | Single row (`id='default'`), `data` jsonb blob of all settings, `updated_at` timestamp |

RLS is disabled on all tables. If tables are recreated, run `ALTER TABLE <name> DISABLE ROW LEVEL SECURITY;` on each.

## Key Hooks

| Hook | Returns | Persists to |
|------|---------|-------------|
| `useStintData` | `{ data, loading, syncing, error, refresh }` | IDB `stint` store (cache) |
| `useAccountBalances` | `{ balances, detailed, setDetailed, loaded }` | IDB `accounts/balances` |
| `usePlannerSettings(defaults)` | `{ settings, update, reset, loaded }` | IDB `stint/planner-settings` |
| `useExpenseModel` | `{ model, addRecurring, updateRecurring, removeRecurring, addOneTime, updateOneTime, removeOneTime, setFullYearProjection, reset, loaded }` | IDB `stint/expense-model` |
| `useRetirementSettings` | `{ settings, update, reset, loaded }` | IDB `stint/retirement-settings` |
| `useSettingsSync` | `{ push, pull, pushing, pulling, lastPushed, lastPulled, serverUpdatedAt, error }` | `localStorage` for timestamps, Supabase for data |

## Views

| View | Depends on | Key feature |
|------|-----------|-------------|
| Dashboard | StintData, AccountBalances | YTD overview, runway calc, monthly income chart |
| Utilization | StintData | Year selector, monthly/client/service breakdowns |
| Pipeline | StintData | Weighted pipeline: booked 100%, pencil 70%/40%/20% |
| Invoices | StintData | Status breakdown, sorted list, outstanding/overdue |
| Planner | StintData, AccountBalances, usePlannerSettings | Freelance/FT toggle, scenario sliders, 5-year projection |
| Expenses | StintData, AccountBalances, useExpenseModel, usePlannerSettings | Recurring/one-time editing, year-end simulation |
| Net Worth | DetailedBalances, AccountBalances | Per-account editing, allocation chart, FI progress |
| Retirement | AccountBalances, useRetirementSettings | Age→95 projection, depletion warnings, safe withdrawal |

## Net Worth Account Mapping (Critical)

Individual accounts in `DetailedBalances` aggregate to `AccountBalances` via `toAggregateBalances()`:

```
checking    = advRelationship + santanderChecking + advantageSavings
hys         = highYieldSavings + openbankHYS
moneyMarket = santanderMM
brokerage   = nonRetirement
tradIRA     = traditionalIRA
rolloverIRA = rolloverIRA
hsa         = hsa
ccDebt      = citiDoubleCash  (negative number)
```

**Return rate assignments in Planner:**
- `checking` — earns nothing (treated as cash)
- `hys`, `moneyMarket` — earn `cashReturn` (default 4%)
- `brokerage`, `tradIRA`, `hsa` — earn `equityReturn` (default 7%)
- `rolloverIRA` — earns `rolloverReturn` (default 4%, separate slider)

## Tax Estimation

### Freelance (`estimateTaxes`)
- SE tax: 15.3% on 92.35% of gross
- Federal: progressive brackets on (AGI − half SE − $15k deduction)
- NY State: 7% flat on AGI
- Brackets: 10%→$11,925 / 12%→$48,475 / 22%→$103,350 / 24%→$197,300 / 32%→$250,525 / 35%→$626,350 / 37% above

### Full-time (`estimateW2Taxes`)
- FICA: 6.2% SS (capped $176,100) + 1.45% Medicare
- 401k reduces taxable income (pre-tax)
- Federal: same brackets on (gross − 401k − $15k deduction)
- NY State: 7% on (gross − 401k)

## Settings Sync

PC is source of truth. Push from PC, pull on phone.

**Push:** `gatherAllSettings()` reads 4 IDB keys → upserts to `ledger_sync` row → saves push timestamp to `localStorage`

**Pull:** Reads `ledger_sync` row → `applyAllSettings()` writes to IDB → saves pull timestamp → `window.location.reload()`

**Synced keys:** `plannerSettings`, `retirementSettings`, `expenseModel`, `detailedBalances`

**Timestamps:** `lastPushed`/`lastPulled` in localStorage (survive reload), `serverUpdatedAt` fetched from Supabase on mount.

## Known Gotchas

1. **`uuid()` fallback** — `crypto.randomUUID()` is unavailable on older mobile Safari (< 15.4). The `uuid()` function in `useExpenseModel.ts` feature-detects and falls back to Math.random-based generation. Do NOT use `replace_all` on `crypto.randomUUID` — it will turn the call inside `uuid()` into a recursive self-call.

2. **IndexedDB empty state** — On a fresh device, all IDB reads return null. Every hook initializes with defaults and merges IDB data on top. `useExpenseModel` validates `recurring`/`oneTime` are arrays before using them.

3. **RLS** — Supabase re-enables RLS when tables are recreated. Must run `ALTER TABLE ... DISABLE ROW LEVEL SECURITY;` on all 7 tables.

4. **Select styling** — Native `<select>` elements need explicit `bg-surface-2 text-gray-300` classes or they render white-on-white in dark theme.

5. **ErrorBoundary** — Top-level boundary in `App.tsx` catches render crashes and shows error + stack + "Go back to Dashboard" button. Without it, any view crash blanks the entire app.

6. **Supabase error objects** — `PostgrestError` from Supabase is a plain object, not an `Error` instance. Use `extractMessage()` in useSettingsSync that checks for `.message` property before `String()`.

7. **Mobile bottom padding** — Main content uses `pb-28` to clear both the bottom tab bar and the sync bar above it.

## Lessons Learned

- **Never use `replace_all` on a string that also appears inside its own replacement.** The `uuid()` fallback was created by replacing all `crypto.randomUUID()` calls with `uuid()`, which also replaced the one *inside* the `uuid()` function body, creating infinite recursion. Always review the file after a `replace_all`.
- **Mobile-specific crashes need an ErrorBoundary first, debugging second.** Without a boundary, the entire React tree unmounts and you get a blank screen with no error message. The boundary lets you read the actual error on the phone without dev tools.
- **Supabase errors are not Error instances.** `PostgrestError` is a plain object. `catch (e) { String(e) }` produces `[object Object]`. Always check for `.message` property.
- **`useState` initializer functions run during render.** If the initializer throws (e.g., `crypto.randomUUID()` on an unsupported browser), it crashes the component during render — not in an effect where it could be caught.
- **Test on actual mobile after any change to hooks used by views.** Desktop and mobile can have different API availability (`crypto.randomUUID`), different IDB state (fresh vs populated), and different layout behavior.

## GitHub

Repository: `homer31383/stint-ledger` (private)
Remote: `origin` → `https://github.com/homer31383/stint-ledger.git`
Branch: `main`

## Build Commands

```bash
npx tsc --noEmit    # Type check only
npm run build       # Full production build (tsc + vite build)
npm run dev         # Dev server with HMR
```

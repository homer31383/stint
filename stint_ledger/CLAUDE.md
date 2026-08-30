# Stint Ledger — Project Guide for Claude Code

Stint Ledger is a personal financial dashboard PWA for a freelance Creative Director. It pulls real booking/income data from a shared Supabase backend (populated by the Stint time-tracking app), combines it with manually-entered account balances stored in IndexedDB, and provides financial modeling across 8 views: Dashboard, Utilization, Pipeline, Invoices, Planner, Expenses, Net Worth, and Retirement. The app runs on a home LAN, is installable on desktop and mobile, and works offline.

## Tech Stack (exact versions from package.json)

| Layer | Tool | Version |
|-------|------|---------|
| Framework | React + ReactDOM | ^18.3.1 |
| Language | TypeScript (strict) | ^5.5.3 |
| Build | Vite | ^5.4.0 |
| React plugin | @vitejs/plugin-react | ^4.3.1 |
| Styling | Tailwind CSS | ^3.4.4 |
| CSS tooling | PostCSS + Autoprefixer | ^8.4.38 / ^10.4.19 |
| Data source | @supabase/supabase-js | ^2.45.0 |
| Local storage | idb (IndexedDB wrapper) | ^8.0.0 |
| Charts | Recharts | ^2.12.0 |
| PWA | vite-plugin-pwa (Workbox) | ^0.20.0 |
| Type defs | @types/react, @types/react-dom | ^18.3.3 / ^18.3.0 |
| Fonts | IBM Plex Sans (UI), IBM Plex Mono (numbers) | Google Fonts CDN |

## How to Run

```bash
npm install
npm run dev          # Dev server at http://localhost:5173 (LAN: http://192.168.29.152:5173)
npm run build        # Production: tsc + vite build -> dist/
npm run preview      # Preview production build
npx tsc --noEmit     # Type check only
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
    ├── App.tsx                          Root: auth gate, ErrorBoundary, Navigation, view router, hooks
    ├── index.css                        Tailwind directives, scrollbar/slider styling, tap-highlight off
    ├── vite-env.d.ts                    Type defs for VITE_SUPABASE_URL/KEY env vars
    ├── lib/
    │   ├── types.ts                     All TypeScript interfaces (Stint data, balances, view IDs)
    │   ├── supabase.ts                  Supabase client singleton, fetchStintData() fetches all 6 tables
    │   ├── storage.ts                   IndexedDB helpers: save/load for cache, balances, settings, scenarios, sync
    │   ├── tax.ts                       estimateTaxes() (payrolled freelance: FICA+fed+state), estimateW2Taxes() (W-2)
    │   ├── rates.ts                     Rate card constants: CD_DAY_RATE ($1,384), SHOOT_SUP_RATE ($1,500)
    │   └── helpers.ts                   fmt(), fmtPct(), weekdaysElapsedYTD(), currentYear(), parseDate()
    ├── hooks/
    │   ├── useStintData.ts              Fetches Supabase -> caches IDB -> returns data/loading/error/refresh
    │   ├── useAccountBalances.ts        Loads DetailedBalances from IDB, computes aggregate AccountBalances
    │   ├── usePlannerSettings.ts        Planner slider state, persists to IDB, merge-on-load with defaults
    │   ├── useExpenseModel.ts           Recurring/one-time expenses, drag reorder, replace model, uuid() fallback
    │   ├── useRetirementSettings.ts     Retirement scenario sliders, persists to IDB
    │   ├── useReferencePlans.ts         Reference plans model (sections/cards/checklists), persists to IDB
    │   ├── useSavedScenarios.ts         Save/load/compare named planner+expense snapshots, persists to IDB
    │   └── useSettingsSync.ts           Push/pull settings to Supabase ledger_sync table
    ├── components/
    │   ├── Login.tsx                    Full-screen login form (email + password, error display)
    │   ├── Navigation.tsx               Desktop sidebar + mobile bottom tabs + settings sync UI + sign out
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
        ├── Planner.tsx                  Days-to-target, scenario modeler, saved scenarios, compare mode, 5-year projection
        ├── Expenses.tsx                 Drag-to-reorder recurring, one-time expenses, mute toggle, financial impact
        ├── NetWorth.tsx                 Per-account editing, asset allocation, FI progress, runway
        ├── Retirement.tsx               Long-term projection age->95, portfolio longevity, safe withdrawal
        └── Plans.tsx                    Reference Plans: editable plan cards in 4 collapsible sections
```

## Architecture & Data Flow

```
Supabase Auth (email/password login)
  ↓ session required
Supabase (stint_* tables, RLS: authenticated only)
  ↓ fetchStintData()
useStintData hook -> caches to IDB "stint" store
  ↓
App.tsx gates on auth session, then passes data + balances as props to views
  ↓
Views call local hooks (useExpenseModel, usePlannerSettings, useSavedScenarios, etc.)
  ↓
All local settings persist to IndexedDB
  ↓
Settings sync: PC pushes to ledger_sync table, phone pulls from it
```

### Auth Flow (added March 2026)
1. `App.tsx` calls `supabase.auth.getSession()` on mount and listens via `onAuthStateChange()`
2. If no session: renders `<Login />` component (email + password form)
3. If session exists: renders the full app (Navigation + views)
4. Sign out button in Navigation sidebar calls `supabase.auth.signOut()`
5. Supabase JS client handles session persistence in localStorage automatically
6. Single user account created manually in Supabase Dashboard — no signup flow

### Shared State (via App.tsx props)
`data` (StintData), `balances` (AccountBalances), `detailed` (DetailedBalances)

### Local to Each View
Planner settings, expense model, saved scenarios, retirement settings — each managed by their own hook with IDB persistence.

### IndexedDB Stores
- `stint` — cached Supabase data + `planner-settings` + `retirement-settings` + `expense-model` + `saved-scenarios`
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

### RLS Policy (applied March 2026)
All tables have RLS enabled with `TO authenticated` policies:
- `stint_*` tables: `Authenticated read` — SELECT only for authenticated users
- `ledger_sync`: `Authenticated read/write` — ALL operations for authenticated users
- Old `Allow anon read` policies dropped
- Both Stint and Stint Ledger use Supabase Auth, so authenticated-only works for both
- Axiom (separate app on same Supabase instance) uses different tables, unaffected

## Supabase Auth Configuration

- **Provider**: Email (enabled)
- **Confirm email**: Disabled (single user)
- **Enable signup**: Disabled (account created manually)
- **User**: `shopping@chrisbernier.com` (created manually in dashboard, auto-confirmed)
- **Shared with Stint app**: Same Supabase instance, same user account works for both

## Key Hooks

| Hook | Returns | Persists to |
|------|---------|-------------|
| `useStintData` | `{ data, loading, syncing, error, refresh }` | IDB `stint` store (cache) |
| `useAccountBalances` | `{ balances, detailed, setDetailed, loaded }` | IDB `accounts/balances` |
| `usePlannerSettings(defaults)` | `{ settings, update, reset, loaded }` | IDB `stint/planner-settings` |
| `useExpenseModel` | `{ model, addRecurring, updateRecurring, removeRecurring, reorderRecurring, replaceModel, addOneTime, updateOneTime, removeOneTime, setFullYearProjection, reset, loaded }` | IDB `stint/expense-model` |
| `useRetirementSettings` | `{ settings, update, reset, loaded }` | IDB `stint/retirement-settings` |
| `useSavedScenarios` | `{ scenarios, loaded, save, remove }` | IDB `stint/saved-scenarios` |
| `useSettingsSync` | `{ push, pull, pushing, pulling, lastPushed, lastPulled, serverUpdatedAt, error }` | `localStorage` for timestamps, Supabase for data |

## Views

| View | Depends on | Key feature |
|------|-----------|-------------|
| Dashboard | StintData, AccountBalances | YTD overview, runway calc, monthly income chart |
| Utilization | StintData | Year selector, monthly/client/service breakdowns |
| Pipeline | StintData | Weighted pipeline: booked 100%, pencil 70%/40%/20% |
| Invoices | StintData | Status breakdown, sorted list, outstanding/overdue |
| Planner | StintData, AccountBalances, usePlannerSettings, useExpenseModel, useSavedScenarios | Days-to-target, freelance/FT toggle, saved scenarios, compare mode, 5-year projection |
| Expenses | StintData, AccountBalances, useExpenseModel, usePlannerSettings | Drag-to-reorder recurring, mute toggle, financial impact simulation |
| Net Worth | DetailedBalances, AccountBalances | Per-account editing, allocation chart, FI progress, runway |
| Retirement | AccountBalances, useRetirementSettings | Age->95 projection, depletion warnings, safe withdrawal |
| Plans | useReferencePlans | Editable reference of financial plans: monthly/annual/conditional sections + dated checklists with deadlines and persisted checkbox state. IDB key `stint/reference-plans`, included in settings sync |

## Planner View — Sections (in order)

1. **Days to Target** (freelance only) — target utilization slider, bookings/pencils toggles, progress bar (worked + committed + needed), status text
2. **Saved Scenarios** — collapsible panel, load (with confirm), delete (with confirm), compare mode checkboxes
3. **Scenario Comparison** (compare mode) — current + up to 3 saved scenarios side by side, 14 metrics, best green / worst red
4. **Scenario Inputs** — vacation/holidays/sick (freelance) or salary/401k/match (FT), expenses, health insurance, return rates, day rate + utilization (freelance)
5. **Financial Picture Toggle** — full picture (passive + investment) vs income-only
6. **Monthly Snapshot** — gross, taxes, take-home, interest, returns, expenses, cash flow, NW growth
7. **Employment Mode Toggle** — freelance / full-time
8. **Annual View** — gross, net, savings, interest, returns, retirement growth, NW growth
9. **Summary Callout** — cash flow health message (positive/marginal/negative)
10. **Scenario Comparison Table** (freelance) — 8 predefined rate/utilization combos
11. **Freelance vs FT Comparison** (FT mode) — side-by-side metrics with delta
12. **5-Year Net Worth Projection** — stacked bar chart + inflation slider
13. **Rollover IRA Deployment** — comparison at different nominal/real return rates

## Saved Scenarios

Each saved scenario captures a complete snapshot:
- **PlannerSettings**: all slider values, toggles, employment mode
- **ExpenseModel**: all recurring expenses (name, amount, category, muted), all one-time expenses (name, amount, month, muted)
- **Computed metrics**: mode, day rate/salary, utilization, gross/net annual, monthly cash flow (income-only and full picture), annual savings (income-only and full picture), year-5 NW, monthly expenses, recurring total, one-time total

**Loading a scenario** replaces both planner settings and the expense model (with confirmation dialog).

**Comparing scenarios** shows a table with current + up to 3 saved scenarios. Each numeric metric highlights best (green) and worst (red). Expense rows use inverted highlighting (lower = better).

Saved scenarios are stored in IDB under `saved-scenarios` and included in the settings sync blob.

## Expenses View — Features

- **Drag-to-reorder**: Desktop HTML5 DnD, mobile long-press (400ms) touch drag with floating clone
- **Mute toggle**: Dim and exclude expenses from calculations without deleting
- **Category system**: housing, insurance, utilities, food, transport, subscriptions, health, other (color-coded dots)
- **Financial Impact**: Toggle between year-end projection (month-by-month simulation with account cascading) and one-time impact only
- **Account cascade**: Deficits draw from HYS -> Money Market -> Checking
- **Callouts**: Depletion warnings, HYS drawdown alerts, healthy status

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
- Freelance engagements are W-2 payrolled (employer of record pays the employer half of FICA), so freelance income is taxed like wages — NOT self-employment tax
- FICA: employee-side only — 6.2% SS (capped $176,100) + 1.45% Medicare
- Federal: progressive brackets on (gross - $15k standard deduction)
- NY State: 7% flat on gross
- Brackets: 10%->$11,925 / 12%->$48,475 / 22%->$103,350 / 24%->$197,300 / 32%->$250,525 / 35%->$626,350 / 37% above

### Full-time (`estimateW2Taxes`)
- FICA: 6.2% SS (capped $176,100) + 1.45% Medicare
- 401k reduces taxable income (pre-tax)
- Federal: same brackets on (gross - 401k - $15k deduction)
- NY State: 7% on (gross - 401k)

## Settings Sync

PC is source of truth. Push from PC, pull on phone.

**Push:** `gatherAllSettings()` reads 5 IDB keys -> upserts to `ledger_sync` row -> saves push timestamp to `localStorage`

**Pull:** Reads `ledger_sync` row -> `applyAllSettings()` writes to IDB -> saves pull timestamp -> `window.location.reload()`

**Synced keys:** `plannerSettings`, `retirementSettings`, `expenseModel`, `detailedBalances`, `savedScenarios`, `exportProfile`, `referencePlans`

**Timestamps:** `lastPushed`/`lastPulled` in localStorage (survive reload), `serverUpdatedAt` fetched from Supabase on mount.

## Retirement View

- **Scenario inputs**: current age, retirement age, annual IRA/HSA contributions, pre/post-retirement return rates, inflation, monthly spending, Social Security
- **Include Taxable toggle**: adds brokerage + checking + HYS + MM to projection (separate color in chart)
- **Projection**: compound growth from current age to 95, accumulation phase -> distribution phase -> depletion
- **Key outputs**: balance at retirement, portfolio longevity (years), safe withdrawal rate, depletion age
- **Chart**: stacked bar with color-coded phases (green accumulation, blue distribution, red depleted)

## Known Gotchas

1. **`uuid()` fallback** — `crypto.randomUUID()` is unavailable on older mobile Safari (< 15.4). The `uuid()` function in `useExpenseModel.ts` and `useSavedScenarios.ts` feature-detects and falls back to Math.random-based generation. Do NOT use `replace_all` on `crypto.randomUUID` — it will turn the call inside `uuid()` into a recursive self-call.

2. **IndexedDB empty state** — On a fresh device, all IDB reads return null. Every hook initializes with defaults and merges IDB data on top. `useExpenseModel` validates `recurring`/`oneTime` are arrays before using them.

3. **RLS** — RLS is now enabled on all tables with `TO authenticated` policies. If tables are recreated, you must re-apply RLS policies (see SQL in disaster recovery doc).

4. **Select styling** — Native `<select>` elements need explicit `bg-surface-2 text-gray-300` classes or they render white-on-white in dark theme.

5. **ErrorBoundary** — Top-level boundary in `App.tsx` catches render crashes and shows error + stack + "Go back to Dashboard" button. Without it, any view crash blanks the entire app.

6. **Supabase error objects** — `PostgrestError` from Supabase is a plain object, not an `Error` instance. Use `extractMessage()` in useSettingsSync that checks for `.message` property before `String()`.

7. **Mobile bottom padding** — Main content uses `pb-28` to clear both the bottom tab bar and the sync bar above it.

8. **Drag-to-reorder touch events** — Mobile drag uses `touch-none` CSS on the drag handle and `document.body.style.overflow = 'hidden'` during drag to prevent scroll interference. Cleanup restores overflow on touch end.

9. **`.single()` vs `.maybeSingle()`** — Supabase `.single()` returns 406 when zero rows match. Use `.maybeSingle()` for queries that may return no rows (e.g., `ledger_sync` on first run before any push). Both are used in `useSettingsSync.ts`.

10. **Auth-gated hooks** — `useStintData` and `useSettingsSync` run on mount regardless of auth state. `useSettingsSync` now checks for an active session before querying `ledger_sync`. Supabase data fetches will fail with RLS errors if no session exists, but the auth gate in `App.tsx` prevents views from rendering before auth completes.

## Lessons Learned

- **Never use `replace_all` on a string that also appears inside its own replacement.** The `uuid()` fallback was created by replacing all `crypto.randomUUID()` calls with `uuid()`, which also replaced the one *inside* the `uuid()` function body, creating infinite recursion. Always review the file after a `replace_all`.
- **Mobile-specific crashes need an ErrorBoundary first, debugging second.** Without a boundary, the entire React tree unmounts and you get a blank screen with no error message. The boundary lets you read the actual error on the phone without dev tools.
- **Supabase errors are not Error instances.** `PostgrestError` is a plain object. `catch (e) { String(e) }` produces `[object Object]`. Always check for `.message` property.
- **`useState` initializer functions run during render.** If the initializer throws (e.g., `crypto.randomUUID()` on an unsupported browser), it crashes the component during render — not in an effect where it could be caught.
- **Test on actual mobile after any change to hooks used by views.** Desktop and mobile can have different API availability (`crypto.randomUUID`), different IDB state (fresh vs populated), and different layout behavior.
- **PWA service worker caches aggressively.** After code changes, use Ctrl+Shift+R or unregister the service worker in DevTools > Application to see updates. Stale cache can make it look like changes weren't applied.
- **`.single()` causes 406 on empty results.** Use `.maybeSingle()` for queries that might return zero rows. This bit us on the `ledger_sync` timestamp fetch when no settings had been pushed yet.

## Deployment

- **Not yet deployed to Vercel** — deployment was discussed but not completed this session
- **GitHub**: `homer31383/stint-ledger` (private)
- **Remote**: `origin` -> `https://github.com/homer31383/stint-ledger.git`
- **Branch**: `main`

## Build Commands

```bash
npx tsc --noEmit    # Type check only
npm run build       # Full production build (tsc + vite build)
npm run dev         # Dev server with HMR
```

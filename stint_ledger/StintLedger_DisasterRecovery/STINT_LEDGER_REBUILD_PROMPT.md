# Stint Ledger — Rebuild Prompt for Claude Code

Use this prompt if everything is lost and you need to rebuild Stint Ledger from scratch. Paste the entire contents of this file into Claude Code.

---

Build a personal financial dashboard PWA called "Stint Ledger" for a freelance Creative Director. It reads booking/income data from Supabase (populated by a separate Stint time-tracking app) and combines it with manually-entered account balances stored in IndexedDB.

## Stack
- React 18 + TypeScript (strict mode)
- Vite 5 with vite-plugin-pwa
- Tailwind CSS 3 with custom dark theme
- Supabase JS client (read-only from stint_* tables, read-write for ledger_sync)
- IndexedDB via `idb` library
- IBM Plex Sans (UI) + IBM Plex Mono (numbers) from Google Fonts
- No routing library — simple state-based view switching

## Theme Colors
```
surface-0: #0a0c10 (darkest bg)
surface-1: #12151c (card bg)
surface-2: #1a1e28 (input bg)
surface-3: #232836 (borders)
accent: #5b8def (blue)
positive: #34d399 (green)
negative: #f87171 (red)
caution: #fbbf24 (yellow)
retirement: #a78bfa (purple)
highlight: #22d3ee (cyan)
```

## Supabase Tables (6 read-only + 1 read-write)
Read-only stint_* tables: clients, projects, time_entries, pencils, invoices, settings. All use TEXT primary keys and BIGINT created_at timestamps. RLS must be DISABLED on all tables.

Read-write: `ledger_sync` table with single row (id='default'), JSONB `data` column, and `updated_at` timestamp.

## Account Structure (11 accounts -> 8 aggregates)
```
checking    = advRelationship + santanderChecking + advantageSavings
hys         = highYieldSavings + openbankHYS
moneyMarket = santanderMM
brokerage   = nonRetirement
tradIRA     = traditionalIRA
rolloverIRA = rolloverIRA
hsa         = hsa
ccDebt      = citiDoubleCash (negative)
```

## 8 Views to Build

### 1. Dashboard
YTD income, days worked, utilization %, outstanding invoices, net worth, runway (accessible / monthly expenses), monthly income bar chart, upcoming bookings list.

### 2. Utilization
Year selector (current + prior), monthly breakdown table (income, days, util%, bar), by-client breakdown, by-service-type breakdown.

### 3. Pipeline
Weighted pipeline calculation: booked 100%, pencil 70%, pencil 2 40%, pencil 3 20%. Show booked/penciled day counts, confirmed revenue, deal lists with status tags.

### 4. Invoices
Status breakdown cards (draft/sent/paid/overdue), all invoices sorted by issue_date desc, outstanding and overdue totals.

### 5. Planner (most complex view)
Build these sections in order:

a) **Days to Target** (freelance only): Target utilization slider (5-95%), bookings/pencils toggle checkboxes, 3-segment progress bar (worked=green, committed=blue, needed=yellow), text showing days worked + committed + needed + days/month of new work needed.

b) **Saved Scenarios**: Collapsible panel showing saved scenario list. Each has name, date, preview stats. Load button (with confirm: "This will replace your current planner settings and expense model. Continue?"), delete button (with confirm). Compare mode: checkboxes to select up to 3, shows comparison table with current + selected, 14 metrics with green=best/red=worst highlighting per row. Metrics: mode, day rate/salary, utilization, gross annual, net annual, monthly expenses, recurring expenses, one-time (annual), cash flow income-only, cash flow full, savings income-only, savings full, year-5 NW. Each saved scenario stores: full PlannerSettings + full ExpenseModel + computed metrics.

c) **Scenario Inputs**: Mode-dependent sliders. Freelance: vacation days (0-40), holidays (0-15), sick days (0-15), day rate ($800-2000), utilization (30-90%). Full-time: salary ($100k-350k), 401k contribution (0-$23,500), employer match (0-10%), health insurance ($0-800), other benefits ($0-1000). Shared: monthly expenses ($6k-14k), health insurance ($400-2400, freelance only), equity return (0-15%), rollover IRA return (0-15%), cash return (0-7%).

d) **Financial picture toggle**: Full picture (include passive income + investment returns) vs income-only.

e) **Monthly Snapshot**: Stat cards for gross, taxes, take-home, interest income, investment returns, expenses, net cash flow, retirement growth, total NW growth.

f) **Employment Mode Toggle**: Freelance / Full-Time buttons.

g) **Annual View**: Yearly totals of same metrics.

h) **Summary Callout**: Color-coded message based on cash flow health.

i) **Scenario Comparison Table** (freelance only): 8 predefined rate/util combos (50-70% at $1200, 55%/65% at $1400, 60% at $1600).

j) **Freelance vs FT Comparison** (FT mode): Side-by-side metrics with delta column.

k) **5-Year Net Worth Projection**: Stacked bar chart (accessible + retirement), uses real returns (nominal - inflation). Inflation slider at bottom.

l) **Rollover IRA Deployment**: Table showing current rollover balance at 4%, 7%, 10%, 12% nominal rates over 5 years.

### 6. Expenses
a) **Income Summary**: Read-only from Planner settings (net take-home, passive income, total monthly in, net after expenses).

b) **Recurring Expenses**: Editable list with drag-to-reorder (desktop: HTML5 DnD, mobile: long-press 400ms touch drag with floating clone). Each row: drag handle (3-line icon), category dropdown (8 categories: housing/insurance/utilities/food/transport/subscriptions/health/other with color dots), name input, amount input with $ prefix, mute toggle (dims row, excludes from calculations), delete button. Default 8 expenses totaling $8,750/mo.

c) **One-Time Expenses**: Month picker, name, amount, mute toggle, delete. Sorted by month.

d) **Expense Summary**: Monthly recurring total, annual total, avg monthly (incl one-time), highest month.

e) **Financial Impact**: Toggle between full-year projection and one-time impact only. Full year: month-by-month simulation where income flows to checking, deficits cascade HYS->MM->Checking, one-time expenses pull from HYS first. Shows 7 balance projection cards (checking, HYS, MM, brokerage, accessible, retirement, NW) with current->projected and delta. Month-by-month table. Callout with depletion warnings.

f) **Monthly Timeline**: Stacked bar chart (recurring red + one-time yellow per month).

g) **Category Breakdown**: Horizontal bar chart + legend.

### 7. Net Worth
Per-account editable inputs in collapsible groups (Banking: Cash & Checking, Credit, Savings | Investments: Non-retirement, Retirement, Other). Asset allocation bar. Debt-to-asset ratio. Liquid runway. FI progress (% of 25x annual expenses).

### 8. Retirement
Sliders: current age, retirement age, annual IRA/HSA contributions, pre/post-retirement return rates, inflation rate, monthly spending, Social Security. Include Taxable toggle. Age-to-95 projection with accumulation/distribution/depletion phases. Stacked bar chart color-coded by phase. Outputs: balance at retirement, portfolio longevity, safe withdrawal rate, depletion age.

## Hooks to Build
1. **useStintData**: Fetch all 6 Supabase tables via Promise.all, cache to IDB, return data/loading/error/refresh.
2. **useAccountBalances**: Load DetailedBalances from IDB, compute aggregate AccountBalances via toAggregateBalances(), return balances/detailed/setDetailed.
3. **usePlannerSettings(defaults)**: Load/merge from IDB, expose update(key, value) and reset(). Freelance defaults: dayRate from stint_settings, utilization from actual YTD.
4. **useExpenseModel**: CRUD for recurring/one-time expenses. `reorderRecurring(from, to)` for drag. `replaceModel(model)` for loading scenarios. uuid() with crypto.randomUUID fallback.
5. **useRetirementSettings**: Same pattern as usePlannerSettings.
6. **useSavedScenarios**: Array of SavedScenario in IDB. save(name, settings, expenseModel, metrics), remove(id).
7. **useSettingsSync**: Push gatherAllSettings() to ledger_sync, pull and applyAllSettings(). Timestamps in localStorage.

## Tax Calculations
Freelance: SE tax (15.3% on 92.35%) + Federal progressive (10-37% brackets) + NY State (7% flat).
W-2: FICA (6.2% SS capped $176,100 + 1.45% Medicare) + Federal progressive + NY State. 401k pre-tax.

## Settings Sync
Single Supabase row, JSONB blob with 5 keys: plannerSettings, retirementSettings, expenseModel, detailedBalances, savedScenarios. PC pushes, phone pulls + reloads.

## Navigation
Desktop: fixed left sidebar (w-56). Mobile: fixed bottom tabs. Icons: ⌂ ◧ ▤ ⊡ ⟐ ⊘ ◉ ◇. Sync UI in sidebar/above tabs.

## PWA Config
vite-plugin-pwa with autoUpdate, manifest (name: Stint Ledger, theme: #0a0c10, standalone), Workbox runtime caching for Supabase API (NetworkFirst, 24h).

## Critical Implementation Notes
1. uuid() in useExpenseModel and useSavedScenarios must feature-detect crypto.randomUUID and fall back to Math.random-based UUID for old Safari.
2. All IDB reads return null on fresh devices. Every hook must initialize with defaults.
3. ErrorBoundary wrapping all views in App.tsx is essential — without it, any crash blanks the screen.
4. PostgrestError from Supabase is a plain object, not an Error instance. Check .message property.
5. Native select elements need explicit bg-surface-2 text-gray-300 classes for dark theme.
6. Main content needs pb-28 padding to clear mobile bottom tabs + sync bar.
7. Vite server host: '0.0.0.0' for LAN access.

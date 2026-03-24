# Stint Ledger — Complete Documentation

Last updated: March 2026

## Overview

Stint Ledger is a personal financial dashboard PWA for a freelance Creative Director. 8 views: Dashboard, Utilization, Pipeline, Invoices, Planner, Expenses, Net Worth, Retirement.

- **Stack**: React 18 + TypeScript (strict), Vite 5, Tailwind CSS 3, Supabase, IndexedDB via `idb`, vite-plugin-pwa
- **Fonts**: IBM Plex Sans (UI), IBM Plex Mono (numbers)
- **Theme**: Custom dark theme with surface-0..3, accent, positive, negative, caution, retirement, highlight

## Architecture

```
Supabase (6 stint_* tables) --fetch--> useStintData --cache--> IndexedDB
                                              |
                                        App.tsx (router)
                                         /    |    \
                              Dashboard  Planner  Expenses  ...etc
                                              |        |
                                    usePlannerSettings  useExpenseModel
                                    useSavedScenarios
                                              |
                                         IndexedDB
                                              |
                                    useSettingsSync --push/pull--> ledger_sync table
```

## Data Model

### Supabase Tables (read-only)
- `stint_clients` - Client names, emails, service rates
- `stint_projects` - Projects with status, roles, client link
- `stint_time_entries` - Daily time entries with service_type, rate, amount
- `stint_pencils` - Booked/penciled date ranges with priority 0-3
- `stint_invoices` - Invoices with line items, status, totals
- `stint_settings` - Business info, invoice config, service rates

### Supabase Tables (read-write)
- `ledger_sync` - Single row (id='default'), JSONB blob of all settings

### IndexedDB
- Store `stint`: cached Supabase data + planner-settings + retirement-settings + expense-model + saved-scenarios
- Store `accounts`: DetailedBalances (11 individual account balances)

### Account Structure
11 individual accounts aggregate to 8 buckets:
- **checking** = advRelationship + santanderChecking + advantageSavings
- **hys** = highYieldSavings + openbankHYS
- **moneyMarket** = santanderMM
- **brokerage** = nonRetirement
- **tradIRA** = traditionalIRA
- **rolloverIRA** = rolloverIRA
- **hsa** = hsa
- **ccDebt** = citiDoubleCash (negative)

## Hooks

| Hook | Purpose | Persistence |
|------|---------|-------------|
| useStintData | Fetch Supabase, cache to IDB | IDB stint store |
| useAccountBalances | Load/save DetailedBalances, compute aggregates | IDB accounts/balances |
| usePlannerSettings | All planner sliders + toggles | IDB stint/planner-settings |
| useExpenseModel | Recurring/one-time CRUD, reorder, replace | IDB stint/expense-model |
| useRetirementSettings | Retirement sliders | IDB stint/retirement-settings |
| useSavedScenarios | Save/load/compare scenario snapshots | IDB stint/saved-scenarios |
| useSettingsSync | Push/pull all settings to Supabase | localStorage + Supabase |

## Components

| Component | Purpose |
|-----------|---------|
| Navigation | Desktop sidebar (w-56) + mobile bottom tabs + sync UI |
| Panel | Card container with optional title + action slot |
| StatCard | Label + large monospace value + sub text |
| Slider | Range input with formatted value display |
| MiniBar | Thin horizontal progress bar |
| StatusTag | Color-coded status badge |

## Views

### Dashboard
YTD income, days worked, utilization, outstanding invoices, net worth, runway, monthly income chart, upcoming bookings.

### Utilization
Year selector, 4-stat grid (income, util%, days, avg rate), monthly breakdown table, by-client, by-service-type.

### Pipeline
Weighted pipeline (booked 100%, pencil 70%/40%/20%), booked/penciled day counts, confirmed revenue, deal lists.

### Invoices
Status breakdown (draft/sent/paid/overdue), all invoices sorted by date, outstanding/overdue totals.

### Planner (~1100 lines)
The largest and most complex view. Sections:
1. **Days to Target** (freelance only) - target utilization slider + bookings/pencils toggles + 3-segment progress bar (worked green, committed blue, needed yellow) + status text
2. **Saved Scenarios** - collapsible panel, load (with confirm dialog), delete (with confirm), compare mode checkboxes (max 3)
3. **Scenario Comparison** (compare mode active) - table: current + up to 3 saved, 14 metrics, best green / worst red per row
4. **Scenario Inputs** - mode-dependent sliders: freelance (vacation, holidays, sick, day rate, utilization) or FT (salary, 401k, match, health ins, benefits) + shared (expenses, health ins, return rates)
5. **Financial Picture Toggle** - full picture (passive+investment) vs income-only
6. **Monthly Snapshot** - stat cards: gross, taxes, take-home, interest, returns, expenses, cash flow, NW growth
7. **Employment Mode Toggle** - freelance / full-time buttons
8. **Annual View** - yearly totals
9. **Summary Callout** - colored health message
10. **Scenario Comparison Table** (freelance) - 8 predefined rate/util combos
11. **Freelance vs FT Comparison** (FT mode) - side-by-side with deltas
12. **5-Year Net Worth Projection** - stacked bar (accessible + retirement) + inflation slider
13. **Rollover IRA Deployment** - comparison at 4%, 7%, 10%, 12% nominal rates

**Saved Scenarios** capture full PlannerSettings + full ExpenseModel + 14 computed metrics. Loading replaces both.

### Expenses (~980 lines)
1. **Income Summary** - read-only from Planner settings
2. **Recurring Expenses** - drag-to-reorder list with category dropdown, name, amount, mute toggle, delete. Desktop: HTML5 DnD. Mobile: long-press (400ms) touch drag with floating clone.
3. **One-Time Expenses** - month picker, name, amount, mute toggle, delete
4. **Expense Summary** - monthly recurring total, annual total, avg monthly, highest month
5. **Financial Impact** - toggle full year vs one-time:
   - Full year: month-by-month simulation with account cascading (HYS -> MM -> Checking), depletion tracking
   - One-time: instant drawdown from HYS
   - 7 balance projection cards + month-by-month table + callout
6. **Monthly Timeline** - stacked bar chart (recurring + one-time per month)
7. **Category Breakdown** - horizontal bar + legend (8 categories, color-coded)

**Categories**: housing, insurance, utilities, food, transport, subscriptions, health, other

### Net Worth
- Per-account editing in collapsible groups (Banking: Cash & Checking, Credit, Savings; Investments: Non-retirement, Retirement, Other)
- Asset allocation bar + legend
- Debt-to-asset ratio
- Liquid runway (liquid assets / monthly expenses)
- FI progress (% toward 25x annual expenses)

### Retirement
- Scenario inputs: current age, retirement age, IRA/HSA contributions, pre/post-retirement returns, inflation, monthly spending, Social Security
- Include Taxable toggle (adds brokerage + cash accounts)
- Age-to-95 projection: accumulation -> distribution -> depletion
- Stacked bar chart color-coded by phase
- Key outputs: balance at retirement, portfolio longevity, safe withdrawal rate, depletion age
- Warnings for shortfall scenarios

## Tax Calculations

### Freelance
SE tax (15.3% on 92.35%) + Federal progressive (10%-37%) + NY State (7% flat).

### Full-Time W-2
FICA (6.2% SS capped + 1.45% Medicare) + Federal progressive + NY State. 401k reduces taxable.

## Settings Sync
PC pushes, phone pulls. Single ledger_sync row with JSONB blob containing: plannerSettings, retirementSettings, expenseModel, detailedBalances, savedScenarios.

## PWA
Auto-update service worker, installable manifest, Supabase API runtime caching (NetworkFirst, 24h expiration).

## Known Gotchas
1. uuid() fallback for old Safari - NEVER replace_all on crypto.randomUUID
2. IDB empty state - all hooks default-initialize
3. RLS auto-enables on table recreation
4. Select styling needs explicit dark classes
5. ErrorBoundary required or crashes blank the app
6. PostgrestError is plain object, not Error
7. pb-28 for mobile bottom padding
8. Touch drag needs body overflow:hidden
9. Service worker caches aggressively - hard refresh to see changes

# Stint Ledger — Complete Disaster Recovery Guide

Last updated: March 2026

This document contains everything needed to rebuild Stint Ledger from scratch if all code, files, and project data are lost. It is written to be readable by a human and usable as a prompt for Claude / Claude Code.

---

## 1. WHAT IS STINT LEDGER?

Stint Ledger is a personal financial dashboard built as a Progressive Web App (PWA). It is a companion app to Stint (a freelance management tool for time tracking, bookings, and invoicing). Stint tracks the work; Ledger tracks the money.

The app is built for a single user — a freelance Creative Director in advertising post-production based in Brooklyn, NY. It pulls real booking and income data from Stint via a shared Supabase backend, combines it with manually-entered account balances, and provides financial modeling, projections, and scenario planning.

The app runs locally on the home network (not deployed to the public internet). It is installable as a PWA on both desktop and mobile. Once cached, it works offline — Supabase data syncs when online, all settings and balances persist in IndexedDB on each device. A settings sync feature bridges devices through Supabase.

---

## 2. TECH STACK

- **Framework:** React 18+ with TypeScript
- **Build tool:** Vite
- **Styling:** Tailwind CSS
- **Data source:** Supabase (shared instance with Stint app — read-only access)
- **Local storage:** IndexedDB (via idb or localforage) for account balances, planner settings, expense model, retirement settings
- **PWA:** vite-plugin-pwa (service worker caching, installable, offline support)
- **Deployment:** Local only — served via Vite dev server or static production build on home network
- **No backend server** — everything runs client-side

### Key dependencies (npm)

- react, react-dom
- typescript
- vite
- @supabase/supabase-js
- tailwindcss, postcss, autoprefixer
- vite-plugin-pwa (workbox)
- idb or localforage (IndexedDB wrapper)

---

## 3. ENVIRONMENT & INFRASTRUCTURE

### Supabase

Shared Supabase instance with the Stint app.

```
Project URL: https://xxsjfeafpzzcmadyvuue.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4c2pmZWFmcHp6Y21hZHl2dXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjk0NTQsImV4cCI6MjA4NzcwNTQ1NH0.caN_McmyoWHdq7rtu7gEuiZVoLV0enmxwgiDHU03CTU
```

Environment variables file (`.env`):
```
VITE_SUPABASE_URL=https://xxsjfeafpzzcmadyvuue.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4c2pmZWFmcHp6Y21hZHl2dXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjk0NTQsImV4cCI6MjA4NzcwNTQ1NH0.caN_McmyoWHdq7rtu7gEuiZVoLV0enmxwgiDHU03CTU
```

### RLS (Row Level Security)

RLS is disabled on all Stint tables for simplicity (personal app, single user). If tables are ever recreated, run:

```sql
ALTER TABLE stint_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_pencils DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_sync DISABLE ROW LEVEL SECURITY;
```

### Local network

- PC local IP: 192.168.29.152
- Dev server: http://192.168.29.152:5174
- Production build: http://192.168.29.152:4173
- Vite config must include `server: { host: '0.0.0.0' }` to expose on LAN

---

## 4. SUPABASE SCHEMA

### Stint tables (owned by Stint app — Ledger reads only)

```sql
stint_clients (
  id text primary key,
  name text not null,
  email text,
  notes text,
  service_rates jsonb default '{}',
  created_at bigint
)

stint_projects (
  id text primary key,
  client_id text references stint_clients(id),
  name text not null,
  status text default 'active',
  director text, director_email text,
  producer text, producer_email text,
  production_company text, creative_director text,
  lead_3d text, lead_2d text, my_role text,
  due_date text, notes text,
  created_at bigint
)

stint_time_entries (
  id text primary key,
  project_id text references stint_projects(id),
  date text not null,
  hour integer,
  service_type text default 'day_rate',
  hours numeric default 1,
  rate numeric default 0,
  amount numeric default 0,
  notes text,
  created_at bigint
)

stint_pencils (
  id text primary key,
  client_id text references stint_clients(id),
  project_id text references stint_projects(id),
  start_date text not null,
  end_date text not null,
  priority integer default 1,
  notes text,
  created_at bigint
)

stint_invoices (
  id text primary key,
  number text,
  client_id text references stint_clients(id),
  client_name text, client_email text,
  entry_ids jsonb default '[]',
  line_items jsonb default '[]',
  total numeric default 0,
  status text default 'draft',
  issue_date text, due_date text,
  invoice_code text, notes text,
  date_range text, dates_worked jsonb default '[]',
  created_at bigint
)

stint_settings (
  id text primary key default 'default',
  business_name text, business_email text,
  business_phone text, business_address text,
  bank_name text, routing text, account_number text,
  invoice_prefix text default 'CB',
  next_invoice_number integer default 2,
  payment_terms integer default 30,
  hide_dollars boolean default true,
  service_rates jsonb
)
```

### Ledger-owned table (settings sync)

```sql
CREATE TABLE ledger_sync (
  id text primary key default 'default',
  data jsonb not null,
  updated_at timestamp with time zone default now()
);
```

---

## 5. APP STRUCTURE — 8 VIEWS

### 5.1 Dashboard
At-a-glance overview. Shows YTD income, utilization, days worked, outstanding invoices (from Stint), monthly income bar chart, upcoming bookings, net worth snapshot, estimated monthly cash flow, months of runway.

### 5.2 Utilization & Income
Deep dive into actual work data. Year filter toggle (current/previous year). Stats: total income, utilization %, days worked, average day rate. Monthly breakdown with mini bars. By-client breakdown sorted by income. By-service-type breakdown.

### 5.3 Pipeline
Forward-looking bookings view. Booked days, penciled days, weighted pipeline value (booked 100%, pencil 1 70%, pencil 2 40%, pencil 3 20%), confirmed revenue. Sections: Booked, Penciled, Recent Past.

### 5.4 Invoice Health
Invoice tracking. Outstanding total, overdue amount, awaiting payment, total paid. List sorted by issue_date. Status tags: draft (gray), sent (blue), overdue (red), paid (green).

### 5.5 Financial Planner (Scenario Modeler)
The core financial tool. Has a Freelance / Full-Time toggle at the top (duplicated above Annual View).

**Days to Target calculator (top of planner):**
- Target utilization slider
- Checkboxes: Include bookings, Include pencils
- Shows days worked, days committed, days still needed, days/month of new work needed
- Progress bar: worked (green) + committed (blue) + needed (yellow)
- Uses adjusted available days (260 minus vacation, holidays, sick)

**Scenario Inputs (sliders) — order:**
1. Vacation days (0–40, default 10)
2. Holidays (0–15, default 10)
3. Sick days (0–15, default 5)
4. Monthly expenses ($6k–$14k, default $8,750)
5. Health insurance ($400–$2,400, default $1,600) — adjusts WITHIN expenses, not additive
6. Growth assumptions: equity return (0–15%, default 7%), rollover return (0–15%, default 4%), cash return (0–7%, default 4%)
7. Day rate ($800–$2,000, default from Stint settings or $1,200)
8. Utilization (30–90%, default 50%) with weeks on/off and available days display

Below utilization: "260 weekdays − X vacation − X holidays − X sick = Y available days"

**Full financial picture toggle:** Switches between showing freelance income only vs. including passive income, investment returns, and retirement growth.

**When in Full-Time mode (toggle at top):**
Replace day rate/utilization with: annual salary, 401k contribution %, employer match %, health insurance cost (employer-subsidized), other benefits value. Tax calc changes: no SE tax, only employee FICA (7.65%). Shows comparison panel: full-time vs. freelance side by side.

**Monthly Snapshot cards:** Gross, Taxes, Net Take-Home, Interest Income, Investment Returns, Retirement Growth, Total NW Growth, Expenses, Net Cash Flow.

**Annual View cards:** Gross Annual, Net After Tax, Annual Savings, Retirement Growth, Total NW Growth. (401k + match shown when in full-time mode.)

**Inflation:** Only applied to long-term projections (5-year, rollover comparison, retirement). Monthly/annual snapshot uses nominal returns.

**Scenario Comparison Table:** Current slider values (highlighted) plus presets at various rate/utilization combos.

**5-Year Net Worth Projection:** Year-by-year compounding. Stacked bars: accessible (green) + retirement (purple). Summary cards: NW today, year 5, total growth.

**Rollover IRA Deployment Comparison:** Shows $504k at 4%, 7%, 10%, 12% over 5 years.

**All planner settings persist to IndexedDB.** Reset to defaults button available.

### 5.6 Expenses
Expense modeling with financial impact projections.

**Sections in order:**
1. Income Summary (read-only from Planner)
2. Recurring Expenses (editable list with: name, amount, category, frequency, essential toggle, mute toggle)
3. One-Time Expenses (editable list with: name, amount, category, month, paid toggle, mute toggle)
4. Expense Summary & Impact (totals, cash flow impact, "what if" quick view)
5. Financial Impact — toggle between "One-time impact only" (default) and "Full year projection"
   - One-time impact: shows current balances minus all unpaid one-time expenses, pulling from HYS first
   - Full year: month-by-month simulation including income, recurring, one-time, returns
   - Cards show current → projected with delta arrows
6. Monthly Timeline
7. Category Breakdown

Muted expenses stay in list but are excluded from all calculations.

Pre-populated recurring: Rent $2,300, Health Insurance $1,600, Groceries $1,000, Dining Out $1,000.

Categories: Housing, Insurance, Food, Transportation, Subscriptions, Utilities, Personal, Other.

One-time expenses pull from HYS accounts. Overflow: HYS → Money Market → Checking.

### 5.7 Net Worth Tracker
Mirrors actual Quicken Simplifi account structure.

**Banking:**
- Cash & Checking:
  - Adv Relationship Banking - 9296 (default $1,727)
  - Santander Private Client Checking (default $10,388)
  - Advantage Savings - 9322 (default $36,663) — treated as cash, earns no interest
- Credit:
  - Citi Double Cash Card (default −$2,127)
- Savings:
  - High Yield Savings (default $238,664)
  - Openbank High Yield Savings (default $70,000)
  - Santander Private Client Money Market (default $12,661)

**Investments:**
- Non-retirement:
  - Non-retirement Brokerage (default $479,263)
- Retirement:
  - Traditional IRA (default $141,721)
  - Rollover IRA (default $505,818)
- Other:
  - Health Savings Account (default $8,072)

**Mapping to Planner variables (critical — this is the single source of truth):**
```
checking = advRelationship + santanderChecking + advantageSavings
hys = highYieldSavings + openbankHYS              (earn cash return rate)
moneyMarket = santanderMM                          (earns cash return rate)
brokerage = nonRetirement                          (earns equity return rate)
tradIRA = retirement                               (earns equity return rate)
rolloverIRA = rolloverIRA                          (earns rollover return rate)
hsa = hsa                                          (earns equity return rate)
ccDebt = citiDoubleCash                            (negative)
```

Collapsible sections. Group subtotals. "Last updated" timestamp. Summary cards: total NW, accessible NW, retirement NW. Asset allocation bar. FI progress bar.

Crypto (152 ETH) intentionally excluded.

### 5.8 Retirement Planner
Long-term retirement projection.

**Sliders:**
- Current age (25–65, default 38)
- Retirement age (45–75, default 60)
- Annual IRA contribution (0–$7,000, default $7,000)
- Annual HSA contribution (0–$8,300, default $4,300)
- Expected return pre-retirement (0–15%, default 7%)
- Expected return in retirement (0–10%, default 5%)
- Inflation rate (0–8%, default 3%) — applied as real returns (nominal minus inflation)
- Monthly retirement spending ($3k–$15k, default $8,750)
- Social Security monthly ($0–$4,000, default $0)

**"Include taxable investments" toggle:** When on, adds brokerage to the retirement pool. Excludes checking, HYS, money market. Shows "Not Included" card with excluded asset totals.

**"Not Included" card:** Shows assets not part of the retirement calc (HYS, MM, checking, and brokerage if toggle is off).

**Summary cards (above projection chart):** Years until retirement, total retirement balance today, projected balance at retirement, annual retirement income, years portfolio lasts, safe withdrawal rate.

**Year-by-year chart:** Current age to 95. Green during accumulation, blue during distribution, red if depleted.

**Callouts:** Portfolio depletion warnings. "Portfolio never depletes" if sustainable.

All settings persist to IndexedDB. Reset to defaults button.

---

## 6. DESIGN SYSTEM

**Theme:** Dark
- Background: #0a0c10
- Surface layers: #12151c, #1a1e28, #232938
- Border: #2a3145
- Text primary: #e2e6f0
- Text secondary: #6b7394

**Accent colors:**
- Blue (primary accent): #5b8def
- Green (positive/growth): #34d399
- Red (negative/overdue): #f87171
- Yellow (caution/pending): #fbbf24
- Purple (retirement): #a78bfa
- Cyan (secondary): #22d3ee

**Typography:**
- UI text: clean sans-serif (DM Sans or similar)
- Numbers: monospace everywhere (IBM Plex Mono or DM Mono)
- Section labels: uppercase, 0.68–0.72rem, letter-spacing 0.1em, dim color

**Layout:** Mobile-first responsive. Bottom tab nav on mobile, works on desktop.

**Number formatting:** Monospace, comma-separated, no decimal cents. Negative values use "−" (minus sign, not hyphen).

---

## 7. DATA FLOW

1. On app launch (online): Fetch all Stint tables from Supabase, cache to IndexedDB
2. On app launch (offline): Load Stint data from IndexedDB cache
3. Manual refresh to re-sync Stint data
4. Account balances: Read/write IndexedDB only
5. All financial modeling: Pure client-side computation
6. Settings sync: Push from PC to Supabase `ledger_sync` table, Pull on phone from same table

---

## 8. SETTINGS SYNC

Supabase table `ledger_sync` stores a single JSON blob of all local settings. Workflow:
- PC is source of truth
- "Push" on PC → uploads all IndexedDB settings to Supabase
- "Pull" on phone → downloads from Supabase, overwrites local IndexedDB
- Shows timestamps: last pushed, last pulled, server version

Synced data includes: net worth balances, planner settings, expense model, retirement settings.

---

## 9. PWA CONFIGURATION

```ts
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [{
      urlPattern: /^https:\/\/xxsjfeafpzzcmadyvuue\.supabase\.co/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 86400 }
      }
    }]
  },
  manifest: {
    name: 'Stint Ledger',
    short_name: 'Ledger',
    theme_color: '#0a0c10',
    background_color: '#0a0c10',
    display: 'standalone'
  }
})

// Also requires:
server: { host: '0.0.0.0' }
```

Production build: `npm run build` then `npx serve dist --listen tcp://0.0.0.0:4173`

---

## 10. TAX ESTIMATION LOGIC

### Freelance
```
SE tax: 15.3% on 92.35% of gross
Federal: progressive brackets on (AGI - $15k standard deduction)
  Brackets: 10% up to $11,600 / 12% to $47,150 / 22% to $100,525 / 24% to $191,950 / 32% to $243,725 / 35% to $609,350 / 37% above
NY State: ~7% effective on AGI
```

### Full-Time
```
FICA: 7.65% of gross (employee portion only — no SE tax)
401k reduces taxable income (pre-tax)
Federal: same progressive brackets on (gross - 401k - $15k deduction)
NY State: ~7% on (gross - 401k)
```

---

## 11. KNOWN ISSUES & FIXES

1. **crypto.randomUUID()** — Not available on all mobile browsers. Must use fallback UUID generator (Math.random-based). The fallback must NOT recursively call itself.

2. **IndexedDB empty on new device** — All hooks that read from IndexedDB must handle undefined/missing data gracefully. Default to pre-populated values.

3. **RLS on Supabase** — If tables are recreated, RLS re-enables by default. Must disable again.

4. **Select/dropdown styling** — Native `<select>` elements default to white-on-white in dark theme. Must explicitly style background and text color.

5. **Error boundary** — Top-level ErrorBoundary component in App.tsx catches crashes and shows error + "Go back to Dashboard" button instead of blank screen.

---

## 12. FILE STRUCTURE

```
stint-ledger/
├── public/
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   ├── components/        # StatCard, Panel, Slider, MiniBar, Row, Tag, ErrorBoundary
│   ├── views/
│   │   ├── Dashboard.tsx
│   │   ├── Utilization.tsx
│   │   ├── Pipeline.tsx
│   │   ├── Invoices.tsx
│   │   ├── Planner.tsx
│   │   ├── Expenses.tsx
│   │   ├── NetWorth.tsx
│   │   └── Retirement.tsx
│   ├── hooks/
│   │   ├── useStintData.ts       # Fetches + caches Stint data from Supabase
│   │   ├── useExpenseModel.ts    # Expense state + IndexedDB persistence
│   │   ├── usePlannerSettings.ts # Planner slider state + persistence
│   │   ├── useNetWorth.ts        # Account balances + persistence
│   │   ├── useRetirementSettings.ts
│   │   └── useSettingsSync.ts    # Push/pull to Supabase ledger_sync
│   ├── lib/
│   │   ├── supabase.ts    # Supabase client
│   │   ├── storage.ts     # IndexedDB helpers
│   │   ├── tax.ts         # Tax estimation (freelance + full-time)
│   │   └── helpers.ts     # fmt(), daysBetween(), uuid(), etc.
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env
├── .gitignore
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 13. GIT CONFIGURATION

```
git config --global user.email "shopping@chrisbernier.com"
git config --global user.name "Chris"
```

.gitignore must include: node_modules, dist, .env, .env.local, *.local

---

## 14. REBUILD FROM SCRATCH — CLAUDE CODE PROMPT

Copy everything below this line and paste it into Claude Code as a single prompt to rebuild the entire app:

---

**Build a PWA called "Stint Ledger" — a personal financial dashboard for a freelance Creative Director.**

**Read the file `STINT_LEDGER_DISASTER_RECOVERY.md` in this directory for the complete specification.** It contains:

- Full tech stack and dependencies
- Supabase connection details and schema
- All 8 views with detailed specifications
- Design system (dark theme, color palette, typography)
- Data flow and sync architecture
- Tax estimation logic
- Known issues to avoid
- File structure

**Build order:**

1. Scaffold Vite + React + TypeScript project
2. Install dependencies: @supabase/supabase-js, tailwindcss, vite-plugin-pwa, idb/localforage
3. Set up .env with Supabase credentials
4. Configure vite.config.ts (PWA plugin, server host 0.0.0.0)
5. Set up Tailwind with dark theme colors
6. Build lib layer: supabase client, IndexedDB helpers, tax estimation, formatting utils
7. Build hooks: useStintData, useNetWorth, usePlannerSettings, useExpenseModel, useRetirementSettings, useSettingsSync
8. Build shared components: StatCard, Panel, Slider, MiniBar, Row, Tag, ErrorBoundary
9. Build views in order: Dashboard, Utilization, Pipeline, Invoices, Planner, Expenses, NetWorth, Retirement
10. Build App.tsx with navigation and ErrorBoundary wrapper
11. Test on desktop, then test on mobile via LAN (192.168.29.152)
12. Production build and PWA verification

**Critical implementation notes:**
- uuid() must have a safe fallback (no crypto.randomUUID dependency) — use Math.random template replacement
- All IndexedDB reads must handle undefined/missing data with defaults
- Health insurance slider adjusts WITHIN total expenses, not additive
- Utilization based on weekdays only (260/year, 22/month)
- Inflation only applied to 5-year projection and retirement, not monthly/annual snapshot
- Net Worth account structure mirrors Quicken Simplifi (see spec for exact accounts)
- Advantage Savings treated as checking (no interest)
- One-time expenses pull from HYS first, overflow to MM then checking
- Settings sync: push from PC to Supabase ledger_sync table, pull on phone
- All select/dropdown elements must be styled for dark theme (no white-on-white)
- Top-level ErrorBoundary required — shows error message instead of blank screen

**After building, run the Supabase SQL to create the ledger_sync table and disable RLS on all tables (see spec).**

---

# Stint Ledger — Session Doc — 2026-03-24

## Session Type
Feature build / Architecture planning / Financial analysis

This was a large foundational session. Stint Ledger was conceived, specified, built via Claude Code, iterated through multiple feature rounds, debugged on mobile, documented, and backed up to GitHub — all in one session.

---

## What Was Built, Changed, or Decided

### Financial Assessment (pre-app)
- Conducted a full personal financial assessment based on self-reported data
- Mapped all accounts, income, expenses, and calculated net worth (~$1.5M excl. crypto)
- Built an interactive HTML scenario planner (standalone file, later superseded by the app)
- Identified key financial insights: cash-heavy allocation, break-even freelance cash flow, rate likely below market ($1,200/day vs. $1,400-$1,600 market rate for NYC freelance CDs)

### Stint Ledger — App Creation
- Designed and specified the full app architecture across 8 views
- App was built by Claude Code from specs provided in this chat session
- Tech stack: React + TypeScript + Vite + Tailwind + Supabase + vite-plugin-pwa + IndexedDB

### Views Built (8 total)
1. **Dashboard** — YTD income, utilization, days worked, outstanding invoices, monthly income bars, upcoming bookings, net worth snapshot
2. **Utilization & Income** — year filter, monthly breakdown, by-client, by-service-type, rate analysis
3. **Pipeline** — booked/penciled days, weighted pipeline value (0=100%, 1=70%, 2=40%, 3=20%), confirmed revenue
4. **Invoice Health** — outstanding, overdue, awaiting, paid totals, invoice list with status tags
5. **Financial Planner** — the core tool with:
   - Days to Target calculator with bookings/pencils checkboxes
   - Scenario inputs: vacation/holidays/sick days, expenses, health insurance (within expenses), growth assumptions, day rate, utilization
   - Available days display (260 minus time off)
   - Weeks on/off/months worked display
   - Freelance vs. Full-Time toggle (duplicated above Annual View)
   - Full financial picture toggle (income only vs. including passive/investment/retirement)
   - Monthly Snapshot cards (gross, taxes, net, interest, investment returns, retirement growth, total NW growth, expenses, cash flow)
   - Annual View cards
   - Scenario Comparison Table with presets
   - 5-Year Net Worth Projection (stacked accessible + retirement)
   - Rollover IRA Deployment Comparison
   - Save/load/compare named scenario snapshots (includes full expense model)
6. **Expenses** — recurring + one-time expenses, mute toggle, drag-to-reorder recurring, financial impact projections (one-time impact only vs. full year), monthly timeline, category breakdown
7. **Net Worth** — mirrors Quicken Simplifi account structure with individual accounts, collapsible sections, group subtotals, asset allocation bar, FI progress, last updated timestamp
8. **Retirement** — age/contribution/return/inflation/spending/SS sliders, include taxable investments toggle, "not included" card, year-by-year projection chart to age 95, depletion warnings

### Key Features Built
- **Supabase integration** — reads all Stint tables (clients, projects, time entries, pencils, invoices, settings)
- **Settings sync** — push/pull via Supabase `ledger_sync` table, PC is source of truth
- **PWA** — installable, offline-capable via service worker, works on phone when PC is off
- **LAN access** — Vite server exposed on 0.0.0.0, accessible at 192.168.29.152
- **Inflation handling** — only applied to 5-year projection and retirement, not monthly/annual snapshot (nominal returns for short-term)
- **Full-Time mode** — salary, 401k, employer match, subsidized health insurance, FICA-only tax calc, side-by-side comparison vs. freelance
- **Scenario snapshots** — save named scenarios (all planner settings + full expense model), load, compare up to 3 side by side with income-only and full-picture savings rows

### Key Decisions Made
- Crypto (152 ETH) excluded from all financial tracking
- Taxes excluded from initial assessment (to be addressed separately)
- Health insurance is included within monthly expenses, not additive
- Utilization based on weekdays only (260/year, 22/month)
- Advantage Savings account treated as checking (negligible interest)
- One-time expenses pull from HYS first, overflow to MM then checking
- PC is source of truth for settings; phone is for exploration
- App runs on local network only, not deployed to Vercel
- Dark theme maintained (light theme attempted and reverted)
- QBI deduction identified as applicable but not yet modeled in tax calc

---

## Diagnostic Findings

### crypto.randomUUID() crash on mobile
- **Root cause:** `crypto.randomUUID()` is not available in all mobile browser contexts (requires secure context + iOS 15.4+ / Chrome 92+)
- **Fix:** Replaced with Math.random-based UUID fallback. Critical: fallback must NOT recursively call itself (this happened and caused "Maximum call stack size exceeded")

### Expenses tab blank on mobile
- **Root cause:** `useExpenseModel` hook blindly cast IndexedDB data without validating arrays. On fresh device with no data, `model.recurring.filter()` threw TypeError, crashing the React tree silently
- **Fix:** Defensive merge with array validation, fallback to default expenses. Added top-level ErrorBoundary in App.tsx

### uuid() infinite recursion
- **Root cause:** The Math.random fallback function was named `uuid()` and called itself instead of generating a UUID
- **Fix:** Replaced with proper template-based UUID v4 generator

### Select dropdowns invisible in dark theme
- **Root cause:** Native `<select>` elements default to white text on white background
- **Fix:** Explicit dark theme styling on all select/option elements

### Stint data not loading after Stint rewrite
- **Root cause:** Stint app was rewritten with new sync model. RLS may have been re-enabled on recreated tables
- **Fix:** Re-ran `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` on all Stint tables

### Inflation applied to monthly snapshot
- **Root cause:** Inflation was reducing nominal returns everywhere, making monthly interest income look wrong ($290 instead of $1,000)
- **Decision:** Inflation only applies to 5-year projection and retirement planner. Monthly/annual uses nominal returns.

---

## Migrations / External Setup Steps Run

### Supabase SQL
```sql
CREATE TABLE ledger_sync (
  id text primary key default 'default',
  data jsonb not null,
  updated_at timestamp with time zone default now()
);

ALTER TABLE stint_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_pencils DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE stint_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_sync DISABLE ROW LEVEL SECURITY;
```

### Git setup
```
git config --global user.email "shopping@chrisbernier.com"
git config --global user.name "Chris"
```

### GitHub
- Created private repo: https://github.com/homer31383/stint-ledger
- Also created repos for: stint, axiom-tasks, pulse, the-kristory (all private)

### Vite config
- Added `server: { host: '0.0.0.0' }` for LAN access

---

## Commits Made
- `7d8c546` — pre-restyle: dark theme baseline (root commit, 75 files)
- `b1f8ba8` — CLAUDE.md + disaster recovery docs
- Final commit — updated disaster recovery docs after all features built
- Light theme attempted and reverted via git checkout

---

## Files Created in This Chat (outside the repo)
- `financial_assessment.html` — initial standalone financial assessment
- `freelance_scenario_planner.html` — interactive scenario planner (standalone)
- `STINT_LEDGER_BRIEF.md` — original project brief for Claude Code
- `STINT_LEDGER_DOCUMENTATION.md` — full project documentation
- `STINT_LEDGER_REBUILD_PROMPT.md` — rebuild prompt for Claude Code
- `STINT_LEDGER_DISASTER_RECOVERY.md` — combined disaster recovery doc

# Stint Ledger — Rebuild Prompt — 2026-03-24

## What This App Is
Stint Ledger is a personal financial dashboard PWA for a freelance Creative Director based in Brooklyn, NY. It's a companion to the Stint app (freelance time tracking, bookings, invoicing). Stint tracks the work; Ledger tracks the money. Single user, runs on local network only (not deployed publicly). Built with React + TypeScript + Vite + Tailwind + Supabase + IndexedDB + vite-plugin-pwa.

## Current State of All Features

### Fully Built and Working
- **Dashboard:** YTD income, utilization, days worked, outstanding invoices, monthly income bars, upcoming bookings, net worth snapshot, cash flow, runway
- **Utilization & Income:** Year filter, monthly breakdown, by-client, by-service-type, rate analysis
- **Pipeline:** Booked/penciled days, weighted pipeline (0=100%, 1=70%, 2=40%, 3=20%), confirmed revenue
- **Invoice Health:** Outstanding/overdue/awaiting/paid, invoice list with status tags
- **Financial Planner:** Days to Target (with bookings/pencils checkboxes), scenario inputs (vacation/holidays/sick/expenses/health insurance/growth rates/day rate/utilization), Freelance vs. Full-Time toggle, full financial picture toggle, Monthly Snapshot, Annual View, scenario comparison table, 5-year projection, rollover IRA comparison, save/load/compare named scenarios (includes full expense model)
- **Expenses:** Recurring + one-time, mute toggle, drag-to-reorder recurring, financial impact (one-time only vs. full year projection), monthly timeline, category breakdown
- **Net Worth:** Mirrors Simplifi account structure (individual accounts, collapsible sections, subtotals, asset allocation bar, FI progress, last updated timestamp)
- **Retirement:** All sliders (age, contributions, returns, inflation, spending, SS), include taxable investments toggle, "not included" card, year-by-year chart to 95, depletion warnings
- **Settings Sync:** Push/pull via Supabase ledger_sync table
- **PWA:** Installable, offline-capable, works on phone when PC is off
- **Error Boundary:** Catches crashes, shows error message + recovery button
- **Documentation:** CLAUDE.md, disaster recovery docs, rebuild prompt, all in repo and pushed to GitHub

### Working But With Known Limitations
- Tax estimation is simplified (no QBI deduction, no NYC city tax, flat 7% NY state instead of progressive)
- Inflation only applied to long-term projections, not monthly/annual
- No automatic sync between devices (manual push/pull only)

---

## Immediate Next Tasks (Not Yet Built)

### 1. QBI Deduction in Tax Model
The current tax estimator doesn't include the 20% QBI deduction. User qualifies as a Schedule C freelancer. Needs to be added to the freelance tax calculation:
- QBI = net freelance income (gross minus business deductions)
- Deduction = 20% of QBI
- Reduces taxable income (below the line, doesn't affect AGI)
- Phase-out applies: 2026 threshold starts at $75k single / $150k joint
- Potentially SSTB concern (creative direction) but likely does not apply
- Should be a toggle in the planner: "Include QBI deduction" (default on)

### 2. Tax Reserve Tracker
New view or section showing:
- Estimated quarterly tax payments based on actual YTD income from Stint
- How much should have been set aside so far
- When next quarterly payment is due
- Warning if behind on reserves

### 3. Income Goal Tracker
Set an annual income target, see live progress bar combining actual YTD from Stint + pipeline projections.

### 4. Client Concentration View
Pie/bar showing % of income from each client. Flag if one client is >70%.

### 5. Baby Budget Modeling
October 2026 due date. Model expense increases (childcare, health insurance change, reduced utilization) and impact on runway.

### 6. Production Build for Phone
PWA production build hasn't been fully tested. Need to:
- Run `npm run build`
- Serve dist on LAN
- Install on phone as home screen app
- Verify service worker caching works
- Verify icon shows correctly (was showing "A" instead of "L")

---

## Key Architectural Rules

1. **Net Worth is the single source of truth** for all account balances. Planner and Retirement views read from Net Worth data in IndexedDB, never store their own copy.

2. **Account mapping is critical:**
   ```
   checking = advRelationship + santanderChecking + advantageSavings (no interest)
   hys = highYieldSavings + openbankHYS (earn cash return rate)
   moneyMarket = santanderMM (earns cash return rate)
   brokerage = nonRetirement (earns equity return rate)
   tradIRA = retirement (earns equity return rate)
   rolloverIRA = rolloverIRA (earns rollover return rate)
   hsa = hsa (earns equity return rate)
   ccDebt = citiDoubleCash (negative)
   ```

3. **Health insurance adjusts WITHIN total expenses**, not additive. Baseline is $1,600 included in the $8,750 default.

4. **Utilization = weekdays only.** 260/year, 22/month. No weekends ever.

5. **Inflation only applied to 5-year projection and retirement.** Monthly/annual snapshot uses nominal returns. This was a deliberate decision after confusion about HYS interest showing $290 instead of $1,000.

6. **uuid() must use Math.random fallback.** Never depend on crypto.randomUUID(). Fallback must NOT be recursive.

7. **All IndexedDB reads must handle undefined/missing data.** Default to pre-populated values. This is the #1 cause of mobile crashes.

8. **All select/dropdown elements must be styled for dark theme.** Native elements default to white-on-white.

9. **Top-level ErrorBoundary is required.** Without it, any component crash blanks the entire app with no recovery.

10. **Supabase is read-only for Stint data.** Ledger only writes to `ledger_sync`. If Stint tables are recreated, RLS must be re-disabled.

11. **PC is source of truth for settings.** Phone is for exploration. Push from PC, pull on phone.

12. **Saved scenarios include the full expense model** (all recurring + one-time items with mute states), not just totals.

---

## Active Bugs

### PWA Icon Shows Wrong Letter
- **Symptom:** Phone home screen shows "A" instead of "L" for Stint Ledger
- **Diagnosis:** Either icon wasn't generated correctly, or `<link rel="apple-touch-icon">` missing from index.html
- **Fix path:** Verify icon-192.png and icon-512.png show "L", add apple-touch-icon link, rebuild, delete old home screen shortcut and re-add

### Days to Target / Utilization Slider Disappeared
- **Symptom:** After scenario save/compare was added, the Days to Target section and utilization slider in Scenario Inputs went missing
- **Diagnosis:** Likely overwritten during the scenario feature implementation
- **Fix path:** A prompt was provided to Claude Code to restore both sections. Verify they're present. If not, the Planner view order should be: Days to Target → Saved Scenarios → Scenario Inputs (ending with day rate + utilization) → toggles → Monthly Snapshot → Annual View → Summary → Compare → Scenario Table → 5-Year → Rollover

---

## Context That Lives Outside the Codebase

### Financial Context
- User's day rate ($1,200) is below market for his experience level. NYC freelance CD sweet spot is $1,400-$1,600/day. This is relevant to default slider values and scenario presets.
- $504k rollover IRA sitting in 4% HYS is the single biggest financial decision pending. User is waiting for S&P 500 10% correction (trigger: 6,239) before deploying into 55% FXAIX / 25% FSKAX / 20% FZILX.
- Baby expected October 2026. Financial modeling should account for this.
- 152 ETH ($50k cost basis, ~$283k current) intentionally excluded from all calculations.
- Rent-stabilized apartment at $2,300/month is a significant hidden asset.

### Design Context
- Light theme was attempted (matching Stint app's warm cream aesthetic) and reverted. User preferred the dark theme for a financial dashboard.
- PWA icon should be dark circle with white serif "L" matching the Stint "S" icon style.

### Technical Context
- Stint app was recently rewritten with a simplified sync model (full table fetch + replace, no diff-based push). This broke Stint Ledger's data connection temporarily — fixed by re-disabling RLS.
- The app shares a Supabase instance with Stint, Axiom Tasks, The Kristory, and Prep2Print. All use table prefixes for isolation.
- Local network IP is 192.168.29.152. Dev server port varies (5173 or 5174).

### Process Context
- All specs/prompts for Claude Code were written in this Claude chat and handed over manually.
- Claude Code hit context limits during the session — `/compact` failed, had to `/clear` and re-provide context.
- Disaster recovery docs were created for all 5 projects (Stint, Stint Ledger, Axiom Tasks, Pulse, The Kristory) and pushed to private GitHub repos under homer31383.

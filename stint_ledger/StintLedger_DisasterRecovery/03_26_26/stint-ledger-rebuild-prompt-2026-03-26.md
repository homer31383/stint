# Stint Ledger — Rebuild Prompt — 2026-03-26

## What This App Is
Stint Ledger is a personal financial dashboard PWA for a freelance Creative Director based in Brooklyn, NY. Companion to the Stint app (freelance time tracking, bookings, invoicing). Stint tracks the work; Ledger tracks the money. Built with React + TypeScript + Vite + Tailwind + Supabase + IndexedDB + vite-plugin-pwa. Deployed to Vercel (temporarily) and also runs on local network.

## Current State of All Features

### Authentication (NEW this session)
- Supabase Auth with email/password login
- Login screen shown when no active session
- Sign out button in navigation sidebar
- No signup — account managed manually in Supabase dashboard
- User: `chris@chrisbernier.com`
- RLS enabled on all tables with `TO authenticated` policies
- Session persists across page refreshes (Supabase handles automatically)

### Deployment
- Live at https://stint-ledger.vercel.app (temporary — take down after weekend demo)
- Also runs locally at http://192.168.29.152:5173 (dev) or :4173 (production build)
- Take down with: `vercel rm stint-ledger` or delete from Vercel dashboard

### All Previously Built Features (still working)
- **Dashboard:** YTD income, utilization, days worked, outstanding invoices, monthly income bars, upcoming bookings, net worth snapshot
- **Utilization & Income:** Year filter, monthly breakdown, by-client, by-service-type
- **Pipeline:** Booked/penciled days, weighted pipeline value, confirmed revenue
- **Invoice Health:** Outstanding/overdue/awaiting/paid, invoice list with status tags
- **Financial Planner:** Days to Target (with bookings/pencils checkboxes), scenario inputs, Freelance vs. Full-Time toggle, full financial picture toggle, Monthly/Annual Snapshots, scenario comparison table, 5-year projection, rollover IRA comparison, save/load/compare named scenarios
- **Expenses:** Recurring + one-time, mute toggle, drag-to-reorder, financial impact projections
- **Net Worth:** Mirrors Simplifi account structure, individual accounts, collapsible sections
- **Retirement:** Full projection with inflation, include taxable investments toggle
- **Settings Sync:** Push/pull via Supabase ledger_sync table — works from any device, last push wins
- **PWA:** Installable, offline-capable
- **Error Boundary:** Catches crashes with recovery button

---

## Immediate Next Tasks

### 1. Take Down Vercel Deployment (after weekend)
Run `vercel rm stint-ledger` or delete from Vercel dashboard. This is a temporary deployment for a demo.

### 2. PWA Icon Fix
Phone shows "A" instead of "L". Need to:
- Verify icon-192.png and icon-512.png show correct "L" (dark circle, white serif letter matching Stint "S" icon)
- Add `<link rel="apple-touch-icon" href="/icon-192.png">` to index.html
- Rebuild and re-add to home screen (delete old shortcut first)

### 3. Verify Days to Target / Utilization Slider
These sections may have been lost when scenario save/compare was added in previous session. Verify they're present in Planner view.

### 4. QBI Deduction in Tax Model
Add 20% QBI deduction to freelance tax calculation. User qualifies as Schedule C freelancer. Should be a toggle: "Include QBI deduction" (default on). Phase-out starts at $75k single / $150k joint for 2026.

### 5. Production Build for Phone
Get PWA properly cached on phone for offline use independent of PC.

### 6. Future Features (not urgent)
- Tax reserve tracker
- Income goal tracker
- Client concentration view
- Baby budget modeling (October 2026)

---

## Key Architectural Rules

1. **Supabase Auth required.** All tables have RLS with `TO authenticated` policies. No anon access.
2. **Net Worth is single source of truth** for account balances. Planner and Retirement read from Net Worth IndexedDB.
3. **Account mapping:**
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
4. **Health insurance adjusts WITHIN expenses**, not additive.
5. **Utilization = weekdays only.** 260/year, 22/month.
6. **Inflation only for long-term projections** (5-year, retirement). Monthly/annual uses nominal.
7. **uuid() must use Math.random fallback.** Never recursive.
8. **All IndexedDB reads must handle undefined.** Default to pre-populated values.
9. **Use `.maybeSingle()` not `.single()`** for Supabase queries that might return no rows.
10. **All select elements styled for dark theme.**
11. **Top-level ErrorBoundary required.**
12. **Saved scenarios include full expense model** (all items with mute states).
13. **Settings sync: any device can push/pull.** Last push wins. No auto-sync.

---

## Active Bugs

### PWA Icon Wrong
- **Symptom:** Phone shows "A" instead of "L"
- **Fix:** Verify PNGs, add apple-touch-icon link, rebuild, re-add to home screen

### Days to Target / Utilization Slider Possibly Missing
- **Symptom:** May have been removed when scenario save/compare was added
- **Fix:** Check Planner view, restore if missing (see session doc from 2026-03-24 for correct section order)

---

## Context Outside the Codebase

### Authentication
- Uses existing Supabase Auth user `chris@chrisbernier.com` — same account as Axiom Tasks
- Signup is disabled in Supabase dashboard. New users must be created manually.
- The Stint app also uses Supabase Auth with the same user, so `TO authenticated` RLS policies work for both apps.

### Deployment
- Vercel deployment is TEMPORARY for weekend demo. Should be taken down after.
- Vercel project is at homer31383s-projects/stint-ledger
- Environment variables are set in Vercel dashboard (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)

### Settings Sync
- Push/pull works from any device — not restricted to PC despite earlier "PC is source of truth" recommendation
- Last push wins — no conflict resolution, just overwrites
- User is happy with manual sync, does not want auto-sync

### Supabase Gotcha
- `.single()` returns 406 error when no row exists. Always use `.maybeSingle()` for queries that might return empty results (especially ledger_sync on fresh deployments/devices).
- Data fetch hooks must wait for auth session to be established before querying. Otherwise requests go out as anon and get blocked by RLS.

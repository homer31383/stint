# Stint Ledger — Rebuild Prompt for Claude Code

Use this prompt if you need to rebuild full context in a new Claude Code session. Paste the entire contents of this file.

---

## What This Is

Stint Ledger is a personal financial dashboard PWA for a freelance Creative Director (Chris Bernier). It reads booking/income data from Supabase (populated by a separate Stint time-tracking app) and combines it with manually-entered account balances stored in IndexedDB. It provides financial modeling across 8 views. Runs on a home LAN, installable on desktop and mobile, works offline. Single user — no multi-tenancy.

## Stack
- React 18.3 + TypeScript 5.5 (strict mode)
- Vite 5.4 with vite-plugin-pwa 0.20
- Tailwind CSS 3.4 with custom dark theme (surface-0..3, accent, positive, negative, caution, retirement, highlight)
- @supabase/supabase-js 2.45 (read-only from stint_* tables, read-write for ledger_sync)
- Supabase Auth (email/password, single user, no signup)
- IndexedDB via `idb` 8.0
- Recharts 2.12 (dependency exists, views use custom bars)
- IBM Plex Sans (UI) + IBM Plex Mono (numbers) from Google Fonts
- No routing library — simple state-based view switching in App.tsx

## GitHub
- Repo: `homer31383/stint-ledger` (private)
- Branch: `main`
- Remote: `https://github.com/homer31383/stint-ledger.git`

## Current Feature Status (all working)

### Auth (added March 26, 2026)
- Login screen: full-screen dark themed, email + password, error display
- Auth state: `getSession()` on mount + `onAuthStateChange()` listener in App.tsx
- Auth gate: no session = Login screen, session = full app
- Sign out button in desktop sidebar
- Session persistence handled by Supabase JS client (localStorage)
- Single user created manually in Supabase Dashboard
- RLS enabled on all tables with `TO authenticated` policies

### 8 Views (all functional)
1. **Dashboard** — YTD income, utilization, invoices, bookings, NW snapshot, runway
2. **Utilization** — Year selector, monthly/client/service breakdowns
3. **Pipeline** — Weighted pipeline (booked 100%, pencil 70%/40%/20%), deal lists
4. **Invoices** — Status breakdown, sorted list, outstanding/overdue totals
5. **Planner** — Days-to-target, scenario modeler with save/load/compare, freelance+FT modes, 5-year projection, rollover IRA deployment table
6. **Expenses** — Drag-to-reorder recurring (desktop DnD + mobile touch), mute toggle, financial impact simulation with account cascade
7. **Net Worth** — Per-account editing, asset allocation, FI progress, liquid runway
8. **Retirement** — Age-to-95 projection, accumulation/distribution/depletion phases, safe withdrawal rate

### Settings Sync (working)
- PC pushes all local settings to Supabase `ledger_sync` table
- Phone pulls and reloads
- Syncs: plannerSettings, retirementSettings, expenseModel, detailedBalances, savedScenarios

### PWA (working)
- Installable on desktop and mobile
- Offline-capable via Workbox service worker
- Supabase API cached with NetworkFirst strategy

## Architecture

```
App.tsx
  ├── Auth gate (getSession + onAuthStateChange)
  │   └── No session → <Login />
  │   └── Session → <ErrorBoundary> + <Navigation> + <ViewRouter>
  ├── useStintData → fetches Supabase → caches IDB → returns data
  ├── useAccountBalances → loads from IDB → computes aggregates
  └── useSettingsSync → push/pull to ledger_sync (checks auth before querying)

Views receive (data, balances) as props from App.tsx
Views use local hooks (usePlannerSettings, useExpenseModel, etc.) with IDB persistence
```

## Key Architectural Rules (NEVER violate)
1. **Single Supabase client instance** in `src/lib/supabase.ts` — never recreate per request
2. **`uuid()` function** in useExpenseModel.ts and useSavedScenarios.ts must feature-detect `crypto.randomUUID` and fall back to Math.random. NEVER use `replace_all` on `crypto.randomUUID`.
3. **ErrorBoundary** must wrap all views in App.tsx — without it, crashes blank the screen
4. **`.maybeSingle()`** not `.single()` for queries that may return zero rows (prevents 406)
5. **Auth gate at render level** in App.tsx — hooks still run unconditionally (React rules of hooks)
6. **PostgrestError is a plain object** — always check `.message` property, never rely on `instanceof Error`
7. **All IDB reads can return null** — every hook must initialize with defaults and merge

## Supabase Instance
- Shared with Stint app and Axiom (separate tables)
- Stint tables: `stint_clients`, `stint_projects`, `stint_time_entries`, `stint_pencils`, `stint_invoices`, `stint_settings`
- Ledger table: `ledger_sync`
- RLS: enabled on all tables, `TO authenticated` policies
- Both Stint and Stint Ledger use Supabase Auth with same user account
- Axiom uses different tables, unaffected by stint RLS policies

## Account Mapping (DetailedBalances → AccountBalances)
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

## What's NOT Done / Open Items
1. **Vercel deployment** — discussed but not completed. Need to run `vercel` interactively, set env vars, deploy with `vercel --prod`
2. **RLS SQL not yet run** — the SQL to enable RLS and create authenticated policies needs to be run in Supabase SQL Editor (see STINT_LEDGER_DISASTER_RECOVERY.md for the exact SQL)
3. **Supabase Auth user not yet created** — need to create `shopping@chrisbernier.com` in Supabase Dashboard with email auth enabled, signup disabled, email confirm disabled
4. **Mobile sign out** — sign out button only added to desktop sidebar, not mobile sync bar (low priority, can sign out via desktop)

## Bugs / Known Issues
- **406 on ledger_sync (FIXED)** — was caused by `.single()` returning 406 when no row exists. Fixed by switching to `.maybeSingle()` and gating the mount-time query behind `getSession()` check.
- **PWA cache staleness** — after code changes, service worker may serve old assets. Use Ctrl+Shift+R or unregister SW in DevTools.

## Context From Chat (not in code)
- Stint app already has its own auth system (login screen, signInWithPassword, signUp, signOut) using the same Supabase instance
- Axiom does NOT have auth yet — uses anon access on completely separate tables
- The decision to use `TO authenticated` (not `TO anon`) for RLS was made because both Stint and Stint Ledger authenticate users
- Chris prefers simple, direct solutions — avoid over-engineering
- No Co-Authored-By lines in commits (user preference for the Stint repo, may apply here too)

## Immediate Next Tasks
1. Run RLS SQL in Supabase Dashboard
2. Create auth user in Supabase Dashboard
3. Test login flow end-to-end
4. Deploy to Vercel (`vercel --prod` with env vars)
5. Test on mobile PWA after deployment

## Starting a Session
Read CLAUDE.md first for full project context. Run `npm run dev` to start the dev server. The app is at http://localhost:5173. Type check with `npx tsc --noEmit`.

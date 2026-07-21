# Stint Ledger — Session Doc — 2026-03-26

## Session Type
Feature build (authentication) / Deployment / Debugging

---

## What Was Built, Changed, or Decided

### Supabase Auth Integration
- Added real authentication using Supabase Auth (email/password login)
- Created Login.tsx component — full-screen dark-themed login form
- Updated App.tsx with auth state management via `getSession()` and `onAuthStateChange()` listener
- Added "Sign out" button to Navigation component
- No signup flow — account created manually in Supabase dashboard
- Uses existing user account: `chris@chrisbernier.com`

### RLS Policy Updates
- Re-enabled Row Level Security on all Stint tables and ledger_sync
- Created `TO authenticated` read policies on all stint_ tables
- Created `TO authenticated` read/write policy on ledger_sync
- Dropped old "Allow anon read" policies
- Confirmed Stint app also uses auth, so no anon policies needed

### Vercel Deployment
- Deployed to https://stint-ledger.vercel.app
- Set environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- App is publicly accessible but requires Supabase Auth login
- Intended as temporary deployment for a weekend demo — can be taken down with `vercel rm stint-ledger`

### Bug Fix: 406 Error on ledger_sync
- Supabase requests to ledger_sync returning 406 status
- Root cause: `.single()` throws 406 when no row exists in the table
- Fix: Changed `.single()` to `.maybeSingle()` in both places (returns null gracefully)
- Also fixed: mount-time fetch now waits for active auth session before querying

### PWA Icon Discussion
- Stint Ledger icon should match Stint icon style (dark circle, white serif letter)
- Stint uses "S", Ledger should use "L"
- Phone was showing "A" instead of "L" — needs apple-touch-icon in index.html
- Spec provided to Claude Code but fix may not be fully verified yet

### Decisions Made
- Chose Supabase Auth over simple password gate for real security
- Push/Pull sync works from any device (not just PC) — last push wins
- Settings sync stays manual (auto-sync was discussed but user prefers manual control)
- Deployment is temporary for weekend demo

---

## Diagnostic Findings

### 406 Error on Supabase Queries
- **Root cause:** `.single()` method on Supabase queries returns a 406 HTTP error when no matching row exists. The `ledger_sync` table had no row for a fresh deployment.
- **Fix:** Replace `.single()` with `.maybeSingle()` which returns null instead of erroring.
- **Secondary issue:** Data fetch was firing before auth session was established, causing requests to go out as anon and get blocked by RLS.
- **Fix:** Mount-time fetch now waits for active auth session.

### Stint Data Not Loading After Auth
- **Root cause:** RLS was enabled but the app needed authenticated requests. The Supabase JS client automatically attaches auth tokens when a session exists, but queries were firing before login completed.
- **Fix:** Ensured data fetching happens after auth state is confirmed.

---

## Files Changed

### New Files
- `src/components/Login.tsx` — Full-screen login form with email/password, error handling

### Modified Files
- `src/App.tsx` — Added auth state management, shows Login when no session, passes onSignOut to Navigation
- `src/components/Navigation.tsx` — Added "Sign out" button to desktop sidebar
- `src/hooks/useSettingsSync.ts` — Changed `.single()` to `.maybeSingle()`, added auth session check before queries
- `.vercel/` directory created (added to .gitignore)

---

## Migrations / External Setup Steps

### Supabase Dashboard
1. Authentication → Providers → Email — enabled, disabled "Confirm email", disabled "Enable signup"
2. Used existing user account `chris@chrisbernier.com` (created previously for Axiom Tasks)

### Supabase SQL Editor
```sql
-- Re-enable RLS
ALTER TABLE stint_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE stint_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE stint_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE stint_pencils ENABLE ROW LEVEL SECURITY;
ALTER TABLE stint_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stint_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_sync ENABLE ROW LEVEL SECURITY;

-- Authenticated read policies
CREATE POLICY "Authenticated read" ON stint_clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON stint_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON stint_time_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON stint_pencils FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON stint_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON stint_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read/write" ON ledger_sync FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Vercel Setup
```bash
cd D:\AI\Claude\TimeSheet\stint_ledger
vercel --prod
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel --prod  # redeploy with env vars
```

### Vercel Environment Variables
- `VITE_SUPABASE_URL` = `https://xxsjfeafpzzcmadyvuue.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = (full JWT token)

---

## Commits Made
- Auth implementation + login screen
- .maybeSingle() fix for 406 error
- Vercel deployment config
- (Exact commit hashes from Claude Code session — check git log)

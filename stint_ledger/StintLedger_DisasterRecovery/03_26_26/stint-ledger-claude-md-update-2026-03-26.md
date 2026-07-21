# Prompt to Update CLAUDE.md — 2026-03-26

Hand this to Claude Code in the stint-ledger project:

---

**Update CLAUDE.md with the following context from today's session that you wouldn't know from reading the code alone:**

1. **Supabase Auth is now required.** The app uses Supabase Auth with email/password login. The user account is `chris@chrisbernier.com` (same account used by Axiom Tasks). Signup is disabled in the Supabase dashboard — new users must be created manually under Authentication → Users. No anon access is allowed.

2. **RLS is enabled on all tables** with `TO authenticated` policies. If you ever need to add a new table that Stint Ledger reads or writes, you must create an authenticated policy for it. The old pattern of disabling RLS is no longer used.

3. **`.maybeSingle()` not `.single()`** — This is a critical Supabase gotcha. `.single()` returns a 406 HTTP error when no row exists. `.maybeSingle()` returns null gracefully. This was the cause of a production bug on the Vercel deployment. Always use `.maybeSingle()` for any query that might return zero rows (especially `ledger_sync` on fresh devices).

4. **Data fetch hooks must wait for auth session.** On app load, the auth session takes a moment to establish. If `useStintData` or `useSettingsSync` fire queries before the session exists, the requests go out as anon and get blocked by RLS. The fix was to check for an active session before querying.

5. **The app is deployed to Vercel** at https://stint-ledger.vercel.app. This is a TEMPORARY deployment for a weekend demo. It should be taken down after with `vercel rm stint-ledger` or by deleting the project from the Vercel dashboard. Environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are set in the Vercel dashboard.

6. **Settings sync works from any device.** The earlier documentation may say "PC is source of truth" but in practice push/pull works from any logged-in device. Last push wins, no conflict resolution. User is happy with manual sync and does not want auto-sync.

7. **The Stint app uses the same Supabase Auth.** Both Stint and Stint Ledger share the same Supabase instance and the same user account. The `TO authenticated` RLS policies work for both apps. No anon fallback policies are needed.

8. **Vercel deployment commands** (for reference in docs):
   ```bash
   cd D:\AI\Claude\TimeSheet\stint_ledger
   vercel --prod                                    # deploy
   vercel env add VITE_SUPABASE_URL production       # add env var
   vercel env add VITE_SUPABASE_ANON_KEY production   # add env var
   vercel rm stint-ledger                            # take down
   ```

9. **PWA icon is still wrong on phone** — shows "A" instead of "L". Needs apple-touch-icon link in index.html and verified PNG files. User must delete old home screen shortcut and re-add after fix.

---

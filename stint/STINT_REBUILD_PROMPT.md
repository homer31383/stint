# Stint — Rebuild Prompt

Paste this into a new Claude Code session to instantly rebuild full context.

---

## Context

I'm Chris Bernier, a freelance creative director in advertising post-production. I built **Stint**, a freelance management PWA, with Claude Code. The repo is at `D:\AI\Claude\TimeSheet\stint` (GitHub: https://github.com/homer31383/stint, private).

Read `CLAUDE.md` in the project root for the full technical reference. Here's the critical context that lives outside the codebase:

## Current State (as of March 24, 2026)

**Working features:**
- **Time tracking**: Weekly hour-grid timesheet with project color coding, batch fill, copy last week, undo (Ctrl+Z), timer. Project bar defaults to showing only projects with active bookings for the current week.
- **Bookings/Pencils**: Full CRUD (create, edit by clicking, delete). Calendar view with conflict detection. Priority levels (Booked/1st/2nd/3rd). Per-booking rate overrides stored as `rates` jsonb.
- **Invoicing**: Day-based invoice creation from time entries. Status tracking (draft/sent/paid/overdue). Payment date tracking with date picker when marking paid. "Paid Mar 15" shown on invoice list. PDF download.
- **Clients**: Full CRUD with contacts array [{name, role, email}], per-client service rate overrides, project management with production crew fields.
- **Reports**: Period-based (week/month/quarter/year) revenue, utilization, invoiced totals, average days-to-payment stat.
- **Settings**: Business info, masked bank details (routing/account with eye toggle), default rates, invoice numbering, hide dollars toggle, JSON export.
- **Global search**: Search icon in header, 200ms debounced, searches across clients/projects/invoices/bookings. Full-screen sheet on mobile.
- **Sync**: Supabase is source of truth. Pull-replace every 10s + push-on-change inside setData updaters. ~155 lines in useOfflineFirst.js.
- **Internal Meeting dedup**: One-time cleanup on app load removes duplicate Internal Meeting projects per client (keeps most-referenced, then oldest). Ensure-exists effect uses setProjects updater to avoid stale closures.

**Rate priority cascade**: booking rate > client rate > default rate. getRate() checks for an active booking matching by date range and project/client before falling back.

## Architecture Rules (must never be violated)
1. **Single file UI**: Everything is in `src/App.jsx` (~3170 lines). Do not split.
2. **No CSS files**: All styling is inline JS objects via theme object `t`.
3. **Shared Supabase**: Only touch `stint_` prefixed tables. Other tables belong to Axiom.
4. **Supabase is source of truth**, not localStorage. localStorage is just offline fallback.
5. **Push changes immediately** inside `setData` updaters (side effects in React state updaters — intentional and working).
6. **camelCase in JS, snake_case in Supabase** — converted at sync boundary.
7. **Do not add Co-Authored-By lines** to commit messages.
8. **Deploy**: `npx vercel --prod` from the stint/ directory. No auto-deploy.

## Key Decisions Made in Chat
- The sync layer was rewritten 3 times. The final version is dead simple: pull-replace + push-on-change. Never add complexity back (queues, batching, FK ordering, timestamp guards, deletion tracking).
- Internal Meeting dedup fires once via useRef guard, not on every render. It checks time entry and pencil references before deleting — only removes zero-reference duplicates.
- Timesheet project bar was cluttered with every Internal Meeting project. Fixed by defaulting to "Booked this week" filter that only shows projects with active bookings overlapping the current week.
- Bank details in Settings are masked with dots and a toggle. The Field component doesn't support onFocus/onBlur pass-through, so fields are set to `readOnly` when masked.

## Known Issues
1. **Past bookings not editable**: The Past section in Pencils uses simplified `Row` components without the `openEdit` click handler. Only upcoming entries are clickable to edit.
2. **Mobile project filter missing**: The client/booking filter dropdown (`Sel`) is only shown on desktop (`!isMobile`). Mobile users see booked projects but can't switch to "All projects".

## Migrations Already Applied (do NOT re-run)
1. `001_initial_schema.sql` — tables, indexes, RLS
2. `002_auth_rls.sql` — auth-required RLS policies
3. `003_add_updated_at.sql` — updated_at on all tables
4. `ALTER TABLE stint_clients ADD COLUMN IF NOT EXISTS contacts jsonb default '[]';`
5. `ALTER TABLE stint_invoices ADD COLUMN IF NOT EXISTS paid_date text;`
6. `ALTER TABLE stint_pencils ADD COLUMN IF NOT EXISTS client_id text;`
7. `ALTER TABLE stint_pencils ADD COLUMN IF NOT EXISTS rates jsonb;`

## Preferences
- I prefer simple, direct solutions. Avoid over-engineering.
- "Deploy please" = run `npx vercel --prod` immediately.
- I prefer seeing SQL printed in chat before running migrations manually.
- Keep the single-file UI — do not split unless I ask.

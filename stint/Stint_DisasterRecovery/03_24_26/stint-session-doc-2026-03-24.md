# Stint Session Doc - 2026-03-24

## Session Type
Feature build + deployment + debugging

## What Was Built

### New App: Stint
Built an entire freelance management PWA from scratch across this session and prior sessions. This session focused on turning the prototype artifact into a deployable production app and iterating on features.

### Initial Setup & Deployment
- Created Vite + React project structure with PWA support
- Integrated Supabase (shared project with Axiom/Kristory, all tables stint_ prefixed)
- Deployed to Vercel at stint-iota.vercel.app
- Set up Supabase Auth with email/password login
- Disabled public sign-ups for security
- Generated PWA icons (192px and 512px)

### Data Sync (Major Debugging)
- Built offline-first sync hook (useOfflineFirst.js)
- Initial approach: localStorage as source of truth with Supabase background sync
- **Problem:** Merge conflicts, duplicates, deleted items reappearing, stale data overwriting newer data
- **Root causes identified:**
  - Push/pull race conditions: stale localStorage pushed back on app load
  - No deletion tracking: deletes not synced to Supabase, pulls restored deleted items
  - Foreign key ordering: projects pushed before clients existed in Supabase
  - __personal__ project/client pushed to Supabase causing FK errors
  - 409 Conflict responses treated as errors instead of success
  - stint_pencils missing client_id column after booking feature change
- **Final fix:** Switched to Supabase-first model. Supabase is source of truth, localStorage is cache. Push immediately on every change, pull replaces local state entirely. 10-second polling interval.

### Mobile Layout
- Bottom tab bar (Home, Time, Bookings, Invoices, More popover)
- Single-day timesheet view with day picker strip
- Bottom sheets instead of centered modals
- Sticky project bar above bottom nav
- Tap action menu on filled time cells (Remove / Edit Note)
- Fixed crypto.randomUUID crash on HTTP (replaced with Math.random fallback)

### Features Added This Session
1. **Collapsible Recent Time** on dashboard (default collapsed)
2. **Contact management on clients** - array of {name, role, email} per client, displayed on expanded card
3. **Per-booking rate cards** - custom rates per service type on each booking, rate priority: booking > client > default
4. **Payment tracking** - paid_date on invoices, "Paid Mar 15" display, avg days-to-payment in Reports
5. **Booking editing** - click existing booking to edit (was create-only before)
6. **Optional project on bookings** - client required, project optional
7. **Individual hour removal** from timesheet blocks (hover shows x per hour, pencil icon for notes)
8. **Dashboard month count fix** - counts unique dates, not hour entries
9. **Masked bank details** in Settings (dots with eye toggle)
10. **Export all data** as JSON backup from Settings
11. **Director/Producer email fields** on projects

### Disaster Recovery Docs
- Generated stint-disaster-recovery.docx (complete rebuild reference)
- Generated stint-rebuild-prompt.md (Claude Code prompt to rebuild from scratch)

## Diagnostic Findings

### Sync Issues (Root Causes)
- localStorage-first sync is fundamentally flawed for multi-device: each device thinks its local state is canonical
- Supabase upsert with onConflict returns 409 when row exists but columns differ in ways Postgres considers a conflict
- camelToSnake converter creates client_id from clientId, but stint_pencils didn't have that column
- Auto-create Internal Meeting useEffect runs on every render cycle, creating duplicates

### PWA Issues
- crypto.randomUUID only works on HTTPS or localhost, not HTTP over local network
- Installed PWA caches old JS bundles; must uninstall/reinstall after major code changes
- Clearing site data: Settings > Apps > Stint > Storage > Clear data (or Chrome site settings > Clear & reset)

## Files Changed
All changes were made through Claude Code to src/App.jsx and src/hooks/useOfflineFirst.js primarily. The session also created:
- supabase/migrations/001_initial_schema.sql (initial schema)
- supabase/migrations/002_auth_rls.sql (auth RLS policies)
- CLAUDE.md, README.md, vite.config.js, index.html, etc.

## Migrations / External Setup
SQL run in Supabase SQL Editor this session:
1. 001_initial_schema.sql - all stint_ tables
2. 002_auth_rls.sql - auth RLS policies
3. `alter table stint_pencils add column if not exists client_id text references stint_clients(id) on delete set null;`
4. `alter table stint_clients add column if not exists contacts jsonb default '[]';`
5. `alter table stint_invoices add column if not exists paid_date text;`
6. `alter table stint_pencils add column if not exists rates jsonb default '{}';`
7. `alter table stint_clients add column if not exists updated_at bigint default (extract(epoch from now()) * 1000);`
8. Same updated_at for stint_projects, stint_time_entries, stint_pencils, stint_invoices, stint_settings

Vercel setup:
- Created new Vercel project linked to stint
- Added VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars
- Deployed at stint-iota.vercel.app

Supabase Auth:
- Disabled public sign-ups
- Created user account

## Commits
Multiple commits made through Claude Code session. Key ones:
- init (project scaffolding)
- Mobile layout implementation
- Auth implementation
- Sync rewrite (Supabase-first)
- Contacts, rate cards, payment tracking features

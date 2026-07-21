# Stint Rebuild Prompt - 2026-03-24

## What It Is
Stint is a freelance management PWA for Chris Bernier, a freelance Creative Director in advertising post-production based in Brooklyn. It handles time tracking (hourly grid), project/client management, bookings/pencils with rate cards, invoicing with PDF generation, and financial reporting. It runs on web, Android (PWA), and iOS (PWA).

## Current State of Features

### Working
- **Auth:** Supabase email/password login, public sign-ups disabled, biometric via Chrome autofill
- **Dashboard:** This Month (unique days), Outstanding invoices, Quick Log Today, Upcoming Bookings, Recent Time (collapsible)
- **Timesheet:** Weekly grid (desktop), single-day view (mobile), project brush, block merging, individual hour removal, notes, fill range, copy last week, undo (20 actions, Cmd+Z)
- **Bookings:** Client-first (project optional), priority 0-3, per-booking rate cards, editing, conflict detection, monthly calendar, inline client/project creation
- **Invoices:** Day-based, expense line items, PDF via print dialog, status management, payment tracking with paid_date
- **Clients:** Collapsible cards, contacts array [{name, role, email}], per-client negotiated rates, safe delete
- **Projects:** Status (active/on_hold/complete), crew fields with director/producer emails, detail pills
- **Reports:** Period navigation, hours/revenue/utilization/invoiced stats, client breakdown, days-to-payment
- **Settings:** Business info, masked bank details, default rates, invoice config, hide dollars, JSON export, sign out
- **Sync:** Supabase-first, push on change, pull every 10s, localStorage cache, __personal__ excluded
- **Mobile:** Bottom tab bar, bottom sheet modals, single-day timesheet, tap action menus
- **PWA:** Installable, offline capable, service worker caching

### Rate Priority
booking rate > client rate > default rate. Rates baked into time entries at logging time.

## Immediate Next Tasks

### 1. Timesheet Project Filter (IN PROGRESS)
Only show projects with active bookings for the current week in the project selector. Keep Personal always visible. Add "All Projects" toggle in client filter dropdown.

Prompt given but not yet run:
> In the Timesheet project selector, only show projects that have an active booking for the current week by default. A project has an active booking if there's a pencil/booking where the current week's dates overlap with the pencil's start_date/end_date. Still show the "Personal" button always. Add an "All Projects" toggle or option in the client filter dropdown so I can access other projects when needed.

### 2. Duplicate Internal Meeting Cleanup (IN PROGRESS)
Fix the useEffect that auto-creates Internal Meeting projects (fires every render, creates duplicates). Add one-time cleanup on load keeping only the one with references (time entries, pencils, invoices).

Prompt given but not yet run:
> Fix the duplicate Internal Meeting projects. The useEffect that auto-creates them is firing multiple times. Make it only create one if none exists for that client. Also add a one-time cleanup on app load that removes duplicate Internal Meeting projects per client. For each client, keep the one that has time entries, pencils, or invoices referencing it. If none have references, keep the oldest by createdAt. Only delete the ones with zero references.

### 3. Global Search
Search modal across clients, projects, invoices, bookings. Local-only filtering, debounced 200ms, results grouped by type, clickable navigation.

### 4. Masked Bank Details
Routing and account number fields in Settings should show dots with eye toggle to reveal. May already be implemented by Claude Code.

## Key Architectural Rules (NEVER VIOLATE)
- All Supabase tables prefixed stint_
- All localStorage keys prefixed stint_
- Never touch non-stint tables (Axiom/Kristory share the Supabase project)
- __personal__ project/client (id: '__personal__') are LOCAL ONLY, never push to Supabase
- Supabase is source of truth, localStorage is cache
- Push immediately on every change, pull every 10s
- camelCase in JS, snake_case in Supabase (auto-converted in sync hook)
- uid() uses Math.random, NOT crypto.randomUUID (breaks on HTTP)
- Single-file architecture: everything in src/App.jsx unless explicitly asked to split
- Do not add Co-Authored-By lines to commit messages
- Vercel Hobby plan: only one committer allowed, no co-author trailers

## Active Bugs

### Duplicate Internal Meeting Projects
**Diagnosis:** The useEffect that ensures every client has an Internal Meeting project runs on every render because its dependency array triggers on clients/projects state changes, which it itself causes. Each run creates a new project, which triggers another run.
**Fix path:** Check existence before creating. Add dedup cleanup on mount. Protect referenced projects from deletion.

## Context Outside the Codebase

### Decisions Made in Chat
- Chose "Stint" as app name (over Ledger, Docket, Opus, Folio)
- Chose offline-first initially, then switched to Supabase-first after sync conflicts
- Chose to share Supabase with Axiom (stint_ prefixes) rather than new project (free tier limit)
- Bookings are client-first, project optional (project can be assigned later)
- Rate priority: booking > client > default, baked into time entry at log time
- Invoice PDF uses print dialog (not true PDF gen) -- works but not ideal
- Pencil priority 0 = booked, 1-3 = pencil levels
- Timer state (activeTimer) intentionally does not sync across devices

### Things Tried and Failed
- localStorage-first sync with merge logic: caused duplicates, deleted items returning, stale overwrites
- crypto.randomUUID: crashes on HTTP connections (local network to phone)
- Supabase upsert treating 409 as error: needed to treat as success (row already exists)
- PWA installed app caching old code: requires full uninstall/reinstall after major changes

### Gotchas
- After adding columns to Supabase, must redeploy (vercel --prod) for the app to use them
- Clearing PWA data on Android: Settings > Apps > Stint > Storage > Clear data
- Clearing Chrome site data: URL bar lock icon > Site settings > Clear & reset
- Vercel Hobby plan blocks deploys with Co-Authored-By in commits
- The client filter dropdown on timesheet shows ALL clients including Internal Meeting projects for every client -- very cluttered

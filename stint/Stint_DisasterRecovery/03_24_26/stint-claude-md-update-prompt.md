# Claude Code Prompt: Update CLAUDE.md

Please update CLAUDE.md with the following new context from the latest development session:

## Add to Key Facts section:
- Supabase is source of truth, localStorage is cache (NOT the other way around)
- Push changes to Supabase immediately on every create/update/delete
- Pull from Supabase on app load and every 10 seconds
- __personal__ project/client (id: '__personal__') must NEVER be pushed to Supabase
- uid() uses Math.random().toString(36).slice(2,10), NOT crypto.randomUUID (breaks on HTTP)
- Do not add Co-Authored-By lines to commit messages (breaks Vercel Hobby plan deploys)
- Vercel deployment: `vercel --prod` from CLI

## Add new section: Rate System
Rate priority when logging time: booking rate > client rate > default rate.
Rates are baked into each time entry at the moment of logging. Changing a booking rate later does not affect already-logged time.
Bookings store rates as: `rates: {day_rate: X, shoot_attend: Y, hourly: Z, overtime: W}` (all optional, blank falls back).

## Add new section: Bookings
- Client is required, project is optional on bookings
- Pencil priority: 0=booked, 1=pencil 1, 2=pencil 2, 3=pencil 3
- Bookings are editable (click to open edit modal)
- Per-booking rate cards override client and default rates

## Add new section: Clients
- Clients have a contacts array: [{name, role, email}]
- Legacy single email field still supported as fallback
- Each client auto-gets one "Internal Meeting" project on creation
- Known issue: Internal Meeting auto-create can duplicate; dedup cleanup needed

## Add new section: Invoices
- Payment tracking: paid_date field records when payment was received
- Invoice PDF generated via print dialog (HTML in popup window)

## Add new section: Mobile
- isMobile detected via matchMedia (max-width: 767px)
- Bottom tab bar: Home, Time, Bookings, Invoices, More (popover for Clients/Reports/Settings)
- Modals render as bottom sheets on mobile
- Timesheet: single-day view with horizontal day picker strip
- Filled time cells: tap shows action menu (Remove / Edit Note) instead of immediate delete

## Add new section: Supabase Schema Additions Beyond Initial Migration
These columns were added after the initial schema:
- stint_pencils: client_id, rates (jsonb)
- stint_clients: contacts (jsonb), updated_at
- stint_projects: updated_at
- stint_time_entries: updated_at
- stint_pencils: updated_at
- stint_invoices: paid_date, updated_at
- stint_settings: updated_at

## Add to Common Commands:
- `vercel --prod` to deploy
- `npm run dev -- --host` to allow phone access on local network

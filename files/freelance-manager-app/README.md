# Freelance Manager

Personal freelance management PWA — time tracking, invoicing, bookings, and project management.

**Stack:** React + Vite + Supabase + PWA (installable on iOS/Android/desktop)

## Quick Start

```bash
# Install dependencies
npm install

# Copy env and add your Supabase credentials
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key

# Run dev server
npm run dev
```

## Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run the migration file: `supabase/migrations/001_initial_schema.sql`
3. Go to Settings → API and copy your project URL and anon key
4. Add them to `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

**Note:** The app works fully offline with localStorage even without Supabase configured. Supabase adds cloud persistence and multi-device sync.

## Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard:
# VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

## Architecture

### Offline-First Data Layer
- **localStorage** is the source of truth (instant, works offline)
- **Supabase** syncs in the background when online
- Changes queue locally and flush when connectivity returns
- Hook: `src/hooks/useOfflineFirst.js`

### Data Model
- **clients** — name, email, negotiated rates
- **projects** — belongs to client, crew details, status (active/on_hold/complete)
- **time_entries** — 1 row per hour block, painted onto weekly grid
- **pencils** — bookings & pencils with priority (0=booked, 1-3=pencil)
- **invoices** — day-based line items, expenses, PDF download
- **settings** — business info, bank details, rates, display prefs

### PWA Features
- Installable on iOS (Add to Home Screen), Android, desktop
- Offline capable via service worker
- App-like experience with standalone display mode

## Key Features
- Hourly timesheet grid (6am-9pm, Mon-Sun) with project "brush" painting
- Per-client negotiated rates with service types (day rate, hourly, OT, shoot attend)
- Booking/pencil calendar with conflict detection
- Day-based invoicing with auto-generated project breakdowns
- Expense line items on invoices
- PDF invoice download
- Weekly/monthly/quarterly/yearly reports with utilization tracking
- Project crew management (director, producer, CD, 3D/2D leads)
- Undo on timesheet (Cmd+Z)
- Copy last week's timesheet layout
- JSON data export/backup
- Dollar amounts can be hidden on dashboard/reports

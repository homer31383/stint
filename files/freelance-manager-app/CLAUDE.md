# CLAUDE.md - Project Context for Claude Code

## What this is
Freelance Manager — a personal PWA for Chris Bernier, freelance Creative Director in advertising post-production. Tracks time, manages bookings/pencils, generates invoices, and manages client/project details.

## Tech Stack
- **Frontend:** React 18 + Vite, single-file component architecture in `src/App.jsx`
- **Data:** Offline-first with localStorage + Supabase sync (`src/hooks/useOfflineFirst.js`)
- **Database:** Supabase (Postgres) — schema in `supabase/migrations/`
- **Deployment:** Vercel
- **PWA:** vite-plugin-pwa for installability and offline support

## Key Architecture Decisions
- The entire UI is in `src/App.jsx` as a single file with multiple function components. This is intentional for now — don't split into separate files unless asked.
- Data uses camelCase in JS and snake_case in Supabase. The sync hook handles conversion.
- localStorage is the source of truth. Supabase syncs in background. App works without Supabase.
- No auth yet — single user, open RLS policies. Will add auth later.

## Common Commands
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
vercel           # Deploy to Vercel
```

## Data Model
- `clients` → has many `projects`
- `projects` → has many `time_entries`, `pencils`
- `time_entries` → 1 row = 1 hour block on the timesheet grid
- `pencils` → bookings (priority 0) and pencils (priority 1-3)
- `invoices` → day-based line items + expenses, references time_entry IDs
- `settings` → single object for business info, rates, prefs

## Design System
- Light theme: bg #f8f7f4, white cards, green (#2d8a4e) accents
- Font: Instrument Sans (Google Fonts)
- Minimal, clean, no excess formatting
- Mobile-responsive but desktop-first for the timesheet grid

## Service Types & Rates (defaults)
- Day Rate: $1,200/day
- Shoot Attend: $1,500/day
- Hourly: $150/hr
- Overtime: $187.50/hr
- Expense: pass-through

## Personal Project
- PERSONAL_PROJECT_ID = "__personal__" is a special constant
- Always exists, purple colored, excluded from invoicing
- Used for personal time blocks on the timesheet

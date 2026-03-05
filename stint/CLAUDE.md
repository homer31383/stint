# CLAUDE.md

## What
Stint - freelance management PWA for Chris Bernier, freelance CD in advertising post-production.

## Stack
React 18 + Vite, Supabase (shared with Axiom), Vercel, PWA

## Key facts
- UI is in src/App.jsx as a single file. Do not split unless asked.
- All localStorage keys use stint_ prefix
- All Supabase tables use stint_ prefix
- Supabase shared with Axiom/Kristory - never touch non-stint tables
- Offline-first: localStorage is source of truth, Supabase syncs background
- No auth yet, single user, open RLS policies
- camelCase in JS, snake_case in Supabase

## Commands
npm run dev / npm run build / vercel

## Data model
stint_clients -> stint_projects -> stint_time_entries, stint_pencils
stint_invoices (day-based line items + expenses)
stint_settings (single row: business info, rates, prefs)

## Design
Light theme: bg #f8f7f4, white cards, green #2d8a4e
Font: Instrument Sans. Desktop-first for timesheet grid.

## Rates
Day Rate 200, Shoot Attend 500, Hourly 50, OT 87.50

# Stint Ledger — Complete Disaster Recovery Guide

Last updated: March 26, 2026

This document contains everything needed to rebuild Stint Ledger from scratch if all code, files, and project data are lost.

---

## 1. Clone the Repository

```bash
git clone https://github.com/homer31383/stint-ledger.git
cd stint-ledger
npm install
```

Repository is private. Access via `homer31383` GitHub account.

## 2. Environment Variables

Create `.env` in the project root (gitignored):

```
VITE_SUPABASE_URL=https://xxsjfeafpzzcmadyvuue.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4c2pmZWFmcHp6Y21hZHl2dXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjk0NTQsImV4cCI6MjA4NzcwNTQ1NH0.caN_McmyoWHdq7rtu7gEuiZVoLV0enmxwgiDHU03CTU
```

These connect to the shared Supabase instance (also used by Stint and Axiom). The anon key is safe to store — RLS + auth policies restrict access to authenticated users only.

## 3. Supabase Project Info

- **Supabase project ref**: `xxsjfeafpzzcmadyvuue`
- **Dashboard**: https://supabase.com/dashboard
- **Shared with**: Stint (time-tracking app) and Axiom (task manager, separate tables)
- Stint and Stint Ledger both use Supabase Auth; Axiom does not (uses anon, separate tables)

## 4. Supabase Authentication Setup

1. Go to **Authentication > Providers > Email**
2. Enable Email provider
3. **Disable** "Confirm email" (single user, no verification needed)
4. **Disable** "Enable signup" (prevent random account creation)
5. Go to **Authentication > Users > Add user**
6. Email: `shopping@chrisbernier.com`
7. Set password manually
8. Auto-confirm: yes

Both Stint and Stint Ledger share this same user account.

## 5. Database Tables

Stint Ledger reads from 6 `stint_*` tables owned by the Stint app and reads/writes 1 `ledger_sync` table.

### If tables need to be recreated (e.g., Supabase project reset)

```sql
-- stint_clients
CREATE TABLE stint_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  service_rates JSONB DEFAULT '{}',
  created_at BIGINT NOT NULL
);

-- stint_projects
CREATE TABLE stint_projects (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  director TEXT, director_email TEXT,
  producer TEXT, producer_email TEXT,
  production_company TEXT, creative_director TEXT,
  lead_3d TEXT, lead_2d TEXT, my_role TEXT,
  due_date TEXT, notes TEXT,
  created_at BIGINT NOT NULL
);

-- stint_time_entries
CREATE TABLE stint_time_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  hour INTEGER,
  service_type TEXT NOT NULL,
  hours NUMERIC NOT NULL,
  rate NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  notes TEXT,
  created_at BIGINT NOT NULL
);

-- stint_pencils
CREATE TABLE stint_pencils (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  project_id TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at BIGINT NOT NULL
);

-- stint_invoices
CREATE TABLE stint_invoices (
  id TEXT PRIMARY KEY,
  number TEXT,
  client_id TEXT, client_name TEXT, client_email TEXT,
  entry_ids TEXT[] DEFAULT '{}',
  line_items JSONB DEFAULT '[]',
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  issue_date TEXT, due_date TEXT,
  invoice_code TEXT, notes TEXT,
  date_range TEXT, dates_worked TEXT[] DEFAULT '{}',
  created_at BIGINT NOT NULL
);

-- stint_settings
CREATE TABLE stint_settings (
  id TEXT PRIMARY KEY,
  business_name TEXT, business_email TEXT,
  business_phone TEXT, business_address TEXT,
  bank_name TEXT, routing TEXT, account_number TEXT,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  next_invoice_number INTEGER NOT NULL DEFAULT 1,
  payment_terms INTEGER NOT NULL DEFAULT 30,
  hide_dollars BOOLEAN NOT NULL DEFAULT FALSE,
  service_rates JSONB DEFAULT '{}'
);

-- ledger_sync (owned by Stint Ledger)
CREATE TABLE ledger_sync (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RLS Policies (MUST be applied after table creation)

```sql
-- Enable RLS on all tables
ALTER TABLE stint_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE stint_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE stint_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE stint_pencils ENABLE ROW LEVEL SECURITY;
ALTER TABLE stint_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stint_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_sync ENABLE ROW LEVEL SECURITY;

-- Drop old open policies if they exist
DROP POLICY IF EXISTS "Allow anon read" ON stint_clients;
DROP POLICY IF EXISTS "Allow anon read" ON stint_projects;
DROP POLICY IF EXISTS "Allow anon read" ON stint_time_entries;
DROP POLICY IF EXISTS "Allow anon read" ON stint_pencils;
DROP POLICY IF EXISTS "Allow anon read" ON stint_invoices;
DROP POLICY IF EXISTS "Allow anon read" ON stint_settings;
DROP POLICY IF EXISTS "Allow anon read" ON ledger_sync;

-- Authenticated-only read policies for stint tables
CREATE POLICY "Authenticated read" ON stint_clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON stint_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON stint_time_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON stint_pencils FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON stint_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON stint_settings FOR SELECT TO authenticated USING (true);

-- Authenticated read/write for ledger_sync
CREATE POLICY "Authenticated read/write" ON ledger_sync FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

**Important**: Both Stint and Stint Ledger use Supabase Auth, so `TO authenticated` works for both apps. Axiom uses separate tables and is unaffected.

## 6. IndexedDB Schema

Database: `stint-ledger`, version 1

| Store | Key | Value |
|-------|-----|-------|
| stint | clients, projects, timeEntries, pencils, invoices, settings, lastSynced | Cached Supabase data |
| stint | planner-settings | PlannerSettings object |
| stint | retirement-settings | RetirementSettings object |
| stint | expense-model | ExpenseModel object |
| stint | saved-scenarios | SavedScenario[] array |
| accounts | balances | DetailedBalances object |

This is local-only data. Can be restored via Settings Sync pull if previously pushed.

## 7. Run and Verify

```bash
npm run dev
```

### Smoke Test Checklist
- [ ] Open http://localhost:5173 — login screen appears
- [ ] Sign in with `shopping@chrisbernier.com` — dashboard loads with real data
- [ ] Session persists across page refresh (no re-login needed)
- [ ] Dashboard shows YTD income, utilization, net worth
- [ ] All 8 views render without errors (Dashboard, Utilization, Pipeline, Invoices, Planner, Expenses, Net Worth, Retirement)
- [ ] Planner sliders work, saved scenarios load/compare
- [ ] Expenses: drag reorder works on desktop + mobile
- [ ] Net Worth: account editing saves (persists after refresh)
- [ ] Settings sync push/pull works
- [ ] Sign out returns to login screen
- [ ] Mobile via LAN: http://192.168.29.152:5173 (IP may vary)
- [ ] PWA installs on desktop and mobile

## 8. Deployment (Vercel)

Not yet deployed. When ready:

```bash
npm i -g vercel
vercel                      # First time: link project, auto-detect Vite
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel --prod
```

## 9. Data Recovery

### If code is lost
Clone from GitHub. All code is in the repo.

### If IndexedDB is cleared
Pull settings from Supabase via Settings Sync (if previously pushed). Otherwise, manually re-enter account balances in Net Worth view and adjust planner/expense settings.

### If Supabase data is lost
Time entries, clients, projects, invoices, pencils, and settings are populated by the Stint app. Restore from Stint's data. The `ledger_sync` row is the recovery point for planner settings, expense model, account balances, and saved scenarios.

### If everything is lost
1. Clone repo, install dependencies, set up `.env`
2. Recreate Supabase tables (SQL above) and apply RLS policies
3. Create Supabase Auth user
4. Run app, sign in
5. Supabase data loads automatically (if Stint has populated it)
6. Pull settings from `ledger_sync` to restore local state
7. If `ledger_sync` is also empty, manually re-enter account balances and planner settings

## 10. Key Architecture Decisions

| Decision | Why |
|----------|-----|
| No routing library | Single-user app, 8 views, state-based switching is simpler |
| IndexedDB for local state | Planner/expense settings are per-device, only synced on demand |
| PC-push/phone-pull sync | Single user, PC is primary device, avoids conflict resolution |
| Supabase Auth (email/password) | Secures data behind login, shared user account with Stint app |
| `.maybeSingle()` over `.single()` | Prevents 406 errors when ledger_sync row doesn't exist yet |
| `uuid()` fallback | Older mobile Safari lacks `crypto.randomUUID()` |
| ErrorBoundary in App.tsx | Without it, any crash blanks the screen with no error info |
| RLS with `TO authenticated` | Both Stint and Stint Ledger use auth; blocks unauthenticated access |

## 11. Account Mapping Reference

```
checking    = advRelationship + santanderChecking + advantageSavings
hys         = highYieldSavings + openbankHYS
moneyMarket = santanderMM
brokerage   = nonRetirement
tradIRA     = traditionalIRA
rolloverIRA = rolloverIRA
hsa         = hsa
ccDebt      = citiDoubleCash  (negative)
```

## 12. Return Rate Assignments

| Account | Rate Variable | Default |
|---------|--------------|---------|
| checking | 0% | — |
| hys, moneyMarket | cashReturn | 4% |
| brokerage, tradIRA, hsa | equityReturn | 7% |
| rolloverIRA | rolloverReturn | 4% |

## 13. Tax Formulas

### Freelance (estimateTaxes)
- SE tax: 15.3% on 92.35% of gross
- Federal: progressive brackets on (AGI - halfSE - $15k standard deduction)
- NY State: 7% flat on AGI
- Brackets: 10%/$11,925 | 12%/$48,475 | 22%/$103,350 | 24%/$197,300 | 32%/$250,525 | 35%/$626,350 | 37%+

### Full-Time W-2 (estimateW2Taxes)
- SS: 6.2% (capped $176,100) + Medicare: 1.45%
- 401k reduces taxable income (pre-tax)
- Federal: same brackets on (gross - 401k - $15k)
- NY State: 7% on (gross - 401k)

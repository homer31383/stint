-- Freelance Manager Schema
-- Run this in your Supabase SQL editor

-- Clients
create table if not exists clients (
  id text primary key,
  name text not null,
  email text,
  notes text,
  service_rates jsonb default '{}',
  created_at bigint default (extract(epoch from now()) * 1000)
);

-- Projects
create table if not exists projects (
  id text primary key,
  client_id text references clients(id) on delete cascade,
  name text not null,
  status text default 'active' check (status in ('active', 'on_hold', 'complete')),
  director text,
  director_email text,
  producer text,
  producer_email text,
  production_company text,
  creative_director text,
  lead_3d text,
  lead_2d text,
  my_role text,
  due_date text,
  notes text,
  created_at bigint default (extract(epoch from now()) * 1000)
);

-- Time entries (each row = 1 hour block)
create table if not exists time_entries (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  date text not null,
  hour integer,
  service_type text not null default 'day_rate',
  hours numeric default 1,
  rate numeric default 0,
  amount numeric default 0,
  notes text,
  created_at bigint default (extract(epoch from now()) * 1000)
);

-- Pencils / Bookings
create table if not exists pencils (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  start_date text not null,
  end_date text not null,
  priority integer default 1 check (priority between 0 and 3),
  notes text,
  created_at bigint default (extract(epoch from now()) * 1000)
);

-- Invoices
create table if not exists invoices (
  id text primary key,
  number text,
  client_id text references clients(id) on delete set null,
  client_name text,
  client_email text,
  entry_ids jsonb default '[]',
  line_items jsonb default '[]',
  total numeric default 0,
  status text default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue')),
  issue_date text,
  due_date text,
  invoice_code text,
  notes text,
  date_range text,
  dates_worked jsonb default '[]',
  created_at bigint default (extract(epoch from now()) * 1000)
);

-- Settings (single row)
create table if not exists settings (
  id text primary key default 'default',
  business_name text,
  business_email text,
  business_phone text,
  business_address text,
  bank_name text,
  routing text,
  account_number text,
  invoice_prefix text default 'CB',
  next_invoice_number integer default 2,
  payment_terms integer default 30,
  hide_dollars boolean default true,
  service_rates jsonb default '{"day_rate": 1200, "shoot_attend": 1500, "hourly": 150, "overtime": 187.5, "expense": 0}'
);

-- Indexes for common queries
create index if not exists idx_time_entries_date on time_entries(date);
create index if not exists idx_time_entries_project on time_entries(project_id);
create index if not exists idx_pencils_dates on pencils(start_date, end_date);
create index if not exists idx_projects_client on projects(client_id);
create index if not exists idx_projects_status on projects(status);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoices_client on invoices(client_id);

-- Enable RLS (Row Level Security) - open for now, lock down later with auth
alter table clients enable row level security;
alter table projects enable row level security;
alter table time_entries enable row level security;
alter table pencils enable row level security;
alter table invoices enable row level security;
alter table settings enable row level security;

-- Permissive policies (single user for now - tighten with auth later)
create policy "Allow all on clients" on clients for all using (true) with check (true);
create policy "Allow all on projects" on projects for all using (true) with check (true);
create policy "Allow all on time_entries" on time_entries for all using (true) with check (true);
create policy "Allow all on pencils" on pencils for all using (true) with check (true);
create policy "Allow all on invoices" on invoices for all using (true) with check (true);
create policy "Allow all on settings" on settings for all using (true) with check (true);

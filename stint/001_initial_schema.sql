-- Stint Schema (all tables stint_ prefixed)
-- Run in Supabase SQL Editor on your Axiom project

create table if not exists stint_clients (
  id text primary key, name text not null, email text, notes text,
  service_rates jsonb default cast('{}' as jsonb),
  created_at bigint default (extract(epoch from now()) * 1000)
);

create table if not exists stint_projects (
  id text primary key,
  client_id text references stint_clients(id) on delete cascade,
  name text not null,
  status text default ''active'',
  director text, director_email text, producer text, producer_email text,
  production_company text, creative_director text,
  lead_3d text, lead_2d text, my_role text, due_date text, notes text,
  created_at bigint default (extract(epoch from now()) * 1000)
);

create table if not exists stint_time_entries (
  id text primary key,
  project_id text references stint_projects(id) on delete cascade,
  date text not null, hour integer,
  service_type text not null default ''day_rate'',
  hours numeric default 1, rate numeric default 0, amount numeric default 0,
  notes text,
  created_at bigint default (extract(epoch from now()) * 1000)
);

create table if not exists stint_pencils (
  id text primary key,
  project_id text references stint_projects(id) on delete cascade,
  start_date text not null, end_date text not null,
  priority integer default 1, notes text,
  created_at bigint default (extract(epoch from now()) * 1000)
);

create table if not exists stint_invoices (
  id text primary key, number text,
  client_id text references stint_clients(id) on delete set null,
  client_name text, client_email text,
  entry_ids jsonb default cast(''[]'' as jsonb),
  line_items jsonb default cast(''[]'' as jsonb),
  total numeric default 0,
  status text default ''draft'',
  issue_date text, due_date text, invoice_code text, notes text,
  date_range text, dates_worked jsonb default cast(''[]'' as jsonb),
  created_at bigint default (extract(epoch from now()) * 1000)
);

create table if not exists stint_settings (
  id text primary key default ''default'',
  business_name text, business_email text, business_phone text, business_address text,
  bank_name text, routing text, account_number text,
  invoice_prefix text default ''CB'', next_invoice_number integer default 2,
  payment_terms integer default 30, hide_dollars boolean default true,
  service_rates jsonb default cast(''{}'' as jsonb)
);

create index if not exists idx_stint_te_date on stint_time_entries(date);
create index if not exists idx_stint_te_proj on stint_time_entries(project_id);
create index if not exists idx_stint_pencils_dates on stint_pencils(start_date, end_date);
create index if not exists idx_stint_proj_client on stint_projects(client_id);
create index if not exists idx_stint_inv_status on stint_invoices(status);

alter table stint_clients enable row level security;
alter table stint_projects enable row level security;
alter table stint_time_entries enable row level security;
alter table stint_pencils enable row level security;
alter table stint_invoices enable row level security;
alter table stint_settings enable row level security;

create policy "auth_stint_clients" on stint_clients for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "auth_stint_projects" on stint_projects for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "auth_stint_time_entries" on stint_time_entries for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "auth_stint_pencils" on stint_pencils for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "auth_stint_invoices" on stint_invoices for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "auth_stint_settings" on stint_settings for all using (auth.uid() is not null) with check (auth.uid() is not null);

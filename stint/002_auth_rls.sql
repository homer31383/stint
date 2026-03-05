-- Replace open RLS policies with auth-required policies
-- Run in Supabase SQL Editor after enabling Auth

drop policy if exists "all_stint_clients" on stint_clients;
drop policy if exists "all_stint_projects" on stint_projects;
drop policy if exists "all_stint_time_entries" on stint_time_entries;
drop policy if exists "all_stint_pencils" on stint_pencils;
drop policy if exists "all_stint_invoices" on stint_invoices;
drop policy if exists "all_stint_settings" on stint_settings;

create policy "auth_stint_clients" on stint_clients
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "auth_stint_projects" on stint_projects
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "auth_stint_time_entries" on stint_time_entries
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "auth_stint_pencils" on stint_pencils
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "auth_stint_invoices" on stint_invoices
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "auth_stint_settings" on stint_settings
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

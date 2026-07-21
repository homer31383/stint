-- Stint migration 004: per-day notes
-- One row per date. id holds the ISO date string (e.g. "2026-05-04").

create table if not exists stint_day_notes (
  id text primary key,
  note text,
  created_at bigint default (extract(epoch from now()) * 1000),
  updated_at bigint
);

alter table stint_day_notes enable row level security;

create policy "auth_stint_day_notes" on stint_day_notes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

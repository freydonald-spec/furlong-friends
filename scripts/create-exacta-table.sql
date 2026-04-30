-- Kentucky Derby Exacta Board: 20x20 grid of "win horse" × "place horse" squares.
-- Run this once in the Supabase SQL editor.

create table if not exists public.exacta_squares (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  row_horse   integer not null check (row_horse between 1 and 20),
  col_horse   integer not null check (col_horse between 1 and 20),
  buyer_name  text,
  is_diagonal boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (event_id, row_horse, col_horse)
);

create index if not exists exacta_squares_event_idx
  on public.exacta_squares (event_id);

alter table public.exacta_squares enable row level security;

-- Public read + write (matches the rest of the app's anon-key model;
-- the page is gated by the admin password client-side).
drop policy if exists "exacta read"  on public.exacta_squares;
drop policy if exists "exacta write" on public.exacta_squares;

create policy "exacta read"
  on public.exacta_squares for select
  using (true);

create policy "exacta write"
  on public.exacta_squares for all
  using (true)
  with check (true);

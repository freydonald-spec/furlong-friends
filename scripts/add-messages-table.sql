-- Live party-chat messages, scoped per event. Realtime subscription on this
-- table powers the floating PartyChat component on /picks and /track.
--
-- Run this once in the Supabase SQL editor.

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists messages_event_id_idx
  on public.messages (event_id);

-- RLS — same anon read+write pattern the rest of the app uses (the chat is
-- only surfaced to authenticated players client-side; abuse mitigation lives
-- in the UI gate, not the row layer).
alter table public.messages enable row level security;

drop policy if exists "messages read"  on public.messages;
drop policy if exists "messages write" on public.messages;

create policy "messages read"
  on public.messages for select
  using (true);

create policy "messages write"
  on public.messages for all
  using (true)
  with check (true);

-- Required for client.channel().on('postgres_changes', { table: 'messages' })
-- to actually fire. Other tables (picks, races, players, scores) are already
-- on this publication; messages needs to be added explicitly.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

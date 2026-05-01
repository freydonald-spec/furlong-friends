-- Adds the columns the admin UI uses to scope which races appear to players.
--   * races.is_game_race      — false hides the race from the picks page.
--   * events.max_game_races   — soft cap used by the upcoming Pick All wizard
--                                to limit how many races a player runs through.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.races
  add column if not exists is_game_race boolean not null default true;

alter table public.events
  add column if not exists max_game_races integer not null default 7;

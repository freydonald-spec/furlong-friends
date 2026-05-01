-- Adds bonus_points to public.scores so the longshot and perfect-race
-- bonuses introduced in lib/scoring.ts have somewhere to live.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.scores
  add column if not exists bonus_points integer not null default 0;

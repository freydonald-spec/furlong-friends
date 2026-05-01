-- Tracks whether a player has completed the mandatory first-run Pick Wizard
-- on /picks. When false, the wizard is shown full-screen on next page load.
-- Defaults to false so brand-new players run through it; existing rows can be
-- bulk-flipped to true after deploy if you'd rather not re-prompt veterans.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.players
  add column if not exists wizard_completed boolean not null default false;

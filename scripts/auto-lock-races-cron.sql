-- Server-side auto-lock for races. Runs every minute on Supabase regardless
-- of whether anyone has the admin tab open. The client-side 1s tick in
-- app/admin/page.tsx is kept as a backup for snappier UX when the admin
-- is watching, but this cron is the source of truth.
--
-- One-time setup in the Supabase SQL editor:
--   1) Dashboard → Database → Extensions → enable `pg_cron`
--   2) Run this file

create extension if not exists pg_cron;

-- Idempotent: drop any prior schedule with this name before (re)creating.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'auto-lock-races') then
    perform cron.unschedule('auto-lock-races');
  end if;
end $$;

select cron.schedule(
  'auto-lock-races',
  '* * * * *',
  $$
  update public.races
     set status = 'locked'
   where status in ('upcoming', 'open')
     and post_time is not null
     and post_time <= now();
  $$
);

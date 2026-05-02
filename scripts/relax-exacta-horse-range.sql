-- Relaxes the row_horse / col_horse check on exacta_squares so the board
-- can use ACTUAL post-position numbers from the horses table (which run
-- past 20 when alternates draw in — Derby AE1/AE2/AE3 use post positions
-- 21, 22, 23). The original create script pinned the range at 1..20, which
-- blocks inserts the new dynamic seeding logic needs to make.
--
-- Idempotent. Safe to re-run.

alter table public.exacta_squares
  drop constraint if exists exacta_squares_row_horse_check;
alter table public.exacta_squares
  drop constraint if exists exacta_squares_col_horse_check;

alter table public.exacta_squares
  add constraint exacta_squares_row_horse_check check (row_horse between 1 and 30);
alter table public.exacta_squares
  add constraint exacta_squares_col_horse_check check (col_horse between 1 and 30);

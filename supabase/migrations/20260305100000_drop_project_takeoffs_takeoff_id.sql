-- Drop unused takeoff_id link from project_takeoffs.
-- project_takeoffs stores takeoffs per project (Takeoff tab); takeoffs table is for
-- standalone Build Lists. The app never sets takeoff_id, so remove the FK and column.

alter table public.project_takeoffs
  drop constraint if exists project_takeoffs_takeoff_id_fkey;

alter table public.project_takeoffs
  drop column if exists takeoff_id;

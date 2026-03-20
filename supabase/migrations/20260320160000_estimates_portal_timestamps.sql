-- Portal timestamps used by /api/estimates/portal and paper-trail backfill.
alter table public.estimates add column if not exists viewed_at timestamptz;
alter table public.estimates add column if not exists actioned_at timestamptz;

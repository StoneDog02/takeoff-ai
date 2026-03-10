-- Plan type for takeoff: which TIER 3 doc set to use (residential, commercial, civil).
-- Used by project Takeoff tab so we don't inject civil rulebooks into residential jobs.

alter table public.projects
  add column if not exists plan_type text not null default 'residential'
    check (plan_type in ('residential', 'commercial', 'civil', 'auto'));

comment on column public.projects.plan_type is 'Takeoff plan type: residential | commercial | civil | auto. Drives which reference docs are injected (plan-type-docs.js).';

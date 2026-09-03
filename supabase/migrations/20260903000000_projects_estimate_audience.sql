-- Whether the job expects a customer-facing estimate or an internal/DIY budget tracker.
alter table public.projects
  add column if not exists estimate_audience text not null default 'customer';

alter table public.projects
  drop constraint if exists projects_estimate_audience_check;

alter table public.projects
  add constraint projects_estimate_audience_check
  check (estimate_audience in ('customer', 'internal'));

comment on column public.projects.estimate_audience is
  'customer = send estimate to client for approval; internal = DIY/budget tracker (no client portal required).';

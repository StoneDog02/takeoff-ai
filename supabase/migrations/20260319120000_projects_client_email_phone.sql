-- Client contact on project (New Project / New Estimate wizard).

alter table public.projects
  add column if not exists client_email text,
  add column if not exists client_phone text;

comment on column public.projects.client_email is 'Primary client email for the job (from setup / estimate wizard).';
comment on column public.projects.client_phone is 'Primary client phone for the job (from setup / estimate wizard).';

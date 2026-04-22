-- Explicit GC-controlled daily log portal access (in addition to role-based PM / site lead).
alter table public.employees
  add column if not exists daily_log_access boolean not null default false;

comment on column public.employees.daily_log_access is 'When true, employee may use field daily logs on assigned jobs regardless of roster/job role title.';

-- Rename legacy roster / crew role label in stored data.
update public.employees
set role = 'Crew Lead'
where lower(trim(role)) = 'framing lead';

update public.job_assignments
set role_on_job = 'Crew Lead'
where role_on_job is not null and lower(trim(role_on_job)) = 'framing lead';

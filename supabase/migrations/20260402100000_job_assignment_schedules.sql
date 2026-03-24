-- Per job assignment: expected weekly hours (for on-time / late / leave-early tracking).

create table if not exists public.job_assignment_schedules (
  id uuid primary key default gen_random_uuid(),
  job_assignment_id uuid not null references public.job_assignments(id) on delete cascade,
  weekly_schedule jsonb not null default '{}'::jsonb,
  timezone text not null default 'America/Denver',
  updated_at timestamptz not null default now(),
  unique (job_assignment_id)
);

comment on column public.job_assignment_schedules.weekly_schedule is
  'Keys: mon..sun. Each: { "enabled": bool, "start": "HH:mm", "end": "HH:mm" } in local job timezone.';

create index if not exists job_assignment_schedules_job_assignment_id on public.job_assignment_schedules(job_assignment_id);

alter table public.job_assignment_schedules enable row level security;

create policy job_assignment_schedules_contractor_all on public.job_assignment_schedules for all using (
  exists (
    select 1 from public.job_assignments ja
    join public.employees e on e.id = ja.employee_id
    where ja.id = job_assignment_schedules.job_assignment_id
      and e.user_id = auth.uid()
  )
);

create policy job_assignment_schedules_employee_select on public.job_assignment_schedules for select using (
  exists (
    select 1 from public.job_assignments ja
    join public.employees e on e.id = ja.employee_id
    where ja.id = job_assignment_schedules.job_assignment_id
      and e.auth_user_id = auth.uid()
  )
);

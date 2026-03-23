-- Time entries: optional link to project work type (what the crew clocked in under).
-- RLS: employees assigned to the job can read work types for clock-in (same pattern as job_geofences).

alter table public.time_entries
  add column if not exists project_work_type_id uuid references public.project_work_types(id) on delete set null;

create index if not exists time_entries_project_work_type_id on public.time_entries(project_work_type_id);

create policy project_work_types_employee_select on public.project_work_types for select using (
  exists (
    select 1
    from public.job_assignments ja
    join public.employees e on e.id = ja.employee_id
    where ja.job_id = project_work_types.project_id
      and ja.ended_at is null
      and e.auth_user_id = auth.uid()
  )
);

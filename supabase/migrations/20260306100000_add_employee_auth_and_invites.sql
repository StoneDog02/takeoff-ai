-- Employee portal: link employees to auth, invite table, RLS for employee access.

-- 1. Link employees to their own auth account (when they accept invite)
alter table public.employees
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists employees_auth_user_id_key on public.employees(auth_user_id) where auth_user_id is not null;

-- 2. Invite table for contractor → employee invite flow
create table if not exists public.employee_invites (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  email text not null,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists employee_invites_token on public.employee_invites(token);
create index if not exists employee_invites_employee_id on public.employee_invites(employee_id);

alter table public.employee_invites enable row level security;

-- Contractor can manage invites for their employees only
create policy employee_invites_contractor_all on public.employee_invites for all using (
  exists (select 1 from public.employees e where e.id = employee_invites.employee_id and e.user_id = auth.uid())
);

-- 3. Employees: allow employee to select/update own row (by auth_user_id)
create policy employees_select_as_employee on public.employees for select using (auth.uid() = auth_user_id);
create policy employees_update_as_employee on public.employees for update using (auth.uid() = auth_user_id);

-- 4. time_entries: employee can select/insert/update own (via employee_id → auth_user_id)
create policy time_entries_employee_select on public.time_entries for select using (
  exists (select 1 from public.employees e where e.id = time_entries.employee_id and e.auth_user_id = auth.uid())
);
create policy time_entries_employee_insert on public.time_entries for insert with check (
  exists (select 1 from public.employees e where e.id = time_entries.employee_id and e.auth_user_id = auth.uid())
);
create policy time_entries_employee_update on public.time_entries for update using (
  exists (select 1 from public.employees e where e.id = time_entries.employee_id and e.auth_user_id = auth.uid())
);

-- 5. attendance_records: employee can select/insert/update/delete own
create policy attendance_records_employee_select on public.attendance_records for select using (
  exists (select 1 from public.employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
);
create policy attendance_records_employee_insert on public.attendance_records for insert with check (
  exists (select 1 from public.employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
);
create policy attendance_records_employee_update on public.attendance_records for update using (
  exists (select 1 from public.employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
);
create policy attendance_records_employee_delete on public.attendance_records for delete using (
  exists (select 1 from public.employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
);

-- 6. job_assignments: employee can only select own (read-only for employee)
create policy job_assignments_employee_select on public.job_assignments for select using (
  exists (select 1 from public.employees e where e.id = job_assignments.employee_id and e.auth_user_id = auth.uid())
);

-- 7. job_geofences: employee can select for jobs they're assigned to
create policy job_geofences_employee_select on public.job_geofences for select using (
  exists (
    select 1 from public.job_assignments ja
    join public.employees e on e.id = ja.employee_id
    where ja.job_id = job_geofences.job_id and ja.ended_at is null and e.auth_user_id = auth.uid()
  )
);

-- 8. gps_clock_out_log: employee can select/insert own
create policy gps_clock_out_log_employee_select on public.gps_clock_out_log for select using (
  exists (select 1 from public.employees e where e.id = gps_clock_out_log.employee_id and e.auth_user_id = auth.uid())
);
create policy gps_clock_out_log_employee_insert on public.gps_clock_out_log for insert with check (
  exists (select 1 from public.employees e where e.id = gps_clock_out_log.employee_id and e.auth_user_id = auth.uid())
);

-- 9. pay_raises: employee can select own (read-only)
create policy pay_raises_employee_select on public.pay_raises for select using (
  exists (select 1 from public.employees e where e.id = pay_raises.employee_id and e.auth_user_id = auth.uid())
);

-- 10. projects: employee can select projects (jobs) they're assigned to
create policy projects_employee_select on public.projects for select using (
  exists (
    select 1 from public.job_assignments ja
    join public.employees e on e.id = ja.employee_id
    where ja.job_id = projects.id and ja.ended_at is null and e.auth_user_id = auth.uid()
  )
);

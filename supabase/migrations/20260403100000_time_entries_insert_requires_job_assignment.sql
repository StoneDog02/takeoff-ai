-- Employees may only insert time entries for jobs they are actively assigned to (matches API enforcement).
drop policy if exists time_entries_employee_insert on public.time_entries;
create policy time_entries_employee_insert on public.time_entries for insert with check (
  exists (select 1 from public.employees e where e.id = time_entries.employee_id and e.auth_user_id = auth.uid())
  and exists (
    select 1 from public.job_assignments ja
    where ja.employee_id = time_entries.employee_id
      and ja.job_id = time_entries.job_id
      and ja.ended_at is null
  )
);

-- Teams / Employee Tracking: employees, job_assignments, time_entries,
-- attendance_records, pay_raises, job_geofences, gps_clock_out_log.
-- RLS: all tables scoped by user_id (owner) via employees or project ownership.

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null default '',
  email text not null,
  phone text default '',
  status text not null default 'off' check (status in ('on_site', 'off', 'pto')),
  current_compensation numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  job_id uuid not null references public.projects(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  role_on_job text default '',
  ended_at timestamptz
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  job_id uuid not null references public.projects(id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz,
  hours numeric,
  source text not null default 'manual' check (source in ('manual', 'gps_auto')),
  gps_clock_out_log_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  date date not null,
  clock_in timestamptz not null,
  clock_out timestamptz,
  late_arrival_minutes int,
  early_departure_minutes int,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.pay_raises (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  effective_date date not null,
  amount_type text not null check (amount_type in ('percent', 'dollar')),
  amount numeric not null,
  previous_rate numeric,
  new_rate numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.job_geofences (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  center_lat numeric not null,
  center_lng numeric not null,
  radius_value numeric not null,
  radius_unit text not null check (radius_unit in ('feet', 'meters')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id)
);

create table if not exists public.gps_clock_out_log (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  job_id uuid not null references public.projects(id) on delete cascade,
  exited_at timestamptz not null,
  lat numeric,
  lng numeric,
  geofence_id uuid references public.job_geofences(id) on delete set null,
  created_at timestamptz not null default now()
);

-- FK from time_entries to gps_clock_out_log (optional; added after gps_clock_out_log exists)
alter table public.time_entries
  add constraint time_entries_gps_clock_out_log_id_fkey
  foreign key (gps_clock_out_log_id) references public.gps_clock_out_log(id) on delete set null;

create index if not exists job_assignments_employee_id on public.job_assignments(employee_id);
create index if not exists job_assignments_job_id on public.job_assignments(job_id);
create index if not exists time_entries_employee_id on public.time_entries(employee_id);
create index if not exists time_entries_job_id on public.time_entries(job_id);
create index if not exists time_entries_clock_in on public.time_entries(clock_in);
create index if not exists attendance_records_employee_id on public.attendance_records(employee_id);
create index if not exists attendance_records_date on public.attendance_records(date);
create index if not exists pay_raises_employee_id on public.pay_raises(employee_id);
create index if not exists job_geofences_job_id on public.job_geofences(job_id);
create index if not exists gps_clock_out_log_job_id on public.gps_clock_out_log(job_id);
create index if not exists gps_clock_out_log_employee_id on public.gps_clock_out_log(employee_id);

alter table public.employees enable row level security;
alter table public.job_assignments enable row level security;
alter table public.time_entries enable row level security;
alter table public.attendance_records enable row level security;
alter table public.pay_raises enable row level security;
alter table public.job_geofences enable row level security;
alter table public.gps_clock_out_log enable row level security;

create policy employees_select on public.employees for select using (auth.uid() = user_id);
create policy employees_insert on public.employees for insert with check (auth.uid() = user_id);
create policy employees_update on public.employees for update using (auth.uid() = user_id);
create policy employees_delete on public.employees for delete using (auth.uid() = user_id);

create policy job_assignments_all on public.job_assignments for all using (
  exists (select 1 from public.employees e where e.id = job_assignments.employee_id and e.user_id = auth.uid())
);

create policy time_entries_all on public.time_entries for all using (
  exists (select 1 from public.employees e where e.id = time_entries.employee_id and e.user_id = auth.uid())
);

create policy attendance_records_all on public.attendance_records for all using (
  exists (select 1 from public.employees e where e.id = attendance_records.employee_id and e.user_id = auth.uid())
);

create policy pay_raises_all on public.pay_raises for all using (
  exists (select 1 from public.employees e where e.id = pay_raises.employee_id and e.user_id = auth.uid())
);

create policy job_geofences_all on public.job_geofences for all using (
  auth.uid() = user_id
  and exists (select 1 from public.projects p where p.id = job_geofences.job_id and p.user_id = auth.uid())
);

create policy gps_clock_out_log_all on public.gps_clock_out_log for all using (
  exists (select 1 from public.employees e where e.id = gps_clock_out_log.employee_id and e.user_id = auth.uid())
);

-- project_tasks: task-level schedule rows (from Custom Build Schedule Excel import or manual add).
-- Drives Gantt task bars and Dashboard "Today's Schedule".
-- RLS: user can only access tasks for their own projects.

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_id uuid references public.phases(id) on delete set null,
  title text not null,
  responsible text default '',
  start_date date not null,
  end_date date not null,
  duration_weeks numeric,
  "order" int not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_project_id on public.project_tasks(project_id);
create index if not exists project_tasks_phase_id on public.project_tasks(phase_id);
create index if not exists project_tasks_start_end on public.project_tasks(start_date, end_date);

alter table public.project_tasks enable row level security;

create policy project_tasks_all on public.project_tasks for all using (
  exists (select 1 from public.projects p where p.id = project_tasks.project_id and p.user_id = auth.uid())
);

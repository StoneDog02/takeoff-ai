-- Project work types: rates for crew to clock in under (e.g. General Labor $85/hr).
-- RLS: same as other project-scoped tables (user owns project).

create table if not exists public.project_work_types (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  rate numeric not null default 0,
  unit text not null default 'hr',
  type_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_work_types_project_id on public.project_work_types(project_id);

alter table public.project_work_types enable row level security;

create policy project_work_types_all on public.project_work_types for all using (
  exists (select 1 from public.projects p where p.id = project_work_types.project_id and p.user_id = auth.uid())
);

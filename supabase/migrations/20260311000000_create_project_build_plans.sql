-- Build plans: PDFs/drawings uploaded for reference on a project.
-- Stored in storage bucket (e.g. job-walk-media or dedicated) under build-plans/ prefix.
create table if not exists public.project_build_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  url text not null,
  uploaded_at timestamptz not null default now(),
  uploader_name text not null default 'Unknown'
);

create index if not exists project_build_plans_project_id on public.project_build_plans(project_id);

alter table public.project_build_plans enable row level security;

create policy project_build_plans_all on public.project_build_plans for all using (
  exists (select 1 from public.projects p where p.id = project_build_plans.project_id and p.user_id = auth.uid())
);

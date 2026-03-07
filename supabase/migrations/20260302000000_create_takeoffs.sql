-- Standalone takeoffs (Build Lists from /takeoff page). Required before
-- create_projects_and_related_tables because project_takeoffs originally
-- referenced this table (that FK is now dropped in a later migration).

create table if not exists public.takeoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  plan_file_name text,
  plan_file_url text,
  material_list jsonb not null default '{"summary": "", "categories": []}'::jsonb,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create index if not exists takeoffs_user_id on public.takeoffs(user_id);

alter table public.takeoffs enable row level security;

create policy takeoffs_select on public.takeoffs for select using (auth.uid() = user_id);
create policy takeoffs_insert on public.takeoffs for insert with check (auth.uid() = user_id);
create policy takeoffs_update on public.takeoffs for update using (auth.uid() = user_id);
create policy takeoffs_delete on public.takeoffs for delete using (auth.uid() = user_id);

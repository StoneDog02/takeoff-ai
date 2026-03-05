-- Global contractor contact list per user (Manage > Contractors).
-- Separate from per-project subcontractors.

create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  trade text not null default '',
  email text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contractors_user_id on public.contractors(user_id);

alter table public.contractors enable row level security;

create policy contractors_select on public.contractors for select using (auth.uid() = user_id);
create policy contractors_insert on public.contractors for insert with check (auth.uid() = user_id);
create policy contractors_update on public.contractors for update using (auth.uid() = user_id);
create policy contractors_delete on public.contractors for delete using (auth.uid() = user_id);

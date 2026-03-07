-- Profiles: app-level role per user (admin, project_manager, etc.). Used for admin dashboard access and future employee portal.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'project_manager' check (role in ('admin', 'project_manager', 'field_supervisor', 'employee', 'subcontractor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role on public.profiles(role);

alter table public.profiles enable row level security;

-- Users can read their own profile (for /api/me and client isAdmin).
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);

-- Only service role can insert/update (e.g. trigger on signup; admin promotion via backend).
-- No policy for insert/update for authenticated role = only service role can write.

-- Trigger: create profile on signup with default role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'project_manager')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

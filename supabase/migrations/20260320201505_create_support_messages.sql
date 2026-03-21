-- Support: user-submitted messages. organization_id references public.orgs (stub table added here; none existed in schema yet).

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.orgs(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  user_email text,
  type text not null check (type in ('bug', 'feature', 'question', 'other')),
  subject text,
  message text not null,
  page_url text,
  page_title text,
  status text not null default 'new' check (status in ('new', 'seen', 'in_progress', 'resolved')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  admin_notes text,
  replied_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb
);

create index if not exists support_messages_organization_id on public.support_messages(organization_id);
create index if not exists support_messages_user_id on public.support_messages(user_id);
create index if not exists support_messages_status_created_at on public.support_messages(status, created_at desc);

alter table public.orgs enable row level security;

alter table public.support_messages enable row level security;

create policy support_messages_insert_own on public.support_messages
  for insert
  with check (auth.uid() is not null and user_id = auth.uid());

create policy support_messages_select_own on public.support_messages
  for select
  using (auth.uid() is not null and user_id = auth.uid());

create policy support_messages_select_admin on public.support_messages
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy support_messages_update_admin on public.support_messages
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

comment on table public.support_messages is 'User support tickets; RLS: owners read/insert own rows; admins read/update all.';
comment on column public.support_messages.metadata is 'Optional client context: browser, screen size, app version, etc.';

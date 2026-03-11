-- Integration connections per user (QuickBooks, Stripe, etc.).
-- Config stores integration-specific data (e.g. OAuth tokens for QuickBooks).

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  integration_id text not null,
  connected boolean not null default false,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, integration_id)
);

create index if not exists integration_connections_user_id on public.integration_connections(user_id);

alter table public.integration_connections enable row level security;

drop policy if exists integration_connections_select on public.integration_connections;
create policy integration_connections_select on public.integration_connections for select using (auth.uid() = user_id);

drop policy if exists integration_connections_insert on public.integration_connections;
create policy integration_connections_insert on public.integration_connections for insert with check (auth.uid() = user_id);

drop policy if exists integration_connections_update on public.integration_connections;
create policy integration_connections_update on public.integration_connections for update using (auth.uid() = user_id);

drop policy if exists integration_connections_delete on public.integration_connections;
create policy integration_connections_delete on public.integration_connections for delete using (auth.uid() = user_id);

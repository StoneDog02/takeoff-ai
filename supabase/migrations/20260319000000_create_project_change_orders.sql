-- Change orders: scope/cost changes that adjust the budget baseline, tagged to a category.
create table if not exists public.project_change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  amount numeric not null default 0,
  status text not null default 'Pending' check (status in ('Approved', 'Pending')),
  date text not null default '',
  category text not null default 'other',
  created_at timestamptz not null default now()
);

create index if not exists project_change_orders_project_id on public.project_change_orders(project_id);

alter table public.project_change_orders enable row level security;

create policy project_change_orders_all on public.project_change_orders for all using (
  exists (select 1 from public.projects p where p.id = project_change_orders.project_id and p.user_id = auth.uid())
);

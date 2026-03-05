-- Projects module: projects, phases, milestones, job_walk_media, budget_line_items,
-- subcontractors, project_takeoffs, trade_packages, sub_bids, bid_sheets.
-- RLS: user can only access own projects (user_id = auth.uid()) and their descendants.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  scope text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  "order" int not null default 0
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_id uuid references public.phases(id) on delete set null,
  title text not null,
  due_date date not null,
  completed boolean not null default false
);

create table if not exists public.job_walk_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  url text not null,
  type text not null check (type in ('photo', 'video')),
  uploaded_at timestamptz not null default now(),
  uploader_name text not null,
  caption text
);

create table if not exists public.budget_line_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  predicted numeric not null default 0,
  actual numeric not null default 0,
  category text not null default 'other'
);

create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  trade text not null,
  email text not null,
  phone text default ''
);

create table if not exists public.project_takeoffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  takeoff_id uuid references public.takeoffs(id) on delete set null,
  material_list jsonb not null default '{"categories": [], "summary": ""}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  trade_tag text not null,
  line_items jsonb not null default '[]'::jsonb
);

create table if not exists public.sub_bids (
  id uuid primary key default gen_random_uuid(),
  trade_package_id uuid not null references public.trade_packages(id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  amount numeric not null,
  notes text,
  awarded boolean not null default false
);

create table if not exists public.bid_sheets (
  project_id uuid primary key references public.projects(id) on delete cascade,
  cost_buckets jsonb not null default '{"awarded_bids":0,"self_supplied_materials":0,"own_labor":0,"overhead_margin":0}'::jsonb,
  proposal_lines jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists phases_project_id on public.phases(project_id);
create index if not exists milestones_project_id on public.milestones(project_id);
create index if not exists job_walk_media_project_id on public.job_walk_media(project_id);
create index if not exists budget_line_items_project_id on public.budget_line_items(project_id);
create index if not exists subcontractors_project_id on public.subcontractors(project_id);
create index if not exists project_takeoffs_project_id on public.project_takeoffs(project_id);
create index if not exists trade_packages_project_id on public.trade_packages(project_id);
create index if not exists sub_bids_trade_package_id on public.sub_bids(trade_package_id);

alter table public.projects enable row level security;
alter table public.phases enable row level security;
alter table public.milestones enable row level security;
alter table public.job_walk_media enable row level security;
alter table public.budget_line_items enable row level security;
alter table public.subcontractors enable row level security;
alter table public.project_takeoffs enable row level security;
alter table public.trade_packages enable row level security;
alter table public.sub_bids enable row level security;
alter table public.bid_sheets enable row level security;

create policy projects_select on public.projects for select using (auth.uid() = user_id);
create policy projects_insert on public.projects for insert with check (auth.uid() = user_id);
create policy projects_update on public.projects for update using (auth.uid() = user_id);
create policy projects_delete on public.projects for delete using (auth.uid() = user_id);

create policy phases_all on public.phases for all using (
  exists (select 1 from public.projects p where p.id = phases.project_id and p.user_id = auth.uid())
);
create policy milestones_all on public.milestones for all using (
  exists (select 1 from public.projects p where p.id = milestones.project_id and p.user_id = auth.uid())
);
create policy job_walk_media_all on public.job_walk_media for all using (
  exists (select 1 from public.projects p where p.id = job_walk_media.project_id and p.user_id = auth.uid())
);
create policy budget_line_items_all on public.budget_line_items for all using (
  exists (select 1 from public.projects p where p.id = budget_line_items.project_id and p.user_id = auth.uid())
);
create policy subcontractors_all on public.subcontractors for all using (
  exists (select 1 from public.projects p where p.id = subcontractors.project_id and p.user_id = auth.uid())
);
create policy project_takeoffs_all on public.project_takeoffs for all using (
  exists (select 1 from public.projects p where p.id = project_takeoffs.project_id and p.user_id = auth.uid())
);
create policy trade_packages_all on public.trade_packages for all using (
  exists (select 1 from public.projects p where p.id = trade_packages.project_id and p.user_id = auth.uid())
);
create policy sub_bids_all on public.sub_bids for all using (
  exists (select 1 from public.trade_packages tp join public.projects p on p.id = tp.project_id where tp.id = sub_bids.trade_package_id and p.user_id = auth.uid())
);
create policy bid_sheets_all on public.bid_sheets for all using (
  exists (select 1 from public.projects p where p.id = bid_sheets.project_id and p.user_id = auth.uid())
);

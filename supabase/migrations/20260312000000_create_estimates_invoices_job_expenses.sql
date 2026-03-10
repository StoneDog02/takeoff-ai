-- Estimates, invoices, estimate line items, job expenses, custom products.
-- Required for the Estimates flow (Pipeline, Receipts, builder).
-- Uses "if not exists" / "add column if not exists" so safe if tables already exist.

-- Custom products (for estimate line items catalog)
create table if not exists public.custom_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  unit text not null default 'ea',
  default_unit_price numeric not null default 0,
  item_type text check (item_type in ('service', 'product', 'labor')),
  created_at timestamptz not null default now()
);

-- Estimates (per job/project)
create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.projects(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Estimate',
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined')),
  total_amount numeric not null default 0,
  invoiced_amount numeric not null default 0,
  recipient_emails jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

-- Estimate line items
create table if not exists public.estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  custom_product_id uuid references public.custom_products(id) on delete set null,
  description text not null default '',
  quantity numeric not null default 1,
  unit text not null default 'ea',
  unit_price numeric not null default 0,
  total numeric not null default 0,
  section text
);

-- Invoices (from estimates or standalone per job)
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid references public.estimates(id) on delete set null,
  job_id uuid references public.projects(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'paid', 'overdue')),
  total_amount numeric not null default 0,
  recipient_emails jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  paid_at timestamptz,
  due_date date
);

-- Job expenses (receipts / spend per project)
create table if not exists public.job_expenses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  category text not null default 'misc' check (category in ('materials', 'labor', 'equipment', 'subs', 'misc')),
  description text,
  receipt_file_url text,
  billable boolean not null default false,
  vendor text,
  created_at timestamptz not null default now()
);

-- Indexes for common filters
create index if not exists idx_estimates_job_id on public.estimates(job_id);
create index if not exists idx_estimates_user_id on public.estimates(user_id);
create index if not exists idx_estimate_line_items_estimate_id on public.estimate_line_items(estimate_id);
create index if not exists idx_invoices_job_id on public.invoices(job_id);
create index if not exists idx_invoices_estimate_id on public.invoices(estimate_id);
create index if not exists idx_job_expenses_job_id on public.job_expenses(job_id);
create index if not exists idx_custom_products_user_id on public.custom_products(user_id);

-- Add columns to existing tables if they were created without them (e.g. job_expenses without billable/vendor)
alter table public.job_expenses add column if not exists billable boolean not null default false;
alter table public.job_expenses add column if not exists vendor text;

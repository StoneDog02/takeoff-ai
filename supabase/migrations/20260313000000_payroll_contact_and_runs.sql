-- Payroll: persist payroll contact per user and audit payroll runs (Approve & Run).

-- 1. Payroll contact: one row per user (who receives the report).
create table if not exists public.payroll_contact (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  phone text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payroll_contact enable row level security;

create policy payroll_contact_own on public.payroll_contact for all using (auth.uid() = user_id);
create policy payroll_contact_insert_own on public.payroll_contact for insert with check (auth.uid() = user_id);
create policy payroll_contact_update_own on public.payroll_contact for update using (auth.uid() = user_id);

-- 2. Payroll runs: audit log when user confirms "Approve & Run".
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_from timestamptz not null,
  period_to timestamptz not null,
  recipient_email text not null,
  recipient_name text default '',
  employee_count int not null default 0,
  total_hours numeric not null default 0,
  gross_pay numeric not null default 0,
  sent_at timestamptz not null default now()
);

create index if not exists payroll_runs_user_id on public.payroll_runs(user_id);
create index if not exists payroll_runs_sent_at on public.payroll_runs(sent_at);

alter table public.payroll_runs enable row level security;

create policy payroll_runs_select_own on public.payroll_runs for select using (auth.uid() = user_id);
create policy payroll_runs_insert_own on public.payroll_runs for insert with check (auth.uid() = user_id);

-- Ensure invoice portal columns exist (repair DBs that skipped 20260320120000 or pre-date it).
alter table public.invoices add column if not exists client_token text unique;
alter table public.invoices add column if not exists schedule_snapshot jsonb;
alter table public.invoices add column if not exists viewed_at timestamptz;

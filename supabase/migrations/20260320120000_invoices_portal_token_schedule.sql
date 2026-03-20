-- Client-facing invoice portal: token link + optional milestone schedule snapshot
alter table public.invoices add column if not exists client_token text unique;
alter table public.invoices add column if not exists schedule_snapshot jsonb;
alter table public.invoices add column if not exists viewed_at timestamptz;

comment on column public.invoices.client_token is 'Public portal token for /invoice/:token (set when invoice is sent)';
comment on column public.invoices.schedule_snapshot is 'Progress invoice: milestone rows with amounts and due settings at send time';

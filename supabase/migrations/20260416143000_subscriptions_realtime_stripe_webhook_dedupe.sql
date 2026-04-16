-- Realtime: so clients receive postgres_changes on subscriptions (webhook / edge updates).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'subscriptions'
  ) then
    alter publication supabase_realtime add table public.subscriptions;
  end if;
end $$;

-- Idempotent Stripe webhook processing (duplicate endpoints / retries share the same event.id).
create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

comment on table public.stripe_webhook_events is
  'Stripe event.id log for webhook idempotency; service role only.';

alter table public.stripe_webhook_events enable row level security;

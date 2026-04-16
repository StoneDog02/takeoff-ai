-- Serialize initial subscription creation in Edge `create-subscription` across parallel invocations.
-- Without this, two concurrent requests both pass the Stripe list check before either POST completes.
create table if not exists public.initial_subscription_create_lock (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.initial_subscription_create_lock is
  'First caller inserts; concurrent signups poll until Stripe sub exists. Row kept after success to block duplicate creates.';

alter table public.initial_subscription_create_lock enable row level security;

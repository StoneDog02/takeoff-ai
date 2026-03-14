-- Subscriptions: keep Stripe subscription state in sync with Stripe webhooks.
-- Written by backend (service role) only; users read their own row via API.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  status text not null default 'trialing' check (status in (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'
  )),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id on public.subscriptions(user_id);
create index if not exists subscriptions_stripe_subscription_id on public.subscriptions(stripe_subscription_id);
create index if not exists subscriptions_stripe_customer_id on public.subscriptions(stripe_customer_id);

alter table public.subscriptions enable row level security;

-- Users can read their own subscription.
create policy subscriptions_select_own on public.subscriptions for select using (auth.uid() = user_id);

-- No insert/update/delete for anon or authenticated; only service role (backend) writes.

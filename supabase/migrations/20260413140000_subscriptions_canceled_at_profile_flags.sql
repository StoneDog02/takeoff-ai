-- Webhook-driven billing UX flags + subscription cancellation time.
alter table public.subscriptions
  add column if not exists canceled_at timestamptz;

comment on column public.subscriptions.canceled_at is 'Set when Stripe sends customer.subscription.deleted (or canceled_at from payload when available).';

alter table public.profiles
  add column if not exists trial_ending_soon boolean not null default false,
  add column if not exists payment_failed boolean not null default false;

comment on column public.profiles.trial_ending_soon is 'Set by Stripe customer.subscription.trial_will_end webhook (~3 days before trial ends).';
comment on column public.profiles.payment_failed is 'Set by invoice.payment_failed; cleared on successful payment.';

-- Signup / billing: store chosen tier, add-ons, seats, and trial end from create-subscription edge function.
alter table public.subscriptions
  add column if not exists tier text,
  add column if not exists addons jsonb not null default '[]'::jsonb,
  add column if not exists employees int not null default 5,
  add column if not exists trial_ends_at timestamptz;

comment on column public.subscriptions.tier is 'Signup tier: core | plus | pro';
comment on column public.subscriptions.addons is 'JSON array of addon ids from pricing wizard';
comment on column public.subscriptions.employees is 'Field payroll seat count (wizard)';
comment on column public.subscriptions.trial_ends_at is 'Stripe subscription trial_end (UTC)';

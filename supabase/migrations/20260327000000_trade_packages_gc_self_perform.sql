-- GC self-performed scope: in-house pricing / line items per trade (alternative to sub bids).
alter table public.trade_packages
  add column if not exists gc_self_perform boolean not null default false,
  add column if not exists gc_estimate_lines jsonb not null default '[]'::jsonb;

comment on column public.trade_packages.gc_self_perform is 'GC is doing this trade in-house; subs not required for this scope.';
comment on column public.trade_packages.gc_estimate_lines is 'Line items [{description, quantity, unit, unit_price}] for estimate when GC self-performs.';

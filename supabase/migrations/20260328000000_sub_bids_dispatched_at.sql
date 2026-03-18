-- When the bid portal link was sent (initial dispatch or resend).
alter table public.sub_bids
  add column if not exists dispatched_at timestamptz;

comment on column public.sub_bids.dispatched_at is 'When the bid portal link was last dispatched to the sub.';

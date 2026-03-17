-- Tracks sub response for portal: pending | bid_received | awarded | declined
alter table public.sub_bids
  add column if not exists response_status text default 'pending';

comment on column public.sub_bids.response_status is 'Portal response: pending, bid_received, awarded, declined.';

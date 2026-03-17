alter table public.sub_bids
  add column if not exists responded_at timestamptz;

comment on column public.sub_bids.responded_at is 'When the sub submitted or declined the bid.';

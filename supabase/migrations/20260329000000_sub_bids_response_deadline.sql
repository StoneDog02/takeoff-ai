-- Optional deadline for the sub to respond via the bid portal.
alter table public.sub_bids
  add column if not exists response_deadline timestamptz;

comment on column public.sub_bids.response_deadline is 'When the GC expects a bid by (shown on bid portal).';

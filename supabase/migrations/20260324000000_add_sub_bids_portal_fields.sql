-- Portal tracking and submit fields for sub bid.
alter table public.sub_bids
  add column if not exists viewed_at timestamptz,
  add column if not exists availability text,
  add column if not exists quote_url text;

comment on column public.sub_bids.viewed_at is 'When the sub opened the portal link.';
comment on column public.sub_bids.availability is 'Estimated start date or lead time from sub.';
comment on column public.sub_bids.quote_url is 'URL of attached quote PDF from sub.';

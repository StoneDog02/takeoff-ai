-- Token for subcontractor bid portal: one-time link sent when bid is dispatched.
-- Used at /bid/[token] for sub to view scope and submit bid.

alter table public.sub_bids
  add column if not exists portal_token text unique;

create unique index if not exists sub_bids_portal_token_key on public.sub_bids (portal_token) where portal_token is not null;

comment on column public.sub_bids.portal_token is 'Cryptographic token for sub bid portal link; set when bid is dispatched.';

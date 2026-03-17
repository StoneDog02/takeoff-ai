-- Client portal token for estimate approval link: /estimate/[token]
alter table public.estimates
  add column if not exists client_token text unique;

comment on column public.estimates.client_token is 'Unique token for client approval portal link; set when estimate is sent.';

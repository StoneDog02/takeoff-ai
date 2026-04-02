-- Electronic acceptance timestamp when client approves via portal (scope, pricing, terms).
alter table public.estimates add column if not exists portal_client_acceptance_at timestamptz;

comment on column public.estimates.portal_client_acceptance_at is
  'Set when the client approves via the portal after confirming scope, pricing, and terms (electronic acceptance).';

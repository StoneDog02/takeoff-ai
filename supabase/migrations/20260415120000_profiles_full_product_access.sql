-- Allow selected accounts to use the full product UI without matching subscription add-ons/tier.
alter table public.profiles
  add column if not exists full_product_access boolean not null default false;

comment on column public.profiles.full_product_access is
  'When true, the app treats the user as entitled to every feature flag (e.g. demo/partner PM accounts). Admins already bypass in the client.';

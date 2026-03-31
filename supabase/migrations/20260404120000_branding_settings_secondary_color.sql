-- Second brand color for invoice headings, accents (Settings → Branding).
alter table public.branding_settings
  add column if not exists secondary_color text;

comment on column public.branding_settings.secondary_color is 'Secondary brand color for typography accents on client invoices (e.g. section titles).';

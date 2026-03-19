-- Provenance for budget rows (e.g. client-approved estimate vs manual GC entry)
alter table public.budget_line_items
  add column if not exists source text;

comment on column public.budget_line_items.source is 'Optional origin, e.g. estimate when predicted came from an approved estimate.';

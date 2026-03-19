-- Optional unit of measure for budget line items (UI + reporting).

alter table public.budget_line_items
  add column if not exists unit text;

comment on column public.budget_line_items.unit is 'Unit of measure for the line (e.g. hr, sf, ls); optional.';

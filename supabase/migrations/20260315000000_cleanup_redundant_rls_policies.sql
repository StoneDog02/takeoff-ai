-- Cleanup: drop redundant RLS policies and fix custom_products.item_type check.
-- Run after rls_estimates_invoices_job_expenses. See docs/DATABASE_DIAGNOSTIC.md.

-- 1. Drop legacy "Users can manage own X" policies (redundant with per-operation policies).
drop policy if exists "Users can manage own custom_products" on public.custom_products;
drop policy if exists "Users can manage own estimates" on public.estimates;
drop policy if exists "Users can manage estimate_line_items for own estimates" on public.estimate_line_items;
drop policy if exists "Users can manage own invoices" on public.invoices;
drop policy if exists "Users can manage own job_expenses" on public.job_expenses;

-- 2. Allow 'labor' in custom_products.item_type (app uses service | product | labor).
-- Drop existing item_type check (name may vary by migration) then re-add with labor.
do $$
declare
  c name;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.custom_products'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%item_type%'
  loop
    execute format('alter table public.custom_products drop constraint %I', c);
  end loop;
end $$;

alter table public.custom_products
  add constraint custom_products_item_type_check
  check (item_type = any (array['service'::text, 'product'::text, 'labor'::text]));

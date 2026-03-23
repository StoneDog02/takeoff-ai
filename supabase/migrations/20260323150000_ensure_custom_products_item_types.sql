-- Ensure custom_products.item_type allows all types used by the app (estimate lines, add-product modal).
-- Safe if 20260317000001 already ran: drops and recreates the same check.

do $$
declare
  c text;
begin
  select conname
    into c
  from pg_constraint
  where conrelid = 'public.custom_products'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%item_type%';

  if c is not null then
    execute format('alter table public.custom_products drop constraint %I', c);
  end if;
end $$;

alter table public.custom_products
  add constraint custom_products_item_type_check
  check (item_type is null or item_type in ('service', 'product', 'labor', 'sub', 'material', 'equipment'));

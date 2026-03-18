-- Extend custom products catalog to support richer product/service presets.
-- Adds fields used by the Add Product form and allows the new "sub" type.

alter table public.custom_products
  add column if not exists sub_cost numeric,
  add column if not exists markup_pct numeric,
  add column if not exists billed_price numeric,
  add column if not exists trades jsonb not null default '[]'::jsonb,
  add column if not exists taxable boolean not null default false;

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
  check (item_type in ('service', 'product', 'labor', 'sub', 'material', 'equipment'));

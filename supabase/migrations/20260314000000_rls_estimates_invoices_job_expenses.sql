-- RLS for estimates, invoices, job_expenses, custom_products, estimate_line_items.
-- Scopes access by user_id (and for estimate_line_items by parent estimate ownership).

alter table public.custom_products enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_line_items enable row level security;
alter table public.invoices enable row level security;
alter table public.job_expenses enable row level security;

-- custom_products: owner only
create policy custom_products_select on public.custom_products for select using (auth.uid() = user_id);
create policy custom_products_insert on public.custom_products for insert with check (auth.uid() = user_id);
create policy custom_products_update on public.custom_products for update using (auth.uid() = user_id);
create policy custom_products_delete on public.custom_products for delete using (auth.uid() = user_id);

-- estimates: owner only
create policy estimates_select on public.estimates for select using (auth.uid() = user_id);
create policy estimates_insert on public.estimates for insert with check (auth.uid() = user_id);
create policy estimates_update on public.estimates for update using (auth.uid() = user_id);
create policy estimates_delete on public.estimates for delete using (auth.uid() = user_id);

-- estimate_line_items: via parent estimate ownership
create policy estimate_line_items_select on public.estimate_line_items for select using (
  exists (select 1 from public.estimates e where e.id = estimate_line_items.estimate_id and e.user_id = auth.uid())
);
create policy estimate_line_items_insert on public.estimate_line_items for insert with check (
  exists (select 1 from public.estimates e where e.id = estimate_line_items.estimate_id and e.user_id = auth.uid())
);
create policy estimate_line_items_update on public.estimate_line_items for update using (
  exists (select 1 from public.estimates e where e.id = estimate_line_items.estimate_id and e.user_id = auth.uid())
);
create policy estimate_line_items_delete on public.estimate_line_items for delete using (
  exists (select 1 from public.estimates e where e.id = estimate_line_items.estimate_id and e.user_id = auth.uid())
);

-- invoices: owner only
create policy invoices_select on public.invoices for select using (auth.uid() = user_id);
create policy invoices_insert on public.invoices for insert with check (auth.uid() = user_id);
create policy invoices_update on public.invoices for update using (auth.uid() = user_id);
create policy invoices_delete on public.invoices for delete using (auth.uid() = user_id);

-- job_expenses: owner only
create policy job_expenses_select on public.job_expenses for select using (auth.uid() = user_id);
create policy job_expenses_insert on public.job_expenses for insert with check (auth.uid() = user_id);
create policy job_expenses_update on public.job_expenses for update using (auth.uid() = user_id);
create policy job_expenses_delete on public.job_expenses for delete using (auth.uid() = user_id);

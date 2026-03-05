-- Add extended fields to projects for in-depth New Project form.
-- Address, schedule, estimated value, assignee (free-text).

alter table public.projects
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists expected_start_date date,
  add column if not exists expected_end_date date,
  add column if not exists estimated_value numeric,
  add column if not exists assigned_to_name text;

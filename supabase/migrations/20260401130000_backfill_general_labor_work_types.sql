-- Jobs created before General Labor auto-seed: add the row where missing (idempotent).

insert into public.project_work_types (project_id, name, description, rate, unit, type_key)
select p.id,
  'General Labor',
  'Pay rate comes from each employee’s profile (hourly rate).',
  0,
  'hr',
  'labor'
from public.projects p
where not exists (
  select 1
  from public.project_work_types w
  where w.project_id = p.id
    and w.type_key = 'labor'
    and lower(trim(w.name)) = 'general labor'
);

-- When a project was marked completed (for UX: "recently completed" shelf). Null if not completed.
alter table public.projects add column if not exists completed_at timestamptz;

comment on column public.projects.completed_at is 'Set when status becomes completed; cleared when status moves off completed.';

-- Non-completed rows should not carry a completion timestamp
update public.projects
set completed_at = null
where completed_at is not null
  and lower(trim(coalesce(status, ''))) <> 'completed';

-- Backfill existing completed projects (best-effort: use updated_at)
update public.projects
set completed_at = coalesce(completed_at, updated_at, created_at)
where lower(trim(coalesce(status, ''))) = 'completed'
  and completed_at is null;

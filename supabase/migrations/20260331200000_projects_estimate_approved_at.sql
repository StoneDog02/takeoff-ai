-- When the client approves an estimate, we record the timestamp so post-approval budget lines can be flagged as scope changes (CO).
alter table public.projects
  add column if not exists estimate_approved_at timestamptz;

comment on column public.projects.estimate_approved_at is 'Set when an estimate for this project is first accepted; used to flag budget lines added afterward.';

-- Add job_id to conversations for job-based group chats (one conversation per job).
-- job_id references projects.id (job = project in this codebase).

alter table if exists public.conversations
  add column if not exists job_id uuid references public.projects(id) on delete set null;

create unique index if not exists conversations_job_id_key
  on public.conversations (job_id) where job_id is not null;

comment on column public.conversations.job_id is 'When set, this conversation is the group chat for this job (project).';

-- Paper-trail documents bucket (estimates, invoices, change orders, bid packages, etc.).
-- project_id is nullable with ON DELETE SET NULL so deleting a project unlinks rows instead of removing history.
-- organization_id is the GC account owner (auth user), consistent with projects.user_id until a dedicated org model exists.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  document_type text not null check (document_type in (
    'estimate',
    'invoice',
    'change_order',
    'bid_package',
    'receipt',
    'sub_contract'
  )),
  title text,
  status text,
  total_amount numeric,
  client_name text,
  client_email text,
  token text,
  source_id uuid,
  file_url text,
  sent_at timestamptz,
  viewed_at timestamptz,
  actioned_at timestamptz,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.documents is 'Audit / paper trail for financial and client-facing docs; survives project deletion via SET NULL on project_id.';
comment on column public.documents.organization_id is 'GC account (auth user). Matches projects.user_id for rows tied to a project.';
comment on column public.documents.source_id is 'Originating record id (estimate, invoice, bid, etc.); polymorphic — no FK.';
comment on column public.documents.token is 'Optional portal access token for client/sub-facing links.';

create index if not exists documents_organization_id on public.documents(organization_id);
create index if not exists documents_project_id on public.documents(project_id);
create index if not exists documents_document_type on public.documents(document_type);
create index if not exists documents_created_at on public.documents(created_at);

create unique index if not exists documents_token_key on public.documents(token) where token is not null;

alter table public.documents enable row level security;

create policy documents_select on public.documents for select using (auth.uid() = organization_id);
create policy documents_insert on public.documents for insert with check (auth.uid() = organization_id);
create policy documents_update on public.documents for update using (auth.uid() = organization_id);
create policy documents_delete on public.documents for delete using (auth.uid() = organization_id);

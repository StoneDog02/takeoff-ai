-- Bid documents: PDFs/files uploaded for reference (bids received from subs).
-- Stored in storage under bid-documents/ prefix.
create table if not exists public.project_bid_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  url text not null,
  uploaded_at timestamptz not null default now(),
  uploader_name text not null default 'Unknown'
);

create index if not exists project_bid_documents_project_id on public.project_bid_documents(project_id);

alter table public.project_bid_documents enable row level security;

create policy project_bid_documents_all on public.project_bid_documents for all using (
  exists (select 1 from public.projects p where p.id = project_bid_documents.project_id and p.user_id = auth.uid())
);

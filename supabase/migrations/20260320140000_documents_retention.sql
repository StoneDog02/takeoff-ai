-- Paper-trail documents: no client deletes via RLS; unlink + annotate metadata when a project is removed.

-- When a project row is deleted, clear project_id on related documents and preserve the former project identity in metadata.
create or replace function public.documents_unlink_on_project_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.documents d
  set
    project_id = null,
    metadata = coalesce(d.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'original_project_id', to_jsonb(old.id::text),
        'original_project_name', to_jsonb(coalesce(old.name, ''))
      )
  where d.project_id = old.id;
  return old;
end;
$$;

drop trigger if exists tr_documents_unlink_on_project_delete on public.projects;
create trigger tr_documents_unlink_on_project_delete
  before delete on public.projects
  for each row
  execute procedure public.documents_unlink_on_project_delete();

comment on function public.documents_unlink_on_project_delete() is
  'Before project delete: nulls documents.project_id and sets metadata.original_project_id / original_project_name.';

-- Authenticated users must not hard-delete paper-trail rows (archive via PATCH instead).
drop policy if exists documents_delete on public.documents;

-- GC/client notes, terms, and grouped estimate snapshot for portal + revise flow.
alter table public.estimates
  add column if not exists client_notes text,
  add column if not exists client_terms text,
  add column if not exists estimate_groups_meta jsonb;

comment on column public.estimates.client_notes is 'GC notes shown to client on estimate portal (whole document).';
comment on column public.estimates.client_terms is 'Terms shown to client on estimate portal.';
comment on column public.estimates.estimate_groups_meta is 'Snapshot of LineItemGroup[] for revise + per-section notes.';

-- Standalone invoices are not tied to a project; job_id may be null.
-- Safe if the column is already nullable (DROP NOT NULL is a no-op then).
alter table public.invoices alter column job_id drop not null;

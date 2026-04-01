-- Allow cron / server auto-close of stale open time entries (browser geofence cannot run in background).

alter table public.time_entries drop constraint if exists time_entries_source_check;

alter table public.time_entries
  add constraint time_entries_source_check
  check (source in ('manual', 'gps_auto', 'server_auto'));

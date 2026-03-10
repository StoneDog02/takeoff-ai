# Supabase schema and migrations

## Existing migrations

The `migrations/` folder contains historical SQL migrations that define the current schema (takeoffs, projects, employees, time_entries, attendance_records, pay_raises, job_geofences, gps_clock_out_log, etc.). These have already been applied to the linked Supabase project (e.g. via Dashboard or CLI).

## Future schema changes: use Supabase MCP

**For new schema changes, use the Supabase MCP server instead of adding new local migration files.**

1. **Apply changes via MCP**  
   Use the Cursor Supabase MCP tool `apply_migration`: provide the migration name (snake_case) and the SQL. This applies the migration to the linked project and records it in Supabase’s migration history.

2. **Keep the server in sync**  
   The Express server in `server/routes/` and `server/db/supabase.js` expects the same table and column names. After applying a migration via MCP, update any server code that needs to use new tables or columns.

3. **Optional: mirror applied migrations locally**  
   If you want a local paper trail, you can add a `.sql` file under `migrations/` that matches what was applied via MCP (e.g. copy the same SQL). This is for reference only; the source of truth for “what’s applied” is Supabase’s migration history.

## Why MCP instead of local-only migrations

- Single source of truth: migrations are applied and tracked in the Supabase project.
- No need to run `supabase db push` or manual SQL copy-paste for new changes.
- Cursor can apply and verify schema changes via MCP when implementing features.

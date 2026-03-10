# Database Diagnostic — Takeoff App (Proj-X)

**Project:** Takeoff App (Supabase)  
**Date:** 2026-03-09

## Summary

- **No duplicate tables** — All 39 `public` tables are distinct; no redundant copies.
- **Redundant RLS policies** — Five tables have both legacy "Users can manage own X" (FOR ALL) and the newer per-operation policies; the legacy ones can be dropped.
- **Missing migration** — `payroll_contact` and `payroll_runs` are referenced by the server but **do not exist** in the DB; apply the payroll migration.
- **Schema mismatch** — `custom_products.item_type` in the DB allows only `service` | `product`; the app and types also use `labor`; the check constraint should include `labor`.
- **Optional** — `user_dismissed_alerts` has no FK from `user_id` to `auth.users`; consider adding one. `company_settings` and `branding_settings` both have `logo_url` (potential future consolidation).

---

## 1. Redundant RLS policies (recommended cleanup)

These tables have **two sets** of policies that grant the same access:

| Table | Legacy policy (redundant) | Newer policies (keep) |
|-------|---------------------------|------------------------|
| `custom_products` | `Users can manage own custom_products` (FOR ALL) | `custom_products_select`, `_insert`, `_update`, `_delete` |
| `estimates` | `Users can manage own estimates` (FOR ALL) | `estimates_select`, `_insert`, `_update`, `_delete` |
| `estimate_line_items` | `Users can manage estimate_line_items for own estimates` (FOR ALL) | `estimate_line_items_select`, `_insert`, `_update`, `_delete` |
| `invoices` | `Users can manage own invoices` (FOR ALL) | `invoices_select`, `_insert`, `_update`, `_delete` |
| `job_expenses` | `Users can manage own job_expenses` (FOR ALL) | `job_expenses_select`, `_insert`, `_update`, `_delete` |

**Action:** Drop the five legacy "Users can manage..." policies so only the per-operation policies remain. See migration `supabase/migrations/20260315000000_cleanup_redundant_rls_policies.sql`.

---

## 2. Missing tables: payroll

The server uses:

- `payroll_contact` — e.g. in `server/routes/payroll.js`
- `payroll_runs` — same

These tables **do not exist** in the current database (they were never applied via the migration that exists in the repo).

**Action:** Apply `supabase/migrations/20260313000000_payroll_contact_and_runs.sql` to the Takeoff App project (e.g. via Supabase Dashboard SQL Editor or MCP `apply_migration`).

---

## 3. custom_products.item_type check

- **DB:** `item_type` check allows only `'service'` and `'product'`.
- **App:** TypeScript type `CustomProductItemType = 'service' | 'product' | 'labor'` and UI use `labor`.

Inserts/updates with `item_type = 'labor'` will fail the check.

**Action:** Alter the check to include `'labor'`. See migration `20260315000000_cleanup_redundant_rls_policies.sql` (same file as the policy cleanup).

---

## 4. Migration history vs repo

The Supabase project has migrations applied with **different version IDs** than the filenames in `supabase/migrations/`. The applied migrations cover the same logical changes (projects, estimates, teams, profiles, etc.). No need to re-apply those. Only ensure:

- Payroll migration is applied (creates `payroll_contact`, `payroll_runs`).
- Cleanup migration is applied (drop redundant policies, fix `custom_products.item_type`).

---

## 5. Tables with zero rows (informational)

Empty tables that may be intentional or for future use:

- `prompt_config`, `contractors`, `company_settings`, `branding_settings`, `notification_preferences`, `geofence_defaults`, `tax_compliance_settings`, `integration_connections`
- Messaging: `conversations`, `conversation_participants`, `messages`, `conversation_reads`
- `user_dismissed_alerts`, `job_geofences`, `gps_clock_out_log`, `employee_invites`
- Various project-related: `job_walk_media`, `project_takeoffs`, `trade_packages`, `sub_bids`, `bid_sheets`, `custom_products`, `job_expenses`, `invoices`, `attendance_records`, `pay_raises`, `job_assignments`, `time_entries`

No cleanup required unless you decide to drop an unused feature.

---

## 6. Extensions

Only standard Supabase extensions are in use (`pgcrypto`, `pg_stat_statements`, `uuid-ossp`, `plpgsql`, `pg_graphql`, `supabase_vault`). No redundant or unused extensions detected.

---

## Next steps

1. **Apply payroll migration** so `payroll_contact` and `payroll_runs` exist.
2. **Apply cleanup migration** to drop redundant RLS policies and add `labor` to `custom_products.item_type` check.
3. (Optional) Add FK on `user_dismissed_alerts.user_id` → `auth.users(id)` and consider consolidating `logo_url` in company/branding settings later.

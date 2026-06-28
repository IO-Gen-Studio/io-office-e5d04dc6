## Goal

Introduce a tenant-scoped fiscal year concept. Admin defines fiscal years (with a configurable start month); a global year selector in the top header sets the active year, and every list, dashboard KPI, calendar view and export is filtered by that year using each module's natural business date.

## Database (one migration)

- New table `public.fiscal_years` (tenant_id, label e.g. "FY2026", start_date, end_date, is_current bool). Unique (tenant_id, label); only one `is_current=true` per tenant (partial unique index).
- New table `public.fiscal_year_settings` (tenant_id PK, start_month smallint 1–12 default 1). Stores the tenant's fiscal-year start month so new years can be auto-suggested.
- RLS: tenant-scoped via `current_tenant_id()`; read = any tenant member, write = admins. Standard GRANTs.
- Seed helper: on first read, if a tenant has no fiscal years, auto-create the year containing today using `start_month` and mark it `is_current`.

## Settings — "Financial Year" tab

New page `src/routes/_authenticated/settings.fiscal-year.tsx` (admin only, added to settings nav):

- Input for fiscal year start month (1–12).
- Table of fiscal years with label, from, to, "current" toggle, edit, delete.
- "Add year" action — pre-fills from/to using `start_month` and last year + 1.
- Editing a year past data does not move records; the filter is computed at query time.

## Global year selector

- New `FiscalYearProvider` (`src/lib/fiscal-year.tsx`) exposing `{ years, activeYear, setActiveYear }`. Active year persisted in `localStorage` per tenant, defaults to the `is_current` year.
- Add a compact `<FiscalYearSelect />` dropdown in the top header of the authenticated layout (`src/routes/_authenticated.tsx`), visible on desktop and mobile. Shows e.g. "FY2026 ▾".

## Date field per module (business date)

The active year provides `{ start, end }` ISO dates. Each list query filters by that range using the module's natural date:


| Module             | Date column                                                 |
| ------------------ | ----------------------------------------------------------- |
| Projects & Works   | `start_date` (fallback `created_at`)                        |
| Subscriptions      | `renewal_date` (fallback `start_date`)                      |
| Issues             | `issue_date`                                                |
| Social plans       | `scheduled_at`                                              |
| Calendar events    | overlap of `date`..`end_date` with year range               |
| Outreach campaigns | `created_at`                                                |
| CRM contacts/orgs  | `created_at`                                                |
| Activity log       | `created_at`                                                |
| Cost Proposal PDF  | uses active year for the "as at" date filter on items shown |


Dashboard KPIs (`dashboard.tsx`) re-scoped to the active year using the same per-module date.

## UI behaviour

- Tables: year filter applies on top of existing search/filter UI; a small "FY2026" chip near the page title indicates the active scope and links to the header selector.
- Calendar: month navigation is clamped to the active year (prev/next disabled at year boundaries).
- "All years" option in the selector for admins, for occasional cross-year lookups.
- Switching years calls `queryClient.invalidateQueries()` so all views refetch.

## Cost Proposal export

Generator already takes pre-filtered cost items. The Export buttons pass the active year window so only items dated within it are summed; a "Financial year: FY2026" line is added under the date in the PDF header. - skip this for now.

## Out of scope

- Rolling/period comparisons (YoY).
- Reassigning records between years.
- Per-user year preferences (it is per-tenant, stored locally per user).

## Technical notes

- Provider mounts inside `_authenticated.tsx` so it has access to the current tenant.
- All Supabase reads that currently use `.select(...)` get an additional `.gte(dateCol, start).lte(dateCol, end)` (or `or(...)` for calendar overlap) gated on `activeYear !== 'all'`.
- No schema change to existing tables — purely additive.
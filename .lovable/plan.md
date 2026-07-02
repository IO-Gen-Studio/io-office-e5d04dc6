# Leads Module

Building the "Refined CRM" direction (v2): warm cream background, deep navy accents, rounded-2xl cards, KPI strip on top, single table with dashed-border editable Next Action cells and a linked-contact chip. Fits the existing app system.

## 1. Database (migration)

New tables:

- `leads` — `id, tenant_id, contact_id (nullable, FK contacts), first_name, last_name, job_title, company_name, organisation_id (nullable), email, phone, status_id (FK lead_status_options — already exists), intent ('high'|'medium'|'low'), source, opportunity_gbp numeric, assigned_to (FK profiles), next_action_id (FK lead_next_action_options), next_action_date date, notes text, created_at, updated_at`.
- `lead_next_action_options` — `id, tenant_id, label, position, active`. Seeded with: Intro Outreach, Meeting Scheduled, Send Proposal, Follow-up Call, Pricing Discussion, Closed.
- `lead_source_options` — `id, tenant_id, label, position, active`. Seeded with: LinkedIn, Referral, Website, Event, Cold Email, Other.
- `lead_field_labels` — `id, tenant_id, field_key, label, visible, position`. Seeded with every lead field so admins can rename column headers / form labels in Settings.

Reuse existing `lead_status_options` table for the Status dropdown.

RLS: standard tenant-scoped policies mirroring `contacts` (can_view / can_edit on `crm` module). GRANTs to `authenticated` + `service_role`.

Trigger: when a lead is inserted without `contact_id`, auto-create a matching row in `contacts` (is_lead = true) and store its id back on the lead. Two-way link maintained.

## 2. Sidebar

`src/routes/_authenticated.tsx` — add `{ to: "/leads", label: "Leads", icon: Sparkles, module: "crm" }` in the `BIZ_DEV` array immediately after Contacts.

## 3. Leads page — `src/routes/_authenticated/leads.tsx`

Layout (v2 direction):

- Page header: "Leads" + subtitle.
- KPI row (5 cards, fiscal-year scoped): Total Leads, Qualified Leads (status = Qualified), Conversion Rate, Pipeline Value (sum of opportunity_gbp in GBP), Avg Response Time (from created_at → first next_action_date).
- Toolbar: search, filter (status/intent/assigned/source), Export, Import CSV, primary "Add Lead" button.
- Table columns: #, Lead (name + job @ company + link icon if a contact exists), Status pill, Intent (dot + High/Med/Low), Source, Opportunity (£ GBP formatted), Assigned (avatar + name from `profiles`), Next Action (inline dropdown), Action Date, Notes (truncated, tooltip full).
- Pagination footer.

Add Lead side sheet (matches Issues editor pattern):

- All fields above.
- Assigned = dropdown of tenant users (from `profiles` via `tenant_members`).
- Next Action = dropdown from `lead_next_action_options`.
- Status = dropdown from `lead_status_options`.
- Source = dropdown from `lead_source_options`.
- Notes = textarea.
- "Also link/create contact" — enabled by default; supports `QuickCreateContactDialog` to pick or create.

## 4. Contact ↔ Lead sync

- Creating a lead auto-creates/links a contact (trigger above).
- On the Contacts page, add a "Convert to Lead" action per row that creates a `leads` row pre-filled from the contact and links back via `contact_id`.
- Show a small link icon on both sides when the counterpart exists.

## 5. Calendar integration

- Extend `src/routes/_authenticated/calendar.tsx` upcoming/data loader to include leads with `next_action_date` in range as a new event kind "Lead Action" (colour: teal). Clicking opens the lead.
- Dashboard "Upcoming this week" widget already aggregates categories — add the same lead source there.

## 6. Notifications

- When `assigned_to` changes or a lead is created with an assignee, insert a `notifications` row for that user ("New lead: {name}" / "Lead reassigned to you").
- When `next_action_date` is set/changed, insert a reminder notification for the assignee.

## 7. Settings

New route `src/routes/_authenticated/settings.leads.tsx` (admin only). Three panels:

- **Field labels** — editable list from `lead_field_labels` (label, visible toggle, position).
- **Statuses** — CRUD on `lead_status_options` (reuses existing shape).
- **Next Action options** — CRUD on `lead_next_action_options`.
- **Sources** — CRUD on `lead_source_options`.

Add link to it in `src/routes/_authenticated/settings.tsx` sidebar.

## 8. Formatting

- All monetary values formatted as GBP via `Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })`; extend `src/lib/format.ts` if needed.
- All list queries filtered by active fiscal year via existing `useFiscalYear`.

## Technical notes

- Migration order: enums/tables → GRANTs → RLS → policies → seed option rows → trigger.
- Reuse `DataTable`, `QuickCreateContactDialog`, `QuickCreateOrgDialog`, existing `Sheet` editor pattern.
- No new deps.

Before building show me options for the design first to approve. I didn't see anything to approve.
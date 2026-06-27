## Goal

Let a Project/Work optionally be linked to a Subscription so the subscription appears as an extra "good to know" line in the project's Cost Breakdown, and printing the Cost Proposal asks whether to include it. Same the other way round for Subscriptions referencing their Project. No automatic double-counting in totals.

## Database (one migration)

Add `subscriptions.project_id uuid null` referencing `public.projects(id) on delete set null`, plus an index. RLS already covers subscriptions by tenant, so no policy changes; existing GRANTs stay.

## Subscription form / detail

- Add a "Linked Project / Work" selector on the Subscription create+edit form (searchable dropdown of projects in the current tenant, with a "None" option). Persists to `subscriptions.project_id`.
- Show the linked project name (with a link) on the subscription detail view.

## Project & Works — Cost Breakdown

In `src/components/CostBreakdown.tsx` (or the section that renders it inside `projects.tsx`):

- Below the existing project cost items, when one or more subscriptions are linked to this project, render a clearly-separated "Linked subscription" block listing each subscription with: plan name, billing cycle, cost, renewal date. Styled as informational (muted background, "Not included in totals" hint). Linked to the subscription detail.
- The project's existing total stays unchanged — subscription rows do NOT contribute to the project cost total. No double counting.

## Cost Proposal printing

When the user clicks "Export PDF" on either side:

- If the record has a counterpart link (project has linked subscription(s), or subscription has a linked project), open a small confirm dialog: "Include the linked {subscription / project & works} in this Cost Proposal?" with Yes / No / Cancel.
- If Yes: build a combined PDF — keep one items table per source, each under its own sub-heading ("Project & Works" / "Subscription — <plan name>"), with a per-section subtotal and a single Grand Total = sum of both (no row counted twice; subscription items come from the subscription's own current cost version, project items from the project's). Include the "Renewal due" line for the subscription section.
- If No: behaviour is unchanged — only the originating record is printed.
- Update `src/lib/cost-proposal-pdf.ts` to accept an optional second `items` block + section headings, render two tables when present, and compute totals per section + grand total.
- Update the Export buttons in `projects.tsx` and `subscriptions.tsx` to fetch the linked record's items when the user confirms Yes, then call the updated generator.

## Out of scope

- Linking a project to multiple subscriptions for printing (we include all linked subscriptions if the user confirms Yes).
- Reordering / editing the merged PDF layout beyond the two-section structure.
- Any change to how costs are stored or rolled up elsewhere in the app.

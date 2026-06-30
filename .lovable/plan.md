# Dashboard Redesign — Sophisticated Ops Hub

Rewrite `src/routes/_authenticated/dashboard.tsx` to match the selected v3 prototype using real data, scoped to the active fiscal year via `useFiscalYear()`.

## Layout

1. Header — title + subtitle (no "Create campaign" button; not required by spec).
2. **KPI row (4 cards, clickable)** — keep existing counts, wrap each in a `<Link>`:
  - Contacts → `/crm`
  - Active campaigns → `/outreach`
  - Open projects → `/projects`
  - Active subscriptions → `/subscriptions`
3. **Ops Activities panel** — single card, 4 divided columns:
  - Projects (count where `type='project'`, in-range)
  - Works (count where `type='work'`, in-range)
  - Subscriptions (active, in-range)
  - Issues (status != resolved, in-range by `issue_date`)
4. **Lower 3-col grid:**
  - **Email Outreach** — active campaign count + mini monthly bar chart of campaigns created per month within fiscal year.
  - **Social Schedule** — current week strip (Mon–Sun, today highlighted navy) + list of next ~3 upcoming `social_plans` (status=draft/approved, `scheduled_at >= now`), color-pilled by platform (Instagram=amber, LinkedIn=rose, Twitter=sky, Facebook=blue, default=slate). Each shows title + time + platform.
  - **Upcoming this week** — next ~5 `events` between today and end-of-week, with left color bar by `event_type` (reusing color map from calendar: holiday=emerald, webinar=indigo, exhibition=amber, milestone=blue, renewal=purple, social=rose, default=slate). Each row links to `/calendar`.

## Data fetching

Single `useEffect` driven by `range` from `useFiscalYear()`. Parallel Supabase queries:

- Counts (head:true): contacts, campaigns(active), projects(in_progress, type=project), works(in_progress, type=work), subscriptions(active), issues(status!=resolved). Apply fiscal-year date filters where field exists (matches existing dashboard pattern).
- Social: `social_plans` select id,title,platform,scheduled_at,approval_status,post_status where `scheduled_at >= now` and `post_status != 'posted'`, order asc, limit 3.
- Events: `events` select id,title,start_date,end_date,event_type where `start_date` between today and Sunday, order asc, limit 5.
- Email bar chart: aggregate `campaigns` created_at by month within fiscal year on the client.

## Styling

Use existing semantic tokens (`bg-card`, `border-border/60`, `text-primary`, `text-muted-foreground`, `shadow-soft`) — do NOT hardcode `#103A8E` / `#FAF7F2` / `#E5E1DA`. Map prototype's navy → `text-primary` / `bg-primary`, cream → `bg-background`, stone borders → `border-border/60`. Keep `rounded-2xl` cards. Mini bars use `bg-primary/10` with active month `bg-primary`.

## Files touched

- `src/routes/_authenticated/dashboard.tsx` — full rewrite.

No DB migrations, no new packages, no other files changed.
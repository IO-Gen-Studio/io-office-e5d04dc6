import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Card } from "@/components/ui/card";
import { useFiscalYear } from "@/lib/fiscal-year";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

type SocialRow = {
  id: string;
  title: string | null;
  platform: string;
  scheduled_at: string | null;
};
type UpcomingItem = {
  key: string;
  date: string; // YYYY-MM-DD
  title: string;
  time: string | null;
  kind: "event" | "milestone" | "renewal" | "post" | "project" | "bank_holiday";
  eventType: string | null;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function startOfWeek(d: Date) {
  const x = new Date(d); x.setHours(0,0,0,0);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  return x;
}
function fmtLocalDate(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const da = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}
function platformPill(p: string): { wrap: string; dot: string; title: string; sub: string } {
  switch (p) {
    case "instagram": return { wrap: "bg-amber-100/60 border-amber-200", dot: "bg-amber-500", title: "text-amber-950", sub: "text-amber-800/70" };
    case "linkedin":  return { wrap: "bg-rose-100/60 border-rose-200",   dot: "bg-rose-500",  title: "text-rose-950",  sub: "text-rose-800/70" };
    case "twitter":   return { wrap: "bg-sky-100/60 border-sky-200",     dot: "bg-sky-500",   title: "text-sky-950",   sub: "text-sky-800/70" };
    case "facebook":  return { wrap: "bg-blue-100/60 border-blue-200",   dot: "bg-blue-500",  title: "text-blue-950",  sub: "text-blue-800/70" };
    default:          return { wrap: "bg-muted border-border/60",        dot: "bg-muted-foreground", title: "text-foreground", sub: "text-muted-foreground" };
  }
}
function kindBar(item: UpcomingItem): string {
  if (item.kind === "milestone") return "bg-blue-500";
  if (item.kind === "post") return "bg-purple-500";
  if (item.kind === "renewal") return "bg-amber-500";
  if (item.kind === "project") return "bg-slate-500";
  if (item.kind === "bank_holiday") return "bg-rose-500";
  switch (item.eventType) {
    case "team_holiday": return "bg-rose-500";
    case "conference":   return "bg-emerald-500";
    case "exhibition":   return "bg-indigo-500";
    default:             return "bg-primary";
  }
}

function Dashboard() {
  const { profile } = useAuth();
  const { range } = useFiscalYear();
  const [counts, setCounts] = useState({ contacts: 0, campaigns: 0, projects: 0, subscriptions: 0 });
  const [ops, setOps] = useState({ projects: 0, works: 0, subscriptions: 0, issues: 0 });
  const [emailMonthly, setEmailMonthly] = useState<number[]>(Array(12).fill(0));
  const [social, setSocial] = useState<SocialRow[]>([]);
  const [events, setEvents] = useState<UpcomingItem[]>([]);

  useEffect(() => {
    (async () => {
      // KPI counts (kept compatible with previous dashboard)
      let contactsQ = supabase.from("contacts").select("*", { count: "exact", head: true });
      let campaignsQ = supabase.from("campaigns").select("*", { count: "exact", head: true });
      let projectsKpiQ = supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "in_progress");
      let subsKpiQ = supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active");

      // Ops Activities
      let projOpsQ = supabase.from("projects").select("*", { count: "exact", head: true }).eq("type", "project");
      let workOpsQ = supabase.from("projects").select("*", { count: "exact", head: true }).eq("type", "work");
      let subOpsQ = supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active");
      let issuesOpsQ = supabase.from("issues").select("*", { count: "exact", head: true }).neq("status", "resolved");

      if (range) {
        contactsQ = contactsQ.gte("created_at", range.start).lte("created_at", `${range.end}T23:59:59`);
        campaignsQ = campaignsQ.gte("created_at", range.start).lte("created_at", `${range.end}T23:59:59`);
        projectsKpiQ = projectsKpiQ.gte("start_date", range.start).lte("start_date", range.end);
        subsKpiQ = subsKpiQ.gte("renewal_date", range.start).lte("renewal_date", range.end);
        projOpsQ = projOpsQ.gte("start_date", range.start).lte("start_date", range.end);
        workOpsQ = workOpsQ.gte("start_date", range.start).lte("start_date", range.end);
        subOpsQ = subOpsQ.gte("renewal_date", range.start).lte("renewal_date", range.end);
        issuesOpsQ = issuesOpsQ.gte("issue_date", range.start).lte("issue_date", range.end);
      }

      // Email monthly aggregation
      let emailRowsQ = supabase.from("campaigns").select("created_at");
      if (range) emailRowsQ = emailRowsQ.gte("created_at", range.start).lte("created_at", `${range.end}T23:59:59`);

      // Social schedule — next upcoming, not posted
      const nowIso = new Date().toISOString();
      const socialQ = supabase
        .from("social_plans")
        .select("id,title,platform,scheduled_at,post_status")
        .neq("post_status", "posted")
        .gte("scheduled_at", nowIso)
        .order("scheduled_at", { ascending: true })
        .limit(4);

      // Upcoming this week — gather from all calendar sources
      const today = new Date();
      const wkStart = startOfWeek(today);
      const wkEnd = new Date(wkStart); wkEnd.setDate(wkEnd.getDate() + 6);
      const todayStr = fmtLocalDate(today);
      const wkEndStr = fmtLocalDate(wkEnd);

      // Events: include multi-day events whose range overlaps [today, wkEnd]
      const eventsQ = supabase
        .from("events")
        .select("id,title,event_date,end_date,start_time,event_type")
        .lte("event_date", wkEndStr)
        .or(`end_date.gte.${todayStr},and(end_date.is.null,event_date.gte.${todayStr})`)
        .order("event_date", { ascending: true });
      const milestonesQ = supabase
        .from("milestones").select("id,label,due_date")
        .gte("due_date", todayStr).lte("due_date", wkEndStr);
      const renewalsQ = supabase
        .from("subscriptions").select("id,plan_name,renewal_date")
        .gte("renewal_date", todayStr).lte("renewal_date", wkEndStr);
      const projectsDueQ = supabase
        .from("projects").select("id,title,end_date")
        .gte("end_date", todayStr).lte("end_date", wkEndStr);
      const postsQ = supabase
        .from("social_plans").select("id,title,copy,platform,scheduled_at")
        .gte("scheduled_at", `${todayStr}T00:00:00`)
        .lte("scheduled_at", `${wkEndStr}T23:59:59`);

      const [
        kContacts, kCampaigns, kProjects, kSubs,
        oProj, oWork, oSub, oIss,
        eRows, sRows, evRows, msRows, rnRows, pjRows, pcRows,
      ] = await Promise.all([
        contactsQ, campaignsQ, projectsKpiQ, subsKpiQ,
        projOpsQ, workOpsQ, subOpsQ, issuesOpsQ,
        emailRowsQ, socialQ, eventsQ, milestonesQ, renewalsQ, projectsDueQ, postsQ,
      ]);

      setCounts({
        contacts: kContacts.count ?? 0,
        campaigns: kCampaigns.count ?? 0,
        projects: kProjects.count ?? 0,
        subscriptions: kSubs.count ?? 0,
      });
      setOps({
        projects: oProj.count ?? 0,
        works: oWork.count ?? 0,
        subscriptions: oSub.count ?? 0,
        issues: oIss.count ?? 0,
      });

      const monthly = Array(12).fill(0) as number[];
      ((eRows.data as { created_at: string }[] | null) ?? []).forEach((r) => {
        const m = new Date(r.created_at).getMonth();
        monthly[m] += 1;
      });
      setEmailMonthly(monthly);
      setSocial((sRows.data as SocialRow[] | null) ?? []);

      // Build merged upcoming list
      const up: UpcomingItem[] = [];
      ((evRows.data as { id: string; title: string; event_date: string; end_date: string | null; start_time: string | null; event_type: string | null }[] | null) ?? []).forEach((e) => {
        // Show on the first day within the week window
        const firstShown = e.event_date < todayStr ? todayStr : e.event_date;
        up.push({ key: `ev-${e.id}`, date: firstShown, title: e.title, time: e.start_time, kind: "event", eventType: e.event_type });
      });
      ((msRows.data as { id: string; label: string; due_date: string }[] | null) ?? []).forEach((m) =>
        up.push({ key: `ms-${m.id}`, date: m.due_date, title: `Milestone: ${m.label}`, time: null, kind: "milestone", eventType: null }));
      ((rnRows.data as { id: string; plan_name: string; renewal_date: string }[] | null) ?? []).forEach((r) =>
        up.push({ key: `rn-${r.id}`, date: r.renewal_date, title: `Renewal: ${r.plan_name}`, time: null, kind: "renewal", eventType: null }));
      ((pjRows.data as { id: string; title: string; end_date: string }[] | null) ?? []).forEach((p) =>
        up.push({ key: `pj-${p.id}`, date: p.end_date, title: `Due: ${p.title}`, time: null, kind: "project", eventType: null }));
      ((pcRows.data as { id: string; title: string | null; copy: string | null; platform: string; scheduled_at: string }[] | null) ?? []).forEach((s) =>
        up.push({ key: `pc-${s.id}`, date: s.scheduled_at.slice(0, 10), title: `${s.platform}: ${(s.title || s.copy || "").slice(0, 40)}`, time: s.scheduled_at.slice(11, 16), kind: "post", eventType: null }));
      // UK bank holidays this week
      const { UK_BANK_HOLIDAYS } = await import("@/lib/uk-bank-holidays");
      UK_BANK_HOLIDAYS.filter((h) => h.date >= todayStr && h.date <= wkEndStr).forEach((h) =>
        up.push({ key: `bh-${h.date}`, date: h.date, title: `🇬🇧 ${h.title}`, time: null, kind: "bank_holiday", eventType: null }));

      up.sort((a, b) => (a.date === b.date ? (a.time ?? "").localeCompare(b.time ?? "") : a.date.localeCompare(b.date)));
      setEvents(up);
    })();
  }, [range?.start, range?.end]);

  const kpis = [
    { label: "Contacts", value: counts.contacts, to: "/crm" as const },
    { label: "Active campaigns", value: counts.campaigns, to: "/outreach" as const },
    { label: "Open projects", value: counts.projects, to: "/projects" as const },
    { label: "Active subscriptions", value: counts.subscriptions, to: "/subscriptions" as const },
  ];

  const opsCells = [
    { label: "Projects", value: ops.projects },
    { label: "Works", value: ops.works },
    { label: "Subscriptions", value: ops.subscriptions },
    { label: "Issues", value: ops.issues },
  ];

  const totalSent = useMemo(() => emailMonthly.reduce((a, b) => a + b, 0), [emailMonthly]);
  const maxMonthly = Math.max(1, ...emailMonthly);
  const currentMonth = new Date().getMonth();

  const today = new Date();
  const wkStart = startOfWeek(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(wkStart); d.setDate(d.getDate() + i); return d;
  });
  const todayKey = fmtLocalDate(today);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Here's a snapshot of your business.</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            to={k.to}
            className="group bg-card p-5 rounded-2xl border border-border/60 shadow-soft hover:border-primary hover:shadow-floating transition-all"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{k.label}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl md:text-3xl font-bold text-primary">{k.value}</span>
              <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Ops Activities */}
      <Card className="rounded-2xl border-border/60 shadow-soft p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-primary text-lg">Ops Activities</h2>
          <span className="text-xs text-muted-foreground font-medium">Current financial year</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-border/60">
          {opsCells.map((c, i) => (
            <div key={c.label} className={i === 0 ? "md:px-6 first:pl-0" : "md:px-6"}>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{c.label}</span>
              <div className="flex items-end gap-2 mt-1">
                <span className="text-3xl font-bold text-foreground">{String(c.value).padStart(2, "0")}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Lower grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email Outreach */}
        <Card className="rounded-2xl border-border/60 shadow-soft p-6 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-primary">Email Outreach</h3>
            <Link to="/outreach" className="text-xs text-muted-foreground hover:text-primary">View all →</Link>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{totalSent}</span>
            <span className="text-xs text-muted-foreground">Campaigns this year</span>
          </div>
          <div className="mt-8 flex items-end justify-between h-32 gap-1.5">
            {emailMonthly.map((v, i) => (
              <div
                key={i}
                title={`${MONTHS[i]}: ${v}`}
                className={`w-full rounded-t-lg transition-all ${i === currentMonth ? "bg-primary" : "bg-primary/10 hover:bg-primary/20"}`}
                style={{ height: `${Math.max(6, (v / maxMonthly) * 100)}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 px-0.5 text-[10px] text-muted-foreground font-medium">
            {MONTHS.map((m, i) => (
              <span key={m} className={i === currentMonth ? "text-primary font-bold" : ""}>{m[0]}</span>
            ))}
          </div>
        </Card>

        {/* Social Schedule */}
        <Card className="rounded-2xl border-border/60 shadow-soft overflow-hidden">
          <div className="p-6 pb-2">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-primary">Social Schedule</h3>
              <Link to="/social" className="text-xs text-muted-foreground hover:text-primary">Plan →</Link>
            </div>
            <div className="flex justify-between mb-2">
              {weekDays.map((d, i) => {
                const key = fmtLocalDate(d);
                const isToday = key === todayKey;
                return (
                  <div key={key} className="flex flex-col items-center gap-1">
                    <span className={`text-[10px] font-bold ${isToday ? "text-primary" : "text-muted-foreground"}`}>{WEEK[i].toUpperCase()}</span>
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${isToday ? "bg-primary text-primary-foreground shadow-floating" : "text-foreground"}`}>
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-4 pb-6 space-y-2 mt-2">
            {social.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No upcoming social posts.</p>
            ) : (
              social.slice(0, 3).map((p) => {
                const s = platformPill(p.platform);
                const dt = p.scheduled_at ? new Date(p.scheduled_at) : null;
                return (
                  <Link
                    key={p.id}
                    to="/social"
                    className={`block p-3 rounded-xl border ${s.wrap} flex items-center gap-3 hover:shadow-soft transition-shadow`}
                  >
                    <div className="w-8 h-8 bg-card/80 rounded-lg flex items-center justify-center shrink-0">
                      <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${s.title}`}>{p.title || "Untitled post"}</p>
                      <p className={`text-[10px] ${s.sub} truncate`}>
                        {dt ? dt.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "Unscheduled"} · {p.platform}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </Card>

        {/* Upcoming this week */}
        <Card className="rounded-2xl border-border/60 shadow-soft p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-primary">Upcoming this week</h3>
            <Link to="/calendar" className="text-xs text-muted-foreground hover:text-primary">Calendar →</Link>
          </div>
          <div className="space-y-4">
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No events this week.</p>
            ) : (
              events.slice(0, 5).map((e) => {
                const d = new Date(`${e.event_date}T00:00:00`);
                const time = e.start_time ? e.start_time.slice(0, 5) : "All day";
                return (
                  <Link key={e.id} to="/calendar" className="flex items-start gap-3 group">
                    <div className={`w-1 h-9 rounded-full mt-1 shrink-0 ${eventBar(e.event_type)}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.toLocaleDateString(undefined, { weekday: "short" })}, {time}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

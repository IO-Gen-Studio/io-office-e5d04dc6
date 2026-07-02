import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { logActivity } from "@/lib/activity";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Plus, Pencil, Trash2, Flame, Target, PoundSterling, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { formatDateUK } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/leads")({ component: LeadsPage });

type Lead = {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  contact_id: string | null;
  organisation_id: string | null;
  status_id: string | null;
  intent: "high" | "medium" | "low" | null;
  source_id: string | null;
  opportunity_gbp: number | null;
  assigned_to: string | null;
  next_action_id: string | null;
  next_action_date: string | null;
  notes: string | null;
  created_at: string;
};

type StatusOpt = { id: string; key: string; label: string; color: string };
type Opt = { id: string; label: string };
type Profile = { id: string; full_name: string | null; email: string | null };
type Org = { id: string; name: string };
type FieldLabels = Record<string, string>;

const INTENTS: { value: "high" | "medium" | "low"; label: string; color: string }[] = [
  { value: "high", label: "High", color: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "medium", label: "Medium", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "low", label: "Low", color: "bg-slate-100 text-slate-700 border-slate-200" },
];

const statusChip = (color: string) => {
  const map: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
    indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    rose: "bg-rose-100 text-rose-700 border-rose-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return map[color] ?? map.slate;
};

const gbp = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

function LeadsPage() {
  const { canEdit, activeTenantId, user } = useAuth();
  const editable = canEdit("crm");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [statuses, setStatuses] = useState<StatusOpt[]>([]);
  const [actions, setActions] = useState<Opt[]>([]);
  const [sources, setSources] = useState<Opt[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [labels, setLabels] = useState<FieldLabels>({});
  const [editing, setEditing] = useState<Lead | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [{ data: ls }, { data: st }, { data: ac }, { data: so }, { data: pr }, { data: or }, { data: lf }] =
      await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("lead_pipeline_status_options").select("id,key,label,color").eq("active", true).order("position"),
        supabase.from("lead_next_action_options").select("id,label").eq("active", true).order("position"),
        supabase.from("lead_source_options").select("id,label").eq("active", true).order("position"),
        supabase.from("profiles").select("id,full_name,email").eq("active", true).order("full_name"),
        supabase.from("organisations").select("id,name").order("name"),
        supabase.from("lead_field_labels").select("field_key,label"),
      ]);
    setLeads((ls ?? []) as Lead[]);
    setStatuses((st ?? []) as StatusOpt[]);
    setActions((ac ?? []) as Opt[]);
    setSources((so ?? []) as Opt[]);
    setProfiles((pr ?? []) as Profile[]);
    setOrgs((or ?? []) as Org[]);
    const map: FieldLabels = {};
    (lf ?? []).forEach((r) => { map[r.field_key as string] = r.label as string; });
    setLabels(map);
  };
  useEffect(() => { void load(); }, []);

  const L = (k: string, fallback: string) => labels[k] ?? fallback;

  const kpis = useMemo(() => {
    const total = leads.length;
    const value = leads.reduce((s, l) => s + Number(l.opportunity_gbp ?? 0), 0);
    const hot = leads.filter((l) => l.intent === "high").length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const actionsThisWeek = leads.filter((l) => {
      if (!l.next_action_date) return false;
      const d = new Date(l.next_action_date + "T00:00:00");
      return d >= today && d <= in7;
    }).length;
    return { total, value, hot, actionsThisWeek };
  }, [leads]);

  const remove = async (l: Lead) => {
    if (!confirm(`Delete lead "${l.first_name} ${l.last_name}"?`)) return;
    const { error } = await supabase.from("leads").delete().eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    await logActivity({ module: "crm", entity_type: "lead", entity_id: l.id, verb: "deleted", summary: `Deleted lead ${l.first_name} ${l.last_name}` });
    toast.success("Deleted"); void load();
  };

  const saveCell = async (row: Lead, key: string, value: unknown) => {
    const prev = row[key as keyof Lead];
    const patch: Record<string, unknown> = { [key]: value === "" ? null : value };
    const { error } = await supabase.from("leads").update(patch as never).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    if (key === "assigned_to" && value && value !== prev && activeTenantId && value !== user?.id) {
      await supabase.from("notifications").insert({
        user_id: String(value), tenant_id: activeTenantId,
        type: "lead_assignment", title: "Lead assigned to you",
        body: `${row.first_name} ${row.last_name}${row.company_name ? " · " + row.company_name : ""}`,
        link: "/leads",
      });
    }
    void load();
  };

  const columns: DataTableColumn<Lead>[] = [
    {
      key: "lead", header: L("lead", "Lead"),
      accessor: (r) => `${r.first_name} ${r.last_name}`,
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">
            {(r.first_name[0] ?? "").toUpperCase()}{(r.last_name[0] ?? "").toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{r.first_name} {r.last_name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {r.job_title ? `${r.job_title}` : ""}{r.job_title && r.company_name ? " · " : ""}{r.company_name ?? ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status_id", header: L("status", "Status"),
      accessor: (r) => statuses.find((s) => s.id === r.status_id)?.label ?? "",
      render: (r) => {
        const s = statuses.find((x) => x.id === r.status_id);
        return s ? <Badge variant="outline" className={statusChip(s.color)}>{s.label}</Badge> : <span className="text-muted-foreground">—</span>;
      },
      editable, type: "select",
      options: statuses.map((s) => ({ value: s.id, label: s.label })),
    },
    {
      key: "intent", header: L("intent", "Intent"),
      accessor: (r) => r.intent ?? "",
      render: (r) => {
        const i = INTENTS.find((x) => x.value === r.intent);
        return i ? <Badge variant="outline" className={i.color}><Flame className="size-3 mr-1" />{i.label}</Badge> : <span className="text-muted-foreground">—</span>;
      },
      editable, type: "select",
      options: INTENTS.map((i) => ({ value: i.value, label: i.label })),
    },
    {
      key: "source_id", header: L("source", "Source"),
      accessor: (r) => sources.find((s) => s.id === r.source_id)?.label ?? "",
      editable, type: "select",
      options: sources.map((s) => ({ value: s.id, label: s.label })),
    },
    {
      key: "opportunity_gbp", header: L("opportunity", "Opportunity"),
      accessor: (r) => r.opportunity_gbp ?? 0,
      render: (r) => <span className="font-medium tabular-nums">{gbp(r.opportunity_gbp)}</span>,
      editable, type: "number", align: "right",
    },
    {
      key: "assigned_to", header: L("assigned", "Assigned"),
      accessor: (r) => profiles.find((p) => p.id === r.assigned_to)?.full_name ?? "",
      render: (r) => {
        const p = profiles.find((x) => x.id === r.assigned_to);
        if (!p) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-primary/10 text-primary grid place-items-center text-[10px] font-semibold">
              {(p.full_name ?? p.email ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm truncate">{p.full_name ?? p.email}</span>
          </div>
        );
      },
      editable, type: "select",
      options: profiles.map((p) => ({ value: p.id, label: p.full_name ?? p.email ?? "" })),
    },
    {
      key: "next_action_id", header: L("next_action", "Next Action"),
      accessor: (r) => actions.find((a) => a.id === r.next_action_id)?.label ?? "",
      editable, type: "select",
      options: actions.map((a) => ({ value: a.id, label: a.label })),
    },
    {
      key: "next_action_date", header: L("next_action_date", "Action Date"),
      accessor: (r) => r.next_action_date ?? "",
      render: (r) => r.next_action_date ? <span className="text-sm">{formatDateUK(r.next_action_date)}</span> : <span className="text-muted-foreground">—</span>,
      editable, type: "date",
    },
    {
      key: "notes", header: L("notes", "Notes"),
      accessor: (r) => r.notes ?? "",
      render: (r) => <span className="text-sm text-muted-foreground line-clamp-2 max-w-[240px]">{r.notes ?? "—"}</span>,
    },
  ];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-1">Track and progress potential new opportunities.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Target className="size-4" />} label="Total Leads" value={String(kpis.total)} />
        <KpiCard icon={<PoundSterling className="size-4" />} label="Pipeline Value" value={gbp(kpis.value)} />
        <KpiCard icon={<Flame className="size-4" />} label="Hot Leads" value={String(kpis.hot)} />
        <KpiCard icon={<CalendarClock className="size-4" />} label="Actions This Week" value={String(kpis.actionsThisWeek)} />
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <DataTable
            tableKey="leads.main"
            columns={columns}
            rows={leads}
            rowId={(r) => r.id}
            onSaveCell={saveCell}
            emptyMessage="No leads yet."
            toolbarLeft={editable && (
              <Button className="bg-gradient-primary text-primary-foreground" onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus className="size-4 mr-2" />New lead
              </Button>
            )}
            actions={editable ? (l) => (
              <>
                <Button variant="ghost" size="icon" aria-label="Edit lead" onClick={() => { setEditing(l); setOpen(true); }}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Delete lead" onClick={() => remove(l)}><Trash2 className="size-4" /></Button>
              </>
            ) : undefined}
          />
        </CardContent>
      </Card>

      <LeadSheet
        open={open} onOpenChange={setOpen} lead={editing}
        statuses={statuses} actions={actions} sources={sources} profiles={profiles} orgs={orgs}
        labels={labels} activeTenantId={activeTenantId} currentUserId={user?.id ?? null}
        onSaved={load}
      />
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function LeadSheet({
  open, onOpenChange, lead, statuses, actions, sources, profiles, orgs, labels,
  activeTenantId, currentUserId, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; lead: Lead | null;
  statuses: StatusOpt[]; actions: Opt[]; sources: Opt[]; profiles: Profile[]; orgs: Org[];
  labels: FieldLabels; activeTenantId: string | null; currentUserId: string | null;
  onSaved: () => void;
}) {
  const L = (k: string, f: string) => labels[k] ?? f;
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orgId, setOrgId] = useState<string>("__none__");
  const [statusId, setStatusId] = useState<string>("__none__");
  const [intent, setIntent] = useState<string>("__none__");
  const [sourceId, setSourceId] = useState<string>("__none__");
  const [oppty, setOppty] = useState<string>("");
  const [assigned, setAssigned] = useState<string>("__none__");
  const [nextAction, setNextAction] = useState<string>("__none__");
  const [nextDate, setNextDate] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setFirst(lead?.first_name ?? ""); setLast(lead?.last_name ?? "");
    setJobTitle(lead?.job_title ?? ""); setCompany(lead?.company_name ?? "");
    setEmail(lead?.email ?? ""); setPhone(lead?.phone ?? "");
    setOrgId(lead?.organisation_id ?? "__none__");
    setStatusId(lead?.status_id ?? "__none__");
    setIntent(lead?.intent ?? "__none__");
    setSourceId(lead?.source_id ?? "__none__");
    setOppty(lead?.opportunity_gbp != null ? String(lead.opportunity_gbp) : "");
    setAssigned(lead?.assigned_to ?? "__none__");
    setNextAction(lead?.next_action_id ?? "__none__");
    setNextDate(lead?.next_action_date ?? "");
    setNotes(lead?.notes ?? "");
  }, [lead, open]);

  const submit = async () => {
    if (!first.trim() && !last.trim() && !company.trim()) { toast.error("Enter a name or company"); return; }
    const payload = {
      first_name: first, last_name: last,
      job_title: jobTitle || null, company_name: company || null,
      email: email || null, phone: phone || null,
      organisation_id: orgId === "__none__" ? null : orgId,
      status_id: statusId === "__none__" ? null : statusId,
      intent: intent === "__none__" ? null : (intent as "high" | "medium" | "low"),
      source_id: sourceId === "__none__" ? null : sourceId,
      opportunity_gbp: oppty ? Number(oppty) : null,
      assigned_to: assigned === "__none__" ? null : assigned,
      next_action_id: nextAction === "__none__" ? null : nextAction,
      next_action_date: nextDate || null,
      notes: notes || null,
    };
    if (lead) {
      const { error } = await supabase.from("leads").update(payload as never).eq("id", lead.id);
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "crm", entity_type: "lead", entity_id: lead.id, verb: "updated", summary: `Updated lead ${first} ${last}` });
    } else {
      const { data, error } = await supabase.from("leads").insert({ ...payload, created_by: currentUserId } as never).select().single();
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "crm", entity_type: "lead", entity_id: data.id, verb: "created", summary: `Created lead ${first} ${last}` });
    }
    if (payload.assigned_to && activeTenantId && payload.assigned_to !== currentUserId && payload.assigned_to !== lead?.assigned_to) {
      await supabase.from("notifications").insert({
        user_id: payload.assigned_to, tenant_id: activeTenantId,
        type: "lead_assignment", title: "Lead assigned to you",
        body: `${first} ${last}${company ? " · " + company : ""}`,
        link: "/leads",
      });
    }
    toast.success("Saved"); onOpenChange(false); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{lead ? "Edit lead" : "New lead"}</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name"><Input value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
            <Field label="Last name"><Input value={last} onChange={(e) => setLast(e.target.value)} /></Field>
            <Field label="Job title"><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></Field>
            <Field label="Company"><Input value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          </div>
          <Field label="Organisation">
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={L("status", "Status")}>
              <Select value={statusId} onValueChange={setStatusId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={L("intent", "Intent")}>
              <Select value={intent} onValueChange={setIntent}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {INTENTS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={L("source", "Source")}>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={`${L("opportunity", "Opportunity")} (£)`}>
              <Input type="number" inputMode="decimal" value={oppty} onChange={(e) => setOppty(e.target.value)} placeholder="0" />
            </Field>
            <Field label={L("assigned", "Assigned")}>
              <Select value={assigned} onValueChange={setAssigned}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={L("next_action", "Next Action")}>
              <Select value={nextAction} onValueChange={setNextAction}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {actions.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={L("next_action_date", "Action Date")}>
              <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
            </Field>
          </div>
          <Field label={L("notes", "Notes")}>
            <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Free-text notes on this lead…" />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="bg-gradient-primary text-primary-foreground" onClick={submit}>Save lead</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { logActivity } from "@/lib/activity";
import { formatGBP, formatDateUK } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Plus, Pencil, Trash2, FolderOpen, ChevronDown, FileDown, List as ListIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { generateCostProposalPdf, fetchCostItems } from "@/lib/cost-proposal-pdf";
import { toast } from "sonner";
import { CustomFieldValues } from "@/components/CustomFieldValues";
import { QuickCreateOrgDialog, QuickCreateContactDialog } from "@/components/QuickCreateCrm";
import { CustomFieldDisplay, useCustomFieldColumns } from "@/components/CustomFieldDisplay";
import { CostBreakdown } from "@/components/CostBreakdown";
import { TodoList } from "@/components/TodoList";
import { useBuiltinFieldLabel, useBuiltinFieldOptions } from "@/lib/builtin-labels";
import { useFiscalYear } from "@/lib/fiscal-year";
import type { Database } from "@/integrations/supabase/types";

type SStatus = Database["public"]["Enums"]["subscription_status"];
type Sub = {
  id: string; plan_name: string; cost: number; billing_cycle: string;
  renewal_date: string | null; status: SStatus; client_org_id: string | null; client_contact_id: string | null;
  description: string | null;
  project_id: string | null;
  custom: Record<string, unknown> | null;
};
type LinkedProject = { id: string; title: string; type: string };
type Org = { id: string; name: string };
type Contact = { id: string; first_name: string; last_name: string; organisation_id: string | null };
type Milestone = { id: string; parent_id: string; parent_type: string; label: string; due_date: string | null; completed_at: string | null; is_custom: boolean; position: number };
type MTemplate = { id: string; label: string; position: number; module: string; project_type: string | null };
type PlanOpt = { id: string; label: string; position: number };

export const Route = createFileRoute("/_authenticated/subscriptions")({ component: SubscriptionsPage });

function SubscriptionsPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("subscriptions");
  const [active, setActive] = useState<Sub | null>(null);
  const [showList, setShowList] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (bootstrapped) return;
    (async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .order("renewal_date", { ascending: true, nullsFirst: false });
      const rows = (data ?? []) as Sub[];
      const first = rows.find((r) => r.status === "active") ?? rows[0] ?? null;
      setActive(first);
      if (!first) setShowList(true);
      setBootstrapped(true);
    })();
  }, [bootstrapped]);

  return (
    <div className="py-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground mt-1 text-sm">Recurring client plans and renewals.</p>
      </div>
      {!showList && active
        ? <SubDetail sub={active} editable={editable} onBack={() => setShowList(true)} onSaved={(s) => setActive(s)} onShowList={() => setShowList(true)} />
        : <SubList editable={editable} onOpen={(s) => { setActive(s); setShowList(false); }} />}
    </div>
  );
}

function SubList({ editable, onOpen }: { editable: boolean; onOpen: (s: Sub) => void }) {
  const [rows, setRows] = useState<Sub[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [planOpts, setPlanOpts] = useState<PlanOpt[]>([]);
  const [projects, setProjects] = useState<LinkedProject[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [{ data: s }, { data: o }, { data: c }, { data: p }, { data: pj }] = await Promise.all([
      supabase.from("subscriptions").select("*").order("renewal_date", { ascending: true, nullsFirst: false }),
      supabase.from("organisations").select("id,name").order("name"),
      supabase.from("contacts").select("id,first_name,last_name,organisation_id").order("last_name"),
      supabase.from("subscription_plan_options").select("*").order("position"),
      supabase.from("projects").select("id,title,type").order("title"),
    ]);
    setRows((s ?? []) as Sub[]); setOrgs((o ?? []) as Org[]); setContacts((c ?? []) as Contact[]);
    setPlanOpts((p ?? []) as PlanOpt[]);
    setProjects((pj ?? []) as LinkedProject[]);
  };
  useEffect(() => { void load(); }, []);

  const remove = async (s: Sub) => {
    if (!confirm(`Delete subscription "${s.plan_name}"?`)) return;
    const { error } = await supabase.from("subscriptions").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    await logActivity({ module: "subscriptions", entity_type: "subscription", entity_id: s.id, verb: "deleted", summary: `Deleted subscription ${s.plan_name}` });
    toast.success("Deleted"); void load();
  };

  const saveCell = async (row: Sub, key: string, value: unknown) => {
    const { error } = await supabase.from("subscriptions").update({ [key]: value } as never).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const { inRange } = useFiscalYear();
  const yearRows = rows.filter((r) => inRange(r.renewal_date));
  const mrr = yearRows.filter((r) => r.status === "active").reduce((sum, r) => {
    const c = Number(r.cost);
    return sum + (r.billing_cycle === "yearly" ? c / 12 : r.billing_cycle === "quarterly" ? c / 3 : c);
  }, 0);

  const cycleLabel = useBuiltinFieldLabel("subscriptions", "billing_cycle");
  const subStatusLabel = useBuiltinFieldLabel("subscriptions", "status");
  const cycleOptions = useBuiltinFieldOptions("subscriptions", "billing_cycle");
  const subStatusOptions = useBuiltinFieldOptions("subscriptions", "status");

  const planOptions = planOpts.map((p) => ({ value: p.label, label: p.label }));
  const columns: DataTableColumn<Sub>[] = [
    { key: "plan_name", header: "Plan", accessor: (r) => r.plan_name, editable, type: "select", options: planOptions },
    { key: "client", header: "Client", accessor: (r) => orgs.find((o) => o.id === r.client_org_id)?.name ?? "" },
    {
      key: "billing_cycle", header: "Cycle", accessor: (r) => r.billing_cycle,
      render: (r) => <span>{cycleLabel(r.billing_cycle)}</span>,
      editable, type: "select", options: cycleOptions,
    },
    { key: "cost", header: "Final Costs", accessor: (r) => Number(r.cost), render: (r) => formatGBP(r.cost), editable, type: "number", align: "right" },
    { key: "renewal_date", header: "Renewal", accessor: (r) => r.renewal_date, render: (r) => formatDateUK(r.renewal_date), editable, type: "date" },
    {
      key: "status", header: "Status", accessor: (r) => r.status,
      render: (r) => <Badge variant={r.status === "active" ? "default" : r.status === "past_due" ? "destructive" : "secondary"}>{subStatusLabel(r.status)}</Badge>,
      editable, type: "select", options: subStatusOptions,
    },
  ];
  const customCols = useCustomFieldColumns<Sub>("subscriptions");
  const allColumns = [...columns, ...customCols];

  const activeRows = yearRows.filter((r) => r.status === "active");
  const otherRows = yearRows.filter((r) => r.status !== "active");

  const renderTable = (data: Sub[]) => (
    <DataTable
      tableKey="subscriptions"
      columns={allColumns}
      rows={data}
      rowId={(r) => r.id}
      onSaveCell={saveCell}
      onRowClick={onOpen}
      emptyMessage="No subscriptions yet."
      actions={(r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" title="Open" onClick={() => onOpen(r)}><FolderOpen className="size-4" /></Button>
          {editable && <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(r)}><Trash2 className="size-4" /></Button>}
        </div>
      )}
    />
  );

  return (
    <>
      <div className="flex justify-end">
        {editable && <Button className="bg-gradient-primary text-primary-foreground" onClick={() => setOpen(true)}><Plus className="size-4 mr-2" />New subscription</Button>}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-soft"><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">Active</p><p className="text-2xl font-semibold mt-1">{activeRows.length}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">MRR</p><p className="text-2xl font-semibold mt-1">{formatGBP(mrr)}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">Total plans</p><p className="text-2xl font-semibold mt-1">{rows.length}</p></CardContent></Card>
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active Subscriptions ({activeRows.length})</TabsTrigger>
              <TabsTrigger value="others">Others ({otherRows.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4">{renderTable(activeRows)}</TabsContent>
            <TabsContent value="others" className="mt-4">{renderTable(otherRows)}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <SubDialog open={open} onOpenChange={setOpen} sub={null} orgs={orgs} contacts={contacts} planOpts={planOpts} projects={projects} onSaved={load} />
    </>
  );
}

function SubDetail({ sub, editable, onBack, onSaved, onShowList }: { sub: Sub; editable: boolean; onBack: () => void; onSaved: (s: Sub) => void; onShowList?: () => void }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [planOpts, setPlanOpts] = useState<PlanOpt[]>([]);
  const [projects, setProjects] = useState<LinkedProject[]>([]);
  const [siblings, setSiblings] = useState<Sub[]>([]);
  const [openEdit, setOpenEdit] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [siblingTab, setSiblingTab] = useState<"active" | "pending">(sub.status === "active" ? "active" : "pending");
  useEffect(() => { setSiblingTab(sub.status === "active" ? "active" : "pending"); }, [sub.status]);
  const seededRef = useRef<Set<string>>(new Set());

  const cycleLabel = useBuiltinFieldLabel("subscriptions", "billing_cycle");
  const statusLabel = useBuiltinFieldLabel("subscriptions", "status");
  const statusOptions = useBuiltinFieldOptions("subscriptions", "status");
  const cycleOptions = useBuiltinFieldOptions("subscriptions", "billing_cycle");

  const load = async () => {
    const [{ data: m }, { data: o }, { data: c }, { data: p }, { data: fresh }, { data: pj }, { data: sibs }] = await Promise.all([
      supabase.from("milestones").select("*").eq("parent_id", sub.id).eq("parent_type", "subscription").order("position"),
      supabase.from("organisations").select("id,name").order("name"),
      supabase.from("contacts").select("id,first_name,last_name,organisation_id").order("last_name"),
      supabase.from("subscription_plan_options").select("*").order("position"),
      supabase.from("subscriptions").select("*").eq("id", sub.id).single(),
      supabase.from("projects").select("id,title,type").order("title"),
      supabase.from("subscriptions").select("*").order("renewal_date", { ascending: true, nullsFirst: false }),
    ]);
    setPlanOpts((p ?? []) as PlanOpt[]);
    setProjects((pj ?? []) as LinkedProject[]);
    setSiblings((sibs ?? []) as Sub[]);
    let ms = (m ?? []) as Milestone[];
    if (ms.length === 0 && !seededRef.current.has(sub.id)) {
      seededRef.current.add(sub.id);
      const { data: tpls } = await supabase
        .from("milestone_templates").select("*")
        .eq("module", "subscriptions").order("position");
      if (tpls && tpls.length > 0) {
        await supabase.from("milestones").upsert(
          (tpls as MTemplate[]).map((t) => ({
            parent_type: "subscription", parent_id: sub.id,
            label: t.label, position: t.position, is_custom: false,
          })) as never,
          { onConflict: "parent_type,parent_id,label", ignoreDuplicates: true } as never
        );
        const { data: reread } = await supabase.from("milestones")
          .select("*").eq("parent_id", sub.id).eq("parent_type", "subscription").order("position");
        ms = (reread ?? []) as Milestone[];
      }
    }
    setMilestones(ms);
    setOrgs((o ?? []) as Org[]); setContacts((c ?? []) as Contact[]);
    if (fresh) onSaved(fresh as Sub);
  };
  useEffect(() => { void load(); }, [sub.id]);

  const toggleCompleted = async (m: Milestone, completed: boolean) => {
    const completed_at = completed ? new Date().toISOString() : null;
    const { error } = await supabase.from("milestones").update({ completed_at }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };
  const updateDueDate = async (m: Milestone, due_date: string | null) => {
    const { error } = await supabase.from("milestones").update({ due_date }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };
  const addCustom = async () => {
    if (!customLabel.trim()) return;
    const { error } = await supabase.from("milestones").insert({
      parent_type: "subscription", parent_id: sub.id,
      label: customLabel, is_custom: true, position: milestones.length,
    } as never);
    if (error) { toast.error(error.message); return; }
    setCustomLabel(""); void load();
  };
  const removeMilestone = async (m: Milestone) => {
    const { error } = await supabase.from("milestones").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };
  const updateSubField = async (patch: Partial<Sub>) => {
    const { error } = await supabase.from("subscriptions").update(patch as never).eq("id", sub.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const progress = milestones.length === 0 ? 0
    : Math.round((milestones.filter((m) => m.completed_at).length / milestones.length) * 100);
  const done = milestones.filter((m) => m.completed_at).length;

  const clientName = orgs.find((o) => o.id === sub.client_org_id)?.name ?? "—";
  const linkedProject = projects.find((p) => p.id === sub.project_id);

  const statusChipClass =
    sub.status === "active" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
    : sub.status === "past_due" ? "bg-destructive/10 text-destructive"
    : sub.status === "pending_renewal" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
    : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1" />
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const items = await fetchCostItems("subscription", sub.id);
              let extraSection;
              if (linkedProject) {
                const include = window.confirm(
                  `Include the linked ${linkedProject.type === "work" ? "work" : "project"} "${linkedProject.title}" in this Cost Proposal?\n\nOK = include both. Cancel = subscription only.`
                );
                if (include) {
                  const projectItems = await fetchCostItems("project", linkedProject.id);
                  extraSection = {
                    heading: `${linkedProject.type === "work" ? "Work" : "Project"} — ${linkedProject.title}`,
                    items: projectItems,
                  };
                }
              }
              await generateCostProposalPdf({
                kind: "subscription",
                clientName: orgs.find((o) => o.id === sub.client_org_id)?.name,
                title: sub.plan_name,
                description: sub.description,
                renewalDate: sub.renewal_date,
                items,
                extraSection,
              });
            } catch (e) { toast.error((e as Error).message); }
          }}
        ><FileDown className="size-4 mr-2" />Export PDF</Button>
        {editable && <Button variant="outline" onClick={() => setOpenEdit(true)}><Pencil className="size-4 mr-2" />Edit</Button>}
        {onShowList && <Button variant="outline" onClick={onShowList}><ListIcon className="size-4 mr-2" />List view</Button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Portfolio Rail */}
        <aside className="lg:col-span-3 flex flex-col gap-6">
          <section className="bg-card rounded-2xl border border-border/60 shadow-soft flex flex-col overflow-hidden lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-6rem)]">
            <div className="p-4 border-b border-border/60 space-y-3">
              <h2 className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                <FolderOpen className="size-3.5" /> Subscriptions
              </h2>
              <Tabs value={siblingTab} onValueChange={(v) => setSiblingTab(v as "active" | "pending")}>
                <TabsList className="w-full">
                  <TabsTrigger value="active" className="flex-1 text-xs">Active ({siblings.filter((s) => s.status === "active").length})</TabsTrigger>
                  <TabsTrigger value="pending" className="flex-1 text-xs">Pending ({siblings.filter((s) => s.status !== "active").length})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {(() => {
              const filtered = siblings.filter((s) => siblingTab === "active" ? s.status === "active" : s.status !== "active");
              const rank = (s: Sub) => s.status === "active" ? 0 : s.status === "pending_renewal" ? 1 : 2;
              const sorted = [...filtered].sort((a, b) => rank(a) - rank(b));
              if (sorted.length === 0) return <p className="text-xs text-muted-foreground text-center py-6">No subscriptions.</p>;
              return sorted.map((s) => {
              const isActive = s.id === sub.id;
              const sClient = orgs.find((o) => o.id === s.client_org_id)?.name ?? "—";
              return (
                <button
                  key={s.id}
                  onClick={() => !isActive && onSaved(s)}
                  className={`w-full text-left p-3 rounded-xl transition-colors ${
                    isActive ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted/60"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold text-sm truncate">{s.plan_name}</span>
                    <span className={`px-2 py-0.5 text-[9px] rounded-full uppercase font-bold tracking-wider shrink-0 border ${
                      isActive ? "bg-white/15 text-primary-foreground border-white/20" : "bg-muted text-muted-foreground border-transparent"
                    }`}>
                      {statusLabel(s.status)}
                    </span>
                  </div>
                  <p className={`text-[11px] mt-1 truncate ${isActive ? "opacity-80" : "text-muted-foreground"}`}>{sClient}</p>
                  <div className={`mt-2 flex justify-between items-center text-[10px] ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    <span>{formatGBP(s.cost)} · {cycleLabel(s.billing_cycle)}</span>
                    {s.renewal_date && <span>{formatDateUK(s.renewal_date)}</span>}
                  </div>
                </button>
              );
            });
            })()}
            </div>
          </section>
        </aside>

        <main className="lg:col-span-9">


        {/* Right: Main Detail Panel */}
        <div className="bg-card rounded-[2rem] border border-border shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-muted text-muted-foreground text-[10px] font-bold rounded-lg uppercase tracking-wide">SUBSCRIPTIONS</span>
                <span className={`px-3 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wide ${statusChipClass}`}>Status: {statusLabel(sub.status)}</span>
                <span className="px-3 py-1 bg-muted text-muted-foreground text-[10px] font-bold rounded-lg uppercase tracking-wide">Client: {clientName}</span>
                {linkedProject && (
                  <span className="px-3 py-1 bg-muted text-muted-foreground text-[10px] font-bold rounded-lg uppercase tracking-wide">
                    Linked: {linkedProject.title}
                  </span>
                )}
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">{sub.plan_name}</h2>
            {sub.description && (
              <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap max-w-3xl">{sub.description}</p>
            )}
          </div>

          {/* KPI Attribute Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border-y border-border/60">
            <div className="p-6 lg:border-r border-b lg:border-b-0 border-border/60">
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-2">Final Costs</label>
              <span className="text-2xl font-bold text-foreground">{formatGBP(sub.cost)}</span>
              <p className="text-[10px] text-muted-foreground mt-1">{cycleLabel(sub.billing_cycle)}</p>
            </div>
            <div className="p-6 lg:border-r border-b lg:border-b-0 border-border/60">
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-2">Status</label>
              {editable ? (
                <Select value={sub.status} onValueChange={(v) => updateSubField({ status: v as SStatus })}>
                  <SelectTrigger className="border-0 bg-transparent p-0 h-auto text-sm font-semibold shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : <span className="text-sm font-semibold">{statusLabel(sub.status)}</span>}
            </div>
            <div className="p-6 lg:border-r border-border/60">
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-2">Billing Cycle</label>
              {editable ? (
                <Select value={sub.billing_cycle} onValueChange={(v) => updateSubField({ billing_cycle: v })}>
                  <SelectTrigger className="border-0 bg-transparent p-0 h-auto text-sm font-semibold shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{cycleOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : <span className="text-sm font-semibold">{cycleLabel(sub.billing_cycle)}</span>}
            </div>
            <div className="p-6">
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-2">Renewal</label>
              {editable ? (
                <Input
                  type="date"
                  value={sub.renewal_date ?? ""}
                  onChange={(e) => updateSubField({ renewal_date: e.target.value || null })}
                  className="border-0 bg-transparent p-0 h-auto text-sm font-semibold shadow-none focus:ring-0"
                />
              ) : <span className="text-sm font-semibold">{formatDateUK(sub.renewal_date) || "—"}</span>}
            </div>
          </div>

          {/* Details Sub-Card */}
          <div className="px-8 py-5 bg-muted/20 border-b border-border/60 text-sm">
            <div className="grid md:grid-cols-3 gap-3">
              <Info label="Contact" value={(() => { const c = contacts.find((x) => x.id === sub.client_contact_id); return c ? `${c.first_name} ${c.last_name}` : "—"; })()} />
              <Info label="Linked project / work" value={linkedProject ? `${linkedProject.title} (${linkedProject.type === "work" ? "Work" : "Project"})` : "—"} />
              <Info label="Client" value={clientName} />
            </div>
          </div>


          {/* Deliverables / Tabbed Section */}
          <div className="p-8 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-foreground">
                <div className="p-1.5 bg-primary rounded-lg">
                  <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <h3 className="text-xs font-bold uppercase tracking-[0.1em]">Deliverables, Costs & To-dos</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">{done}/{milestones.length} · {progress}%</span>
              </div>
            </div>

            <Tabs defaultValue="milestones">
              <TabsList>
                <TabsTrigger value="milestones">Deliverables</TabsTrigger>
                <TabsTrigger value="costs">Cost Breakdown</TabsTrigger>
                <TabsTrigger value="todos">To-dos</TabsTrigger>
                <TabsTrigger value="info">Other Information</TabsTrigger>
              </TabsList>
              <TabsContent value="milestones" className="mt-4 space-y-4">
                {milestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No milestones yet.</p>
                ) : (
                  <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
                    {milestones.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                        <Checkbox
                          checked={!!m.completed_at}
                          onCheckedChange={(c) => editable && toggleCompleted(m, c === true)}
                          disabled={!editable}
                        />
                        <span className={`flex-1 min-w-0 truncate text-sm font-medium ${m.completed_at ? "line-through text-muted-foreground" : "text-foreground"}`}>{m.label}</span>
                        <Input
                          type="date"
                          value={m.due_date ?? ""}
                          disabled={!editable}
                          onChange={(e) => updateDueDate(m, e.target.value || null)}
                          className="h-7 text-xs w-36 shrink-0"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground italic w-24 text-right shrink-0">
                          {m.completed_at ? formatDateUK(m.completed_at) : "Pending"}
                        </span>
                        {editable && m.is_custom ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Delete custom milestone" onClick={() => removeMilestone(m)}><Trash2 className="size-3.5" /></Button>
                        ) : <span className="w-7 shrink-0" />}
                      </div>
                    ))}
                  </div>
                )}
                {editable && (
                  <div className="flex gap-2 pt-2">
                    <Input placeholder="Add custom milestone…" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
                    <Button onClick={addCustom} disabled={!customLabel.trim()}>Add</Button>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="costs" className="mt-4">
                <CostBreakdown
                  parentType="subscription"
                  parentId={sub.id}
                  editable={editable}
                  onTotalsChange={async ({ final }) => {
                    if (Number(sub.cost) === final) return;
                    await supabase.from("subscriptions").update({ cost: final }).eq("id", sub.id);
                    void load();
                  }}
                />
              </TabsContent>
              <TabsContent value="todos" className="mt-4">
                <TodoList parentType="subscription" parentId={sub.id} editable={editable} />
              </TabsContent>
              <TabsContent value="info" className="mt-4">
                <CustomFieldDisplay module="subscriptions" value={sub.custom} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
        </main>
      </div>


      <SubDialog open={openEdit} onOpenChange={setOpenEdit} sub={sub} orgs={orgs} contacts={contacts} planOpts={planOpts} projects={projects} onSaved={load} />
    </div>
  );
}


function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="text-muted-foreground">{label}:</span> <span className="font-medium">{value}</span></div>;
}

function SubDialog({ open, onOpenChange, sub, orgs, contacts, planOpts, projects, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; sub: Sub | null; orgs: Org[]; contacts: Contact[]; planOpts: PlanOpt[]; projects: LinkedProject[]; onSaved: () => void;
}) {
  const [plan, setPlan] = useState(""); const [cost, setCost] = useState("0");
  const [cycle, setCycle] = useState("monthly");
  const [renewal, setRenewal] = useState(""); const [status, setStatus] = useState<SStatus>("active");
  const [org, setOrg] = useState<string>("__none__"); const [contact, setContact] = useState<string>("__none__");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("__none__");
  const [customVals, setCustomVals] = useState<Record<string, unknown>>({});
  const [localOrgs, setLocalOrgs] = useState<Org[]>(orgs);
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts);
  const [quickOrgOpen, setQuickOrgOpen] = useState(false);
  const [quickContactOpen, setQuickContactOpen] = useState(false);

  useEffect(() => { setLocalOrgs(orgs); }, [orgs]);
  useEffect(() => { setLocalContacts(contacts); }, [contacts]);

  const cycleOptions = useBuiltinFieldOptions("subscriptions", "billing_cycle");
  const statusOptions = useBuiltinFieldOptions("subscriptions", "status");

  useEffect(() => {
    setPlan(sub?.plan_name ?? ""); setCost(String(sub?.cost ?? 0));
    setCycle(sub?.billing_cycle ?? "monthly"); setRenewal(sub?.renewal_date ?? "");
    setStatus(sub?.status ?? "active");
    setOrg(sub?.client_org_id ?? "__none__"); setContact(sub?.client_contact_id ?? "__none__");
    setDescription(sub?.description ?? "");
    setProjectId(sub?.project_id ?? "__none__");
    setCustomVals((sub?.custom ?? {}) as Record<string, unknown>);
  }, [sub, open]);

  const submit = async () => {
    if (!plan.trim()) return;
    const payload = {
      plan_name: plan, cost: Number(cost) || 0, billing_cycle: cycle,
      renewal_date: renewal || null, status,
      client_org_id: org === "__none__" ? null : org,
      client_contact_id: contact === "__none__" ? null : contact,
      description: description || null,
      project_id: projectId === "__none__" ? null : projectId,
      custom: customVals as never,
    };
    if (sub) {
      const { error } = await supabase.from("subscriptions").update(payload).eq("id", sub.id);
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "subscriptions", entity_type: "subscription", entity_id: sub.id, verb: "updated", summary: `Updated subscription ${plan}` });
    } else {
      const { data, error } = await supabase.from("subscriptions").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      // Seed milestones from subscription templates
      const { data: tpls } = await supabase
        .from("milestone_templates").select("*")
        .eq("module", "subscriptions").order("position");
      if (tpls && tpls.length > 0) {
        await supabase.from("milestones").insert(
          (tpls as MTemplate[]).map((t) => ({
            parent_type: "subscription", parent_id: data.id,
            label: t.label, position: t.position, is_custom: false,
          })) as never
        );
      }
      await logActivity({ module: "subscriptions", entity_type: "subscription", entity_id: data.id, verb: "created", summary: `Created subscription ${plan}` });
    }
    toast.success("Saved"); onOpenChange(false); onSaved();
  };

  const filteredContacts = org === "__none__" ? localContacts : localContacts.filter((c) => c.organisation_id === org);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{sub ? "Edit subscription" : "New subscription"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Plan *</Label>
            {(() => {
              const labels = planOpts.map((p) => p.label);
              const inList = !plan || labels.includes(plan);
              return (
                <>
                  <Select value={inList ? (plan || "__none__") : "__other__"} onValueChange={(v) => setPlan(v === "__none__" || v === "__other__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select a plan…" /></SelectTrigger>
                    <SelectContent>
                      {planOpts.map((p) => <SelectItem key={p.id} value={p.label}>{p.label}</SelectItem>)}
                      {!inList && plan && <SelectItem value="__other__">{plan} (legacy)</SelectItem>}
                    </SelectContent>
                  </Select>
                  {planOpts.length === 0 && (
                    <p className="text-xs text-muted-foreground">No plans configured yet. Add some in Settings → Subscription Plans.</p>
                  )}
                </>
              );
            })()}
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shown on the cost proposal PDF" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Final Costs (£)</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /><p className="text-xs text-muted-foreground">Use the breakdown in the detail view to auto-calculate this.</p></div>
            <div className="space-y-1">
              <Label>Billing cycle</Label>
              <Select value={cycle} onValueChange={setCycle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cycleOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Renewal date</Label>
              <div className="flex gap-2">
                <Input type="date" value={renewal} onChange={(e) => setRenewal(e.target.value)} />
                {renewal && <Button type="button" variant="ghost" size="sm" onClick={() => setRenewal("")}>Clear</Button>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Client org</Label>
              <Select value={org} onValueChange={(v) => { setOrg(v); setContact("__none__"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {localOrgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-xs" onClick={() => setQuickOrgOpen(true)}>
                <Plus className="size-3 mr-1" /> New organisation
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Contact</Label>
              <Select value={contact} onValueChange={setContact}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {filteredContacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-xs" onClick={() => setQuickContactOpen(true)}>
                <Plus className="size-3 mr-1" /> New contact
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Linked project / work</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title} ({p.type === "work" ? "Work" : "Project"})</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Optional. Shown on the project's Cost Breakdown as a reference (not summed into project totals).</p>
          </div>
          <CustomFieldValues module="subscriptions" value={customVals} onChange={setCustomVals} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground" disabled={!plan.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
      <QuickCreateOrgDialog
        open={quickOrgOpen}
        onOpenChange={setQuickOrgOpen}
        onCreated={(newOrg) => {
          setLocalOrgs((prev) => [...prev, newOrg].sort((a, b) => a.name.localeCompare(b.name)));
          setOrg(newOrg.id);
          setContact("__none__");
        }}
      />
      <QuickCreateContactDialog
        open={quickContactOpen}
        onOpenChange={setQuickContactOpen}
        orgs={localOrgs}
        defaultOrgId={org === "__none__" ? null : org}
        onCreated={(newContact) => {
          setLocalContacts((prev) => [...prev, newContact]);
          if (newContact.organisation_id) setOrg(newContact.organisation_id);
          setContact(newContact.id);
        }}
      />
    </Dialog>
  );
}

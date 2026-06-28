import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { logActivity } from "@/lib/activity";
import { formatGBP, formatDateUK } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Plus, Pencil, Trash2, ArrowLeft, FolderOpen, ChevronDown, FileDown } from "lucide-react";
import { generateCostProposalPdf, fetchCostItems } from "@/lib/cost-proposal-pdf";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { CustomFieldValues } from "@/components/CustomFieldValues";
import { QuickCreateOrgDialog, QuickCreateContactDialog } from "@/components/QuickCreateCrm";
import { CustomFieldDisplay, useCustomFieldColumns } from "@/components/CustomFieldDisplay";
import { CostBreakdown } from "@/components/CostBreakdown";
import { TodoList } from "@/components/TodoList";
import { useBuiltinFieldLabel, useBuiltinFieldOptions } from "@/lib/builtin-labels";
import { useFiscalYear } from "@/lib/fiscal-year";
import type { Database } from "@/integrations/supabase/types";

type PType = Database["public"]["Enums"]["project_type"];
type PStatus = Database["public"]["Enums"]["project_status"];
type Priority = Database["public"]["Enums"]["priority_level"];

type Project = {
  id: string; title: string; description: string | null; type: PType; status: PStatus; priority: Priority;
  team_lead_id: string | null; client_org_id: string | null; client_contact_id: string | null;
  start_date: string | null; end_date: string | null;
  total_cost: number; supplier_cost: number;
  custom: Record<string, unknown> | null;
};
type Profile = { id: string; full_name: string };
type Org = { id: string; name: string };
type Contact = { id: string; first_name: string; last_name: string; organisation_id: string | null };
type Milestone = { id: string; parent_id: string; parent_type: string; label: string; due_date: string | null; completed_at: string | null; is_custom: boolean; position: number };
type MTemplate = { id: string; label: string; position: number; module: string; project_type: string | null };
type LinkedSub = { id: string; plan_name: string; billing_cycle: string; cost: number; renewal_date: string | null; status: string };

export const Route = createFileRoute("/_authenticated/projects")({ component: ProjectsPage });

function relabelForType(label: string, type: PType): string {
  if (type !== "work") return label;
  if (label === "Project completed") return "Works completed";
  if (label === "Project invoiced") return "Works invoiced";
  return label;
}

// Sequential milestones mapping → Next Action label.
// Match against base labels (works variants too).
const NEXT_ACTION_SEQUENCE: { match: string[]; next: string }[] = [
  { match: ["initial enquiry"], next: "Submit Cost Proposal" },
  { match: ["cost proposal submitted"], next: "Waiting for Order Approval" },
  { match: ["order approved"], next: "Waiting for Purchase Order" },
  { match: ["order received"], next: "Project In-Progress" },
  { match: ["project completed", "works completed"], next: "Ready to Invoice" },
  { match: ["project invoiced", "works invoiced"], next: "Completed" },
];

function computeNextAction(milestones: { label: string; completed_at: string | null }[]): string {
  let action = "";
  for (const step of NEXT_ACTION_SEQUENCE) {
    const hit = milestones.find((m) => step.match.includes(m.label.trim().toLowerCase()) && !!m.completed_at);
    if (hit) action = step.next;
  }
  return action;
}

function ProjectsPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("projects");
  const [active, setActive] = useState<Project | null>(null);
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects &amp; Works</h1>
          <p className="text-muted-foreground mt-1">Track delivery, costs and milestones.</p>
        </div>
      </div>
      {active ? <ProjectDetail project={active} editable={editable} onBack={() => setActive(null)} onSaved={(p) => setActive(p)} /> : <ProjectList editable={editable} onOpen={setActive} />}
    </div>
  );
}

function ProjectList({ editable, onOpen }: { editable: boolean; onOpen: (p: Project) => void }) {
  const [rows, setRows] = useState<Project[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [milestonesByProject, setMilestonesByProject] = useState<Record<string, { label: string; completed_at: string | null }[]>>({});
  const [tab, setTab] = useState<PType>("project");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [{ data: p }, { data: o }, { data: pr }, { data: c }, { data: ms }] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("organisations").select("id,name").order("name"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
      supabase.from("contacts").select("id,first_name,last_name,organisation_id").order("last_name"),
      supabase.from("milestones").select("parent_id,label,completed_at").eq("parent_type", "project"),
    ]);
    setRows((p ?? []) as Project[]);
    setOrgs((o ?? []) as Org[]);
    setProfiles((pr ?? []) as Profile[]);
    setContacts((c ?? []) as Contact[]);
    const map: Record<string, { label: string; completed_at: string | null }[]> = {};
    for (const m of (ms ?? []) as { parent_id: string; label: string; completed_at: string | null }[]) {
      (map[m.parent_id] ||= []).push({ label: m.label, completed_at: m.completed_at });
    }
    setMilestonesByProject(map);
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => r.type === tab), [rows, tab]);

  const remove = async (p: Project) => {
    if (!confirm(`Delete "${p.title}"?`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    await logActivity({ module: "projects", entity_type: p.type, entity_id: p.id, verb: "deleted", summary: `Deleted ${p.type} ${p.title}` });
    toast.success("Deleted"); void load();
  };

  const saveCell = async (row: Project, key: string, value: unknown) => {
    const { error } = await supabase.from("projects").update({ [key]: value } as never).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const statusLabel = useBuiltinFieldLabel("projects", "status");
  const priorityLabel = useBuiltinFieldLabel("projects", "priority");
  const statusOptions = useBuiltinFieldOptions("projects", "status");
  const priorityOptions = useBuiltinFieldOptions("projects", "priority");

  const columns: DataTableColumn<Project>[] = [
    { key: "title", header: "Title", accessor: (r) => r.title, editable, editField: "title", type: "text" },
    { key: "client", header: "Client", accessor: (r) => orgs.find((o) => o.id === r.client_org_id)?.name ?? "" },
    { key: "lead", header: "Lead", accessor: (r) => profiles.find((u) => u.id === r.team_lead_id)?.full_name ?? "" },
    {
      key: "status", header: "Status", accessor: (r) => r.status,
      render: (r) => <Badge variant="secondary">{statusLabel(r.status)}</Badge>,
      editable, type: "select",
      options: statusOptions,
    },
    {
      key: "next_action", header: "Next Action",
      accessor: (r) => computeNextAction(milestonesByProject[r.id] ?? []),
      render: (r) => {
        const action = computeNextAction(milestonesByProject[r.id] ?? []);
        if (!action) return <span className="text-muted-foreground">—</span>;
        const variant = action === "Completed" ? "default" : "secondary";
        return <Badge variant={variant}>{action}</Badge>;
      },
    },
    {
      key: "priority", header: "Priority", accessor: (r) => r.priority,
      render: (r) => <Badge variant={r.priority === "high" ? "destructive" : r.priority === "low" ? "outline" : "default"}>{priorityLabel(r.priority)}</Badge>,
      editable, type: "select",
      options: priorityOptions,
    },
    { key: "end_date", header: "End date", accessor: (r) => r.end_date, render: (r) => formatDateUK(r.end_date), editable, type: "date", align: "right" },
    { key: "total_cost", header: "Final Costs", accessor: (r) => Number(r.total_cost), render: (r) => formatGBP(r.total_cost), editable, type: "number", align: "right" },
  ];
  const customCols = useCustomFieldColumns<Project>("projects");
  const allColumns = [...columns, ...customCols];

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as PType)}>
      <div className="flex justify-between items-center">
        <TabsList>
          <TabsTrigger value="project">Projects</TabsTrigger>
          <TabsTrigger value="work">Works</TabsTrigger>
        </TabsList>
        {editable && <Button className="bg-gradient-primary text-primary-foreground" onClick={() => setOpen(true)}><Plus className="size-4 mr-2" />New {tab}</Button>}
      </div>
      <TabsContent value={tab} className="mt-4">
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <DataTable
              tableKey={`projects.${tab}`}
              columns={allColumns}
              rows={filtered}
              rowId={(r) => r.id}
              onSaveCell={saveCell}
              onRowClick={onOpen}
              emptyMessage={`No ${tab}s yet.`}
              actions={(r) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" title="Open" onClick={() => onOpen(r)}><FolderOpen className="size-4" /></Button>
                  {editable && <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(r)}><Trash2 className="size-4" /></Button>}
                </div>
              )}
            />
          </CardContent>
        </Card>
        <ProjectDialog open={open} onOpenChange={setOpen} project={null} defaultType={tab} orgs={orgs} contacts={contacts} profiles={profiles} onSaved={load} />
      </TabsContent>
    </Tabs>
  );
}

function ProjectDetail({ project, editable, onBack, onSaved }: { project: Project; editable: boolean; onBack: () => void; onSaved: (p: Project) => void }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [linkedSubs, setLinkedSubs] = useState<LinkedSub[]>([]);
  const [openEdit, setOpenEdit] = useState(false);
  const [customLabel, setCustomLabel] = useState("");

  const load = async () => {
    const [{ data: m }, { data: o }, { data: pr }, { data: c }, { data: fresh }, { data: subs }] = await Promise.all([
      supabase.from("milestones").select("*").eq("parent_id", project.id).eq("parent_type", "project").order("position"),
      supabase.from("organisations").select("id,name").order("name"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
      supabase.from("contacts").select("id,first_name,last_name,organisation_id").order("last_name"),
      supabase.from("projects").select("*").eq("id", project.id).single(),
      supabase.from("subscriptions").select("id,plan_name,billing_cycle,cost,renewal_date,status").eq("project_id", project.id).order("plan_name"),
    ]);
    setMilestones((m ?? []) as Milestone[]);
    setOrgs((o ?? []) as Org[]); setProfiles((pr ?? []) as Profile[]); setContacts((c ?? []) as Contact[]);
    setLinkedSubs((subs ?? []) as LinkedSub[]);
    if (fresh) onSaved(fresh as Project);
  };
  useEffect(() => { void load(); }, [project.id]);

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
      parent_type: "project", parent_id: project.id, project_id: project.id,
      label: customLabel, is_custom: true,
      position: milestones.length,
    } as never);
    if (error) { toast.error(error.message); return; }
    setCustomLabel(""); void load();
  };

  const removeMilestone = async (m: Milestone) => {
    const { error } = await supabase.from("milestones").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const profit = Number(project.total_cost) - Number(project.supplier_cost);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4 mr-1" />Back</Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{project.title}</h2>
          <p className="text-sm text-muted-foreground capitalize">{project.type} · {project.status.replace("_", " ")} · {project.priority} priority</p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const items = await fetchCostItems("project", project.id);
              let extraSection;
              if (linkedSubs.length > 0) {
                const names = linkedSubs.map((s) => `"${s.plan_name}"`).join(", ");
                const include = window.confirm(
                  `Include the linked subscription${linkedSubs.length > 1 ? "s" : ""} ${names} in this Cost Proposal?\n\nOK = include both. Cancel = project only.`
                );
                if (include) {
                  const allItems = [] as Awaited<ReturnType<typeof fetchCostItems>>;
                  for (const s of linkedSubs) {
                    const its = await fetchCostItems("subscription", s.id);
                    allItems.push(...its);
                  }
                  extraSection = {
                    heading: linkedSubs.length === 1
                      ? `Subscription — ${linkedSubs[0].plan_name}`
                      : "Linked subscriptions",
                    items: allItems,
                    renewalDate: linkedSubs.length === 1 ? linkedSubs[0].renewal_date : null,
                  };
                }
              }
              await generateCostProposalPdf({
                kind: project.type === "work" ? "work" : "project",
                clientName: orgs.find((o) => o.id === project.client_org_id)?.name,
                title: project.title,
                description: project.description,
                items,
                extraSection,
              });
            } catch (e) { toast.error((e as Error).message); }
          }}
        ><FileDown className="size-4 mr-2" />Export PDF</Button>
        {editable && <Button variant="outline" onClick={() => setOpenEdit(true)}><Pencil className="size-4 mr-2" />Edit</Button>}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <StatCard label="Final Costs" value={formatGBP(project.total_cost)} />
        <StatCard label="Investment" value={formatGBP(project.supplier_cost)} />
        <StatCard label="Profit" value={formatGBP(profit)} accent={profit >= 0 ? "text-primary" : "text-destructive"} />
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-6 space-y-3">
          <h3 className="font-semibold">Details</h3>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <Info label="Client" value={orgs.find((o) => o.id === project.client_org_id)?.name ?? "—"} />
            <Info label="Contact" value={(() => { const c = contacts.find((x) => x.id === project.client_contact_id); return c ? `${c.first_name} ${c.last_name}` : "—"; })()} />
            <Info label="Team lead" value={profiles.find((u) => u.id === project.team_lead_id)?.full_name ?? "—"} />
            <Info label="Dates" value={`${formatDateUK(project.start_date)} → ${formatDateUK(project.end_date)}`} />
          </div>
          {project.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>}
          <CustomFieldDisplay module="projects" value={project.custom} />
        </CardContent>
      </Card>

      <Collapsible defaultOpen>
        <Card className="shadow-soft">
          <CardContent className="pt-6 space-y-4">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="group h-auto min-h-11 w-full justify-between px-0 text-left hover:bg-transparent">
                <h3 className="font-semibold">Cost Breakdown</h3>
                <ChevronDown className="size-4 transition-transform group-data-[state=closed]:-rotate-90" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4">
              <CostBreakdown
                parentType="project"
                parentId={project.id}
                editable={editable}
                onTotalsChange={async ({ final, supplier }) => {
                  if (Number(project.total_cost) === final && Number(project.supplier_cost) === supplier) return;
                  await supabase.from("projects").update({ total_cost: final, supplier_cost: supplier }).eq("id", project.id);
                  void load();
                }}
              />
              {linkedSubs.length > 0 && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Linked subscription{linkedSubs.length > 1 ? "s" : ""}</p>
                    <span className="text-xs text-muted-foreground">Reference only — not included in project totals</span>
                  </div>
                  <ul className="text-sm space-y-1">
                    {linkedSubs.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-medium">{s.plan_name}</span>
                        <span className="text-muted-foreground">{s.billing_cycle}</span>
                        <span>{formatGBP(s.cost)}</span>
                        {s.renewal_date && <span className="text-muted-foreground">renews {formatDateUK(s.renewal_date)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <Tabs defaultValue="milestones">
            <TabsList>
              <TabsTrigger value="milestones">Milestones</TabsTrigger>
              <TabsTrigger value="todos">To-dos</TabsTrigger>
            </TabsList>
            <TabsContent value="milestones" className="mt-4 space-y-4">
              {milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No milestones yet.</p>
              ) : (
                <div className="overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="text-left p-2 w-10">Done</th>
                        <th className="text-left p-2">Milestone</th>
                        <th className="text-left p-2 w-44">Due date</th>
                        <th className="text-left p-2 w-32">Completed</th>
                        {editable && <th className="text-right p-2 w-10" />}
                      </tr>
                    </thead>
                    <tbody>
                      {milestones.map((m) => (
                        <tr key={m.id} className="border-b">
                          <td className="p-2">
                            <Checkbox
                              checked={!!m.completed_at}
                              onCheckedChange={(c) => editable && toggleCompleted(m, c === true)}
                              disabled={!editable}
                            />
                          </td>
                          <td className={`p-2 ${m.completed_at ? "line-through text-muted-foreground" : ""}`}>{relabelForType(m.label, project.type)}</td>
                          <td className="p-2">
                            <Input
                              type="date"
                              value={m.due_date ?? ""}
                              disabled={!editable}
                              onChange={(e) => updateDueDate(m, e.target.value || null)}
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="p-2 text-muted-foreground">{formatDateUK(m.completed_at)}</td>
                          {editable && <td className="p-2 text-right">
                            {m.is_custom && <Button variant="ghost" size="icon" aria-label="Delete custom milestone" onClick={() => removeMilestone(m)}><Trash2 className="size-4" /></Button>}
                          </td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {editable && (
                <div className="flex gap-2 pt-2 border-t">
                  <Input placeholder="Add custom milestone" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
                  <Button onClick={addCustom} disabled={!customLabel.trim()}>Add</Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="todos" className="mt-4">
              <TodoList parentType="project" parentId={project.id} editable={editable} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ProjectDialog open={openEdit} onOpenChange={setOpenEdit} project={project} defaultType={project.type} orgs={orgs} contacts={contacts} profiles={profiles} onSaved={load} />
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold mt-1 ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="text-muted-foreground">{label}:</span> <span className="font-medium">{value}</span></div>;
}

function ProjectDialog({ open, onOpenChange, project, defaultType, orgs, contacts, profiles, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; project: Project | null; defaultType: PType;
  orgs: Org[]; contacts: Contact[]; profiles: Profile[]; onSaved: () => void;
}) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [type, setType] = useState<PType>(defaultType);
  const [status, setStatus] = useState<PStatus>("in_progress");
  const [priority, setPriority] = useState<Priority>("medium");
  const [teamLead, setTeamLead] = useState<string>("__none__");
  const [clientOrg, setClientOrg] = useState<string>("__none__");
  const [clientContact, setClientContact] = useState<string>("__none__");
  const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  const [totalCost, setTotalCost] = useState("0"); const [supplierCost, setSupplierCost] = useState("0");
  const [customVals, setCustomVals] = useState<Record<string, unknown>>({});
  const [localOrgs, setLocalOrgs] = useState<Org[]>(orgs);
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts);
  const [quickOrgOpen, setQuickOrgOpen] = useState(false);
  const [quickContactOpen, setQuickContactOpen] = useState(false);
  useEffect(() => { setLocalOrgs(orgs); }, [orgs]);
  useEffect(() => { setLocalContacts(contacts); }, [contacts]);

  useEffect(() => {
    setTitle(project?.title ?? ""); setDescription(project?.description ?? "");
    setType(project?.type ?? defaultType);
    setStatus(project?.status ?? "in_progress");
    setPriority(project?.priority ?? "medium");
    setTeamLead(project?.team_lead_id ?? "__none__");
    setClientOrg(project?.client_org_id ?? "__none__");
    setClientContact(project?.client_contact_id ?? "__none__");
    setStartDate(project?.start_date ?? ""); setEndDate(project?.end_date ?? "");
    setTotalCost(String(project?.total_cost ?? 0));
    setSupplierCost(String(project?.supplier_cost ?? 0));
    setCustomVals((project?.custom ?? {}) as Record<string, unknown>);
  }, [project, open, defaultType]);

  const submit = async () => {
    if (!title.trim()) return;
    const payload = {
      title, description: description || null, type, status, priority,
      team_lead_id: teamLead === "__none__" ? null : teamLead,
      client_org_id: clientOrg === "__none__" ? null : clientOrg,
      client_contact_id: clientContact === "__none__" ? null : clientContact,
      start_date: startDate || null, end_date: endDate || null,
      total_cost: Number(totalCost) || 0,
      supplier_cost: Number(supplierCost) || 0,
      custom: customVals as never,
    };
    if (project) {
      const { error } = await supabase.from("projects").update(payload).eq("id", project.id);
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "projects", entity_type: type, entity_id: project.id, verb: "updated", summary: `Updated ${type} ${title}` });
    } else {
      const { data, error } = await supabase.from("projects").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      const { data: tpls } = await supabase
        .from("milestone_templates").select("*")
        .eq("module", "projects")
        .or(`project_type.is.null,project_type.eq.${type}`)
        .order("position");
      if (tpls && tpls.length > 0) {
        await supabase.from("milestones").insert(
          (tpls as MTemplate[]).map((t) => ({
            parent_type: "project", parent_id: data.id, project_id: data.id,
            label: relabelForType(t.label, type), position: t.position, is_custom: false,
          })) as never
        );
      }
      await logActivity({ module: "projects", entity_type: type, entity_id: data.id, verb: "created", summary: `Created ${type} ${title}` });
    }
    toast.success("Saved"); onOpenChange(false); onSaved();
  };

  const filteredContacts = clientOrg === "__none__" ? localContacts : localContacts.filter((c) => c.organisation_id === clientOrg);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{project ? "Edit" : "New"} {type}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <ProjectDialogSelects type={type} setType={setType} status={status} setStatus={setStatus} priority={priority} setPriority={setPriority} />
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Team lead</Label>
              <Select value={teamLead} onValueChange={setTeamLead}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Client org</Label>
              <Select value={clientOrg} onValueChange={(v) => { setClientOrg(v); setClientContact("__none__"); }}>
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
              <Label>Client contact</Label>
              <Select value={clientContact} onValueChange={setClientContact}>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start date</Label>
              <div className="flex gap-2">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                {startDate && <Button type="button" variant="ghost" size="sm" onClick={() => setStartDate("")}>Clear</Button>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>End date</Label>
              <div className="flex gap-2">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                {endDate && <Button type="button" variant="ghost" size="sm" onClick={() => setEndDate("")}>Clear</Button>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Final Costs (£)</Label><Input type="number" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} /><p className="text-xs text-muted-foreground">Use the itemised breakdown below to auto-calculate this.</p></div>
            <div className="space-y-1"><Label>Investment (£)</Label><Input type="number" value={supplierCost} onChange={(e) => setSupplierCost(e.target.value)} /></div>
          </div>
          <CustomFieldValues module="projects" value={customVals} onChange={setCustomVals} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground" disabled={!title.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
      <QuickCreateOrgDialog
        open={quickOrgOpen}
        onOpenChange={setQuickOrgOpen}
        onCreated={(newOrg) => {
          setLocalOrgs((prev) => [...prev, newOrg].sort((a, b) => a.name.localeCompare(b.name)));
          setClientOrg(newOrg.id);
          setClientContact("__none__");
        }}
      />
      <QuickCreateContactDialog
        open={quickContactOpen}
        onOpenChange={setQuickContactOpen}
        orgs={localOrgs}
        defaultOrgId={clientOrg === "__none__" ? null : clientOrg}
        onCreated={(newContact) => {
          setLocalContacts((prev) => [...prev, newContact]);
          if (newContact.organisation_id) setClientOrg(newContact.organisation_id);
          setClientContact(newContact.id);
        }}
      />
    </Dialog>
  );
}

function ProjectDialogSelects({
  type, setType, status, setStatus, priority, setPriority,
}: {
  type: PType; setType: (v: PType) => void;
  status: PStatus; setStatus: (v: PStatus) => void;
  priority: Priority; setPriority: (v: Priority) => void;
}) {
  const typeOptions = useBuiltinFieldOptions("projects", "type");
  const statusOptions = useBuiltinFieldOptions("projects", "status");
  const priorityOptions = useBuiltinFieldOptions("projects", "priority");
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="space-y-1">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as PType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{typeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as PStatus)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Priority</Label>
        <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{priorityOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { logActivity } from "@/lib/activity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Search, Download, Upload, ExternalLink, Mail, Zap, FileText, Users, Inbox, Trash } from "lucide-react";
import { toast } from "sonner";
import { formatDateUK } from "@/lib/format";
import { CustomFieldValues } from "@/components/CustomFieldValues";
import { useFiscalYear } from "@/lib/fiscal-year";

export const Route = createFileRoute("/_authenticated/outreach")({ component: OutreachPage });

const STAGES = [
  { key: "first_email", label: "Initial Email Action" },
  { key: "second_email", label: "Follow up Outreach" },
  { key: "third_email", label: "Last Final Touch" },
] as const;
type StageKey = typeof STAGES[number]["key"];

type StageConfig = { due_date?: string | null; template_id?: string | null };
type StagesMap = Partial<Record<StageKey, StageConfig>>;
type CampaignStatus = "planned" | "in_progress" | "completed" | "cancelled";
type Campaign = { id: string; name: string; description: string | null; created_at: string; stages?: StagesMap | null; status: CampaignStatus };
const CAMPAIGN_STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
const ACTIVE_STATUSES: CampaignStatus[] = ["planned", "in_progress"];
type Template = { id: string; name: string; subject: string; body: string; approved: boolean };
type OutreachMap = Partial<Record<StageKey, { sent_at?: string | null; reply?: string | null }>>;
type CC = {
  id: string; campaign_id: string; first_name: string; last_name: string;
  email: string | null; organisation: string | null; industry: string | null;
  website: string | null; job_title: string | null; lead_status: string;
  outreach: OutreachMap; notes: string | null;
};
type LeadOpt = { key: string; label: string };

const statusBadgeClass = (s: CampaignStatus) =>
  s === "in_progress" ? "bg-sky-100 text-sky-800 border-sky-200"
  : s === "planned" ? "bg-slate-100 text-slate-700 border-slate-200"
  : s === "completed" ? "bg-emerald-100 text-emerald-800 border-emerald-200"
  : "bg-rose-100 text-rose-800 border-rose-200";

function OutreachPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("outreach");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contactsByCampaign, setContactsByCampaign] = useState<Record<string, CC[]>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [statusTab, setStatusTab] = useState<"active" | "completed">("active");

  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const loadAll = async () => {
    const [{ data: cs }, { data: cc }, { data: tp }] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("campaign_contacts").select("*"),
      supabase.from("email_templates").select("*").order("name"),
    ]);
    setCampaigns((cs ?? []) as Campaign[]);
    const map: Record<string, CC[]> = {};
    ((cc ?? []) as CC[]).forEach((r) => { (map[r.campaign_id] ||= []).push(r); });
    setContactsByCampaign(map);
    setTemplates((tp ?? []) as Template[]);
  };
  useEffect(() => { void loadAll(); }, []);

  const { inRange } = useFiscalYear();
  const visibleCampaigns = useMemo(() => campaigns.filter((c) => inRange(c.created_at)), [campaigns, inRange]);
  const partitioned = useMemo(() => {
    const active: Campaign[] = [], completed: Campaign[] = [];
    for (const c of visibleCampaigns) {
      if (ACTIVE_STATUSES.includes(c.status)) active.push(c); else completed.push(c);
    }
    active.sort((a, b) => (a.status === "in_progress" ? 0 : 1) - (b.status === "in_progress" ? 0 : 1));
    return { active, completed };
  }, [visibleCampaigns]);

  // Auto-select the first campaign in view
  useEffect(() => {
    if (activeId && visibleCampaigns.some((c) => c.id === activeId)) return;
    const list = statusTab === "active" ? partitioned.active : partitioned.completed;
    setActiveId(list[0]?.id ?? null);
  }, [activeId, statusTab, partitioned, visibleCampaigns]);

  const active = useMemo(() => campaigns.find((c) => c.id === activeId) ?? null, [campaigns, activeId]);

  const removeCampaign = async (c: Campaign) => {
    if (!confirm(`Delete campaign "${c.name}"?`)) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await logActivity({ module: "outreach", entity_type: "campaign", entity_id: c.id, verb: "deleted", summary: `Deleted campaign ${c.name}` });
    toast.success("Deleted"); if (activeId === c.id) setActiveId(null); void loadAll();
  };
  const updateStatus = async (c: Campaign, next: CampaignStatus) => {
    const { error } = await supabase.from("campaigns").update({ status: next } as never).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    void loadAll();
  };
  const removeTemplate = async (t: Template) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    const { error } = await supabase.from("email_templates").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); void loadAll();
  };

  const list = statusTab === "active" ? partitioned.active : partitioned.completed;

  return (
    <div className="py-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Email Outreach</h1>
        <p className="text-muted-foreground mt-1 text-sm">Plan and track campaigns. Emails are sent from your own mailbox.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left rail */}
        <aside className="lg:col-span-3 flex flex-col gap-6">
          {/* Outbox */}
          <section className="bg-card rounded-2xl border border-border/60 shadow-soft flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                  <Inbox className="size-3.5" /> Campaign Outbox
                </h2>
                {editable && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 -mr-1" aria-label="New campaign"
                    onClick={() => { setEditingCampaign(null); setCampaignDialogOpen(true); }}>
                    <Plus className="size-3.5" />
                  </Button>
                )}
              </div>
              <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as "active" | "completed")}>
                <TabsList className="w-full">
                  <TabsTrigger value="active" className="flex-1 text-xs">Active ({partitioned.active.length})</TabsTrigger>
                  <TabsTrigger value="completed" className="flex-1 text-xs">Completed ({partitioned.completed.length})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex-1 max-h-[440px] overflow-y-auto p-2 space-y-1">
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No campaigns.</p>
              ) : list.map((c) => {
                const isActive = c.id === activeId;
                const contacts = contactsByCampaign[c.id] ?? [];
                const replies = contacts.filter((x) => x.lead_status && !["no_reply", "no_response"].includes(x.lead_status)).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left p-3 rounded-xl transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-sm truncate">{c.name}</span>
                      <span className={`px-2 py-0.5 text-[9px] rounded-full uppercase font-bold tracking-wider shrink-0 border ${
                        isActive ? "bg-white/15 text-primary-foreground border-white/20" : statusBadgeClass(c.status)
                      }`}>
                        {CAMPAIGN_STATUS_OPTIONS.find((o) => o.value === c.status)?.label ?? c.status}
                      </span>
                    </div>
                    <div className={`mt-2 flex gap-3 text-[10px] ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      <span>{contacts.length} Recipient{contacts.length === 1 ? "" : "s"}</span>
                      <span>{replies} Repl{replies === 1 ? "y" : "ies"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Templates */}
          <section className="bg-card rounded-2xl border border-border/60 shadow-soft flex flex-col">
            <div className="p-4 border-b border-border/60 flex justify-between items-center">
              <h2 className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                <FileText className="size-3.5" /> Templates
              </h2>
              {editable && (
                <Button size="sm" variant="ghost" className="h-7 px-2 -mr-1" aria-label="New template"
                  onClick={() => { setEditingTemplate(null); setTemplateDialogOpen(true); }}>
                  <Plus className="size-3.5" />
                </Button>
              )}
            </div>
            <div className="p-2 max-h-[280px] overflow-y-auto space-y-0.5">
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No templates yet.</p>
              ) : templates.map((t) => (
                <div key={t.id} className="group flex items-center justify-between gap-2 p-2.5 rounded-xl hover:bg-muted/60 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground truncate">{t.name}</div>
                    {t.approved && <div className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider">Approved</div>}
                  </div>
                  {editable && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Edit template"
                        onClick={() => { setEditingTemplate(t); setTemplateDialogOpen(true); }}>
                        <Pencil className="size-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" aria-label="Delete template"
                        onClick={() => removeTemplate(t)}>
                        <Trash className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* Main workspace */}
        <main className="lg:col-span-9">
          {active ? (
            <CampaignWorkspace
              campaign={active}
              editable={editable}
              templates={templates}
              contacts={contactsByCampaign[active.id] ?? []}
              onDelete={() => removeCampaign(active)}
              onStatusChange={(v) => void updateStatus(active, v)}
              onEdit={() => { setEditingCampaign(active); setCampaignDialogOpen(true); }}
              onReload={loadAll}
              onEditTemplate={(id) => {
                const t = templates.find((x) => x.id === id);
                if (t) { setEditingTemplate(t); setTemplateDialogOpen(true); }
              }}
            />
          ) : (
            <div className="bg-card rounded-2xl border border-border/60 shadow-soft p-12 text-center">
              <Mail className="size-10 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">Select a campaign from the outbox, or create a new one.</p>
              {editable && (
                <Button className="mt-4 bg-gradient-primary text-primary-foreground"
                  onClick={() => { setEditingCampaign(null); setCampaignDialogOpen(true); }}>
                  <Plus className="size-4 mr-2" /> New campaign
                </Button>
              )}
            </div>
          )}
        </main>
      </div>

      <CampaignDialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen} campaign={editingCampaign} onSaved={loadAll} />
      <TemplateDialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen} template={editingTemplate} onSaved={loadAll} />
    </div>
  );
}

function CampaignWorkspace({
  campaign, editable, templates, contacts, onDelete, onStatusChange, onEdit, onReload, onEditTemplate,
}: {
  campaign: Campaign;
  editable: boolean;
  templates: Template[];
  contacts: CC[];
  onDelete: () => void;
  onStatusChange: (v: CampaignStatus) => void;
  onEdit: () => void;
  onReload: () => Promise<void> | void;
  onEditTemplate: (id: string) => void;
}) {
  const [leadOpts, setLeadOpts] = useState<LeadOpt[]>([]);
  const [stages, setStages] = useState<StagesMap>(campaign.stages ?? {});
  const [rows, setRows] = useState<CC[]>(contacts);
  const [q, setQ] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CC | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setStages(campaign.stages ?? {}); }, [campaign.id, campaign.stages]);
  useEffect(() => { setRows(contacts); }, [contacts]);
  useEffect(() => {
    void supabase.from("lead_status_options").select("key,label").order("position")
      .then(({ data }) => setLeadOpts((data ?? []) as LeadOpt[]));
  }, []);

  const TEMPLATE_HEADERS = ["first_name", "last_name", "email", "job_title", "organisation", "industry", "website", "notes"];
  const downloadTemplate = () => {
    const csv = TEMPLATE_HEADERS.join(",") + "\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = "campaign_contacts_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const parseLine = (line: string): string[] => {
      const out: string[] = []; let cur = ""; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQ) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') inQ = false;
          else cur += ch;
        } else {
          if (ch === '"') inQ = true;
          else if (ch === ",") { out.push(cur); cur = ""; }
          else cur += ch;
        }
      }
      out.push(cur); return out;
    };
    const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cells = parseLine(line); const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
      return row;
    });
  };
  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const parsed = parseCSV(await file.text());
    if (parsed.length === 0) { toast.error("CSV is empty"); return; }
    if (!confirm(`Import ${parsed.length} contact(s) into "${campaign.name}"?`)) return;
    const payload = parsed.map((r) => ({
      campaign_id: campaign.id,
      first_name: r.first_name || "", last_name: r.last_name || "",
      email: r.email || null, job_title: r.job_title || null,
      organisation: r.organisation || null, industry: r.industry || null,
      website: r.website || null, notes: r.notes || null, lead_status: "no_reply",
    }));
    const { error } = await supabase.from("campaign_contacts").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${payload.length} contact(s)`); void onReload();
  };

  const filtered = useMemo(() => rows.filter((r) => !q || [r.first_name, r.last_name, r.email, r.organisation].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()))), [rows, q]);

  const updateStageConfig = async (stage: StageKey, patch: Partial<StageConfig>) => {
    if (!editable) return;
    const next: StagesMap = { ...stages, [stage]: { ...(stages[stage] || {}), ...patch } };
    setStages(next);
    const { error } = await supabase.from("campaigns").update({ stages: next as never }).eq("id", campaign.id);
    if (error) { toast.error(error.message); void onReload(); }
  };

  const removeContact = async (r: CC) => {
    if (!confirm("Delete contact?")) return;
    const { error } = await supabase.from("campaign_contacts").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); void onReload();
  };

  const updateStage = async (r: CC, stage: StageKey, next: { sent_at?: string | null } | null) => {
    const current: OutreachMap = { ...(r.outreach || {}) };
    if (next === null) delete current[stage]; else current[stage] = { ...(current[stage] || {}), ...next };
    setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, outreach: current } : x));
    const { error } = await supabase.from("campaign_contacts").update({ outreach: current as never }).eq("id", r.id);
    if (error) { toast.error(error.message); void onReload(); }
  };
  const toggleStage = (r: CC, stage: StageKey, checked: boolean) => {
    if (!editable) return;
    if (checked) void updateStage(r, stage, { sent_at: new Date().toISOString() });
    else void updateStage(r, stage, null);
  };

  // For the "Template Association" summary dropdown at bottom — writes to all stages that don't yet have a template
  const anyTemplateId = stages.first_email?.template_id ?? stages.second_email?.template_id ?? stages.third_email?.template_id ?? null;

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-soft p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 bg-muted text-foreground text-[10px] font-bold rounded-lg uppercase tracking-wider">Campaign Engine</span>
            {editable ? (
              <Select value={campaign.status} onValueChange={(v) => onStatusChange(v as CampaignStatus)}>
                <SelectTrigger className={`h-7 w-auto gap-2 text-[10px] font-bold uppercase tracking-wider border ${statusBadgeClass(campaign.status)}`}>
                  <span>Stage: <SelectValue /></span>
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider border ${statusBadgeClass(campaign.status)}`}>
                Stage: {CAMPAIGN_STATUS_OPTIONS.find((o) => o.value === campaign.status)?.label}
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground pt-1 truncate">{campaign.name}</h1>
          {campaign.description && <p className="text-sm text-muted-foreground italic">{campaign.description}</p>}
        </div>
        {editable && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="size-3.5 mr-2" />Edit</Button>
            <Button variant="outline" size="sm" onClick={onDelete}
              className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive">
              <Trash2 className="size-3.5 mr-2" />Delete Campaign
            </Button>
          </div>
        )}
      </div>

      {/* Sequence */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-1.5 bg-muted rounded-lg">
            <Zap className="size-4 text-foreground" />
          </div>
          <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">FOLLOW-UP SCHEDULE</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STAGES.map((s, idx) => {
            const cfg = stages[s.key] || {};
            const linked = templates.find((t) => t.id === cfg.template_id);
            return (
              <div key={s.key} className="relative bg-muted/40 rounded-2xl p-5 border border-border/60 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 bg-card shadow-sm border border-border/60 rounded-full flex items-center justify-center text-xs font-bold text-foreground">
                    {idx + 1}
                  </div>
                  {linked && (
                    <button
                      type="button"
                      onClick={() => onEditTemplate(linked.id)}
                      className="text-[10px] uppercase tracking-wider font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <FileText className="size-3" /> {linked.name}
                    </button>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-foreground text-sm">{s.label}</h4>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Planned</Label>
                    <Input
                      type="date"
                      className="h-8 bg-card"
                      value={cfg.due_date ?? ""}
                      disabled={!editable}
                      onChange={(e) => void updateStageConfig(s.key, { due_date: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Template</Label>
                    <Select
                      value={cfg.template_id ?? "__none__"}
                      onValueChange={(v) => void updateStageConfig(s.key, { template_id: v === "__none__" ? null : v })}
                      disabled={!editable}
                    >
                      <SelectTrigger className="h-8 text-xs bg-card"><SelectValue placeholder="Select template" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Template quick-open */}
      {anyTemplateId && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><FileText className="size-4" /></div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Template Association</h3>
          </div>
          <Button variant="outline" size="sm" onClick={() => onEditTemplate(anyTemplateId)}>
            <ExternalLink className="size-3.5 mr-2" />
            Open {templates.find((t) => t.id === anyTemplateId)?.name ?? "template"}
          </Button>
        </section>
      )}

      {/* Receivers */}
      <section>
        <div className="flex justify-between items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Users className="size-4" /></div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Target Receivers ({rows.length})</h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input className="pl-8 h-9 w-[200px]" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {editable && <>
              <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="size-3.5 mr-2" />CSV</Button>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="size-3.5 mr-2" />Import</Button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onImport} />
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => { setEditingContact(null); setContactOpen(true); }}>
                <Plus className="size-3.5 mr-2" />Add Recipient
              </Button>
            </>}
          </div>
        </div>

        <div className="border border-border/60 rounded-2xl overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Contact</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Lead status</TableHead>
                {STAGES.map((s) => <TableHead key={s.key} className="whitespace-nowrap">{s.label}</TableHead>)}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4 + STAGES.length} className="text-center text-muted-foreground py-8">No contacts in this campaign.</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-semibold text-sm text-foreground">{r.first_name} {r.last_name}</div>
                    {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{r.organisation || "—"}</div>
                    {r.job_title && <div className="text-xs text-muted-foreground">{r.job_title}</div>}
                  </TableCell>
                  <TableCell>
                    {editable ? (
                      <Select
                        value={r.lead_status}
                        onValueChange={async (v) => {
                          setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, lead_status: v } : x));
                          const { error } = await supabase.from("campaign_contacts").update({ lead_status: v }).eq("id", r.id);
                          if (error) { toast.error(error.message); void onReload(); }
                        }}
                      >
                        <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{leadOpts.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{leadOpts.find((o) => o.key === r.lead_status)?.label ?? r.lead_status}</Badge>
                    )}
                  </TableCell>
                  {STAGES.map((s) => {
                    const stageData = r.outreach?.[s.key];
                    const checked = !!stageData?.sent_at;
                    return (
                      <TableCell key={s.key} className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={checked} disabled={!editable} onCheckedChange={(v) => toggleStage(r, s.key, !!v)} />
                          <span className="text-xs text-muted-foreground tabular-nums w-[80px]">
                            {checked ? formatDateUK(stageData?.sent_at) : "—"}
                          </span>
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right">
                    {editable && <>
                      <Button variant="ghost" size="icon" aria-label="Edit contact" onClick={() => { setEditingContact(r); setContactOpen(true); }}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Delete contact" onClick={() => removeContact(r)}><Trash2 className="size-4" /></Button>
                    </>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <CCDialog open={contactOpen} onOpenChange={setContactOpen} contact={editingContact} campaignId={campaign.id} leadOpts={leadOpts} onSaved={onReload} />
      </section>
    </div>
  );
}

function CampaignDialog({ open, onOpenChange, campaign, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; campaign: Campaign | null; onSaved: () => void }) {
  const [name, setName] = useState(""); const [description, setDescription] = useState("");
  useEffect(() => { setName(campaign?.name ?? ""); setDescription(campaign?.description ?? ""); }, [campaign, open]);
  const submit = async () => {
    if (!name.trim()) return;
    const payload = { name, description: description || null };
    if (campaign) {
      const { error } = await supabase.from("campaigns").update(payload).eq("id", campaign.id);
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "outreach", entity_type: "campaign", entity_id: campaign.id, verb: "updated", summary: `Updated campaign ${name}` });
    } else {
      const { data, error } = await supabase.from("campaigns").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "outreach", entity_type: "campaign", entity_id: data.id, verb: "created", summary: `Created campaign ${name}` });
    }
    toast.success("Saved"); onOpenChange(false); onSaved();
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[95vw] sm:max-w-[min(800px,95vw)] flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b shrink-0"><SheetTitle>{campaign ? "Edit campaign" : "New campaign"}</SheetTitle></SheetHeader>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="space-y-1"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Description</Label><Textarea rows={6} className="min-h-[140px]" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <SheetFooter className="p-6 pt-4 border-t shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground" disabled={!name.trim()}>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CCDialog({ open, onOpenChange, contact, campaignId, leadOpts, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; contact: CC | null; campaignId: string; leadOpts: LeadOpt[]; onSaved: () => void | Promise<void>;
}) {
  const [first, setFirst] = useState(""); const [last, setLast] = useState("");
  const [email, setEmail] = useState(""); const [org, setOrg] = useState("");
  const [industry, setIndustry] = useState(""); const [website, setWebsite] = useState("");
  const [jobTitle, setJobTitle] = useState(""); const [status, setStatus] = useState("no_reply");
  const [notes, setNotes] = useState("");
  const [custom, setCustom] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setFirst(contact?.first_name ?? ""); setLast(contact?.last_name ?? "");
    setEmail(contact?.email ?? ""); setOrg(contact?.organisation ?? "");
    setIndustry(contact?.industry ?? ""); setWebsite(contact?.website ?? "");
    setJobTitle(contact?.job_title ?? ""); setStatus(contact?.lead_status ?? "no_reply");
    setNotes(contact?.notes ?? "");
    setCustom(((contact as unknown as { custom?: Record<string, unknown> })?.custom) ?? {});
  }, [contact, open]);

  const submit = async () => {
    const payload = {
      campaign_id: campaignId, first_name: first, last_name: last,
      email: email || null, organisation: org || null, industry: industry || null,
      website: website || null, job_title: jobTitle || null, lead_status: status, notes: notes || null,
      custom: custom as never,
    };
    if (contact) {
      const { error } = await supabase.from("campaign_contacts").update(payload).eq("id", contact.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("campaign_contacts").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Saved"); onOpenChange(false); await onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[95vw] sm:max-w-[min(900px,95vw)] flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b shrink-0"><SheetTitle>{contact ? "Edit contact" : "Add contact"}</SheetTitle></SheetHeader>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>First name</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} /></div>
            <div className="space-y-1"><Label>Last name</Label><Input value={last} onChange={(e) => setLast(e.target.value)} /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1"><Label>Job title</Label><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
            <div className="space-y-1"><Label>Organisation</Label><Input value={org} onChange={(e) => setOrg(e.target.value)} /></div>
            <div className="space-y-1"><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
            <div className="space-y-1 md:col-span-2"><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></div>
            <div className="space-y-1 md:col-span-2">
              <Label>Lead status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{leadOpts.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea rows={5} className="min-h-[120px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <CustomFieldValues module="outreach" value={custom} onChange={setCustom} />
        </div>
        <SheetFooter className="p-6 pt-4 border-t shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground">Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function TemplateDialog({ open, onOpenChange, template, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; template: Template | null; onSaved: () => void }) {
  const [name, setName] = useState(""); const [subject, setSubject] = useState("");
  const [body, setBody] = useState(""); const [approved, setApproved] = useState(false);
  useEffect(() => {
    setName(template?.name ?? ""); setSubject(template?.subject ?? "");
    setBody(template?.body ?? ""); setApproved(template?.approved ?? false);
  }, [template, open]);

  const submit = async () => {
    if (!name.trim() || !subject.trim()) return;
    const payload = { name, subject, body, approved };
    if (template) {
      const { error } = await supabase.from("email_templates").update(payload).eq("id", template.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("email_templates").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Saved"); onOpenChange(false); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[95vw] sm:max-w-[min(1100px,95vw)] flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b shrink-0"><SheetTitle>{template ? "Edit email template" : "New email template"}</SheetTitle></SheetHeader>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="space-y-1"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Subject *</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="space-y-1"><Label>Body</Label><Textarea rows={18} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Use {{first_name}}, {{organisation}}, etc." className="min-h-[400px]" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />Approved for use</label>
        </div>
        <SheetFooter className="p-6 pt-4 border-t shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground" disabled={!name.trim() || !subject.trim()}>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

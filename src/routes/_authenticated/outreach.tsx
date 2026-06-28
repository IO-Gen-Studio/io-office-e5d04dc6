import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { logActivity } from "@/lib/activity";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ArrowLeft, Search, Download, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDateUK } from "@/lib/format";
import { CustomFieldValues } from "@/components/CustomFieldValues";
import { useFiscalYear } from "@/lib/fiscal-year";

export const Route = createFileRoute("/_authenticated/outreach")({ component: OutreachPage });

const STAGES = [
  { key: "first_email", label: "First email" },
  { key: "second_email", label: "Second email" },
  { key: "third_email", label: "Third email" },
] as const;
type StageKey = typeof STAGES[number]["key"];

type StageConfig = { due_date?: string | null; template_id?: string | null };
type StagesMap = Partial<Record<StageKey, StageConfig>>;
type Campaign = { id: string; name: string; description: string | null; created_at: string; stages?: StagesMap | null };
type Template = { id: string; name: string; subject: string; body: string; approved: boolean };
type OutreachMap = Partial<Record<StageKey, { sent_at?: string | null; reply?: string | null }>>;
type CC = {
  id: string; campaign_id: string; first_name: string; last_name: string;
  email: string | null; organisation: string | null; industry: string | null;
  website: string | null; job_title: string | null; lead_status: string;
  outreach: OutreachMap; notes: string | null;
};
type LeadOpt = { key: string; label: string };


function OutreachPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("outreach");
  const [active, setActive] = useState<Campaign | null>(null);
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Email Outreach</h1>
          <p className="text-muted-foreground mt-1">Plan and track campaigns. Emails are sent from your own mailbox.</p>
        </div>
      </div>
      {active ? (
        <CampaignDetail campaign={active} editable={editable} onBack={() => setActive(null)} />
      ) : (
        <Tabs defaultValue="campaigns">
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="templates">Email Templates</TabsTrigger>
          </TabsList>
          <TabsContent value="campaigns" className="mt-4"><CampaignsTab editable={editable} onOpen={setActive} /></TabsContent>
          <TabsContent value="templates" className="mt-4"><TemplatesTab editable={editable} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function CampaignsTab({ editable, onOpen }: { editable: boolean; onOpen: (c: Campaign) => void }) {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [contactsByCampaign, setContactsByCampaign] = useState<Record<string, CC[]>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const load = async () => {
    const [{ data: cs }, { data: cc }] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("campaign_contacts").select("*"),
    ]);
    setRows((cs ?? []) as Campaign[]);
    const map: Record<string, CC[]> = {};
    ((cc ?? []) as CC[]).forEach((r) => { (map[r.campaign_id] ||= []).push(r); });
    setContactsByCampaign(map);
  };
  useEffect(() => { void load(); }, []);
  const { inRange } = useFiscalYear();
  const visibleCampaigns = useMemo(() => rows.filter((c) => inRange(c.created_at)), [rows, inRange]);

  const computeNext = (c: Campaign, contacts: CC[]): { label: string; date: string } => {
    if (!contacts || contacts.length === 0) return { label: "Add contacts", date: "—" };
    const stagesMap = (c.stages ?? {}) as StagesMap;
    for (const stage of STAGES) {
      const pending = contacts.filter((x) => !x.outreach?.[stage.key]?.sent_at);
      if (pending.length > 0) {
        const due = stagesMap[stage.key]?.due_date;
        return { label: stage.label, date: due ? formatDateUK(due) : "Not scheduled" };
      }
    }
    return { label: "Complete", date: "—" };
  };

  const remove = async (c: Campaign) => {
    if (!confirm(`Delete campaign "${c.name}"?`)) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await logActivity({ module: "outreach", entity_type: "campaign", entity_id: c.id, verb: "deleted", summary: `Deleted campaign ${c.name}` });
    toast.success("Deleted"); void load();
  };

  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6 space-y-4">
        <div className="flex justify-end">
          {editable && <Button className="bg-gradient-primary text-primary-foreground" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />New campaign</Button>}
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Contacts</TableHead>
            <TableHead>Next action</TableHead>
            <TableHead>Next action date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {visibleCampaigns.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No campaigns yet.</TableCell></TableRow> :
              visibleCampaigns.map((c) => {
                const contacts = contactsByCampaign[c.id] ?? [];
                const next = computeNext(c, contacts);
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    tabIndex={0}
                    onClick={() => onOpen(c)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpen(c);
                      }
                    }}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.description || "—"}</TableCell>
                    <TableCell className="text-right">{contacts.length}</TableCell>
                    <TableCell>{next.label}</TableCell>
                    <TableCell className="text-muted-foreground">{next.date}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {editable && <>
                        <Button variant="ghost" size="icon" aria-label="Edit campaign" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="Delete campaign" onClick={() => remove(c)}><Trash2 className="size-4" /></Button>
                      </>}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
        <CampaignDialog open={open} onOpenChange={setOpen} campaign={editing} onSaved={load} />
      </CardContent>
    </Card>
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

function CampaignDetail({ campaign, editable, onBack }: { campaign: Campaign; editable: boolean; onBack: () => void }) {
  const [rows, setRows] = useState<CC[]>([]);
  const [leadOpts, setLeadOpts] = useState<LeadOpt[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stages, setStages] = useState<StagesMap>(campaign.stages ?? {});
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const TEMPLATE_HEADERS = ["first_name", "last_name", "email", "job_title", "organisation", "industry", "website", "notes"];

  const downloadTemplate = () => {
    const csv = TEMPLATE_HEADERS.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "campaign_contacts_template.csv"; a.click();
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
          else if (ch === '"') { inQ = false; }
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
      const cells = parseLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
      return row;
    });
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length === 0) { toast.error("CSV is empty"); return; }
    if (!confirm(`Import ${parsed.length} contact(s) into "${campaign.name}"?`)) return;
    const payload = parsed.map((r) => ({
      campaign_id: campaign.id,
      first_name: r.first_name || "",
      last_name: r.last_name || "",
      email: r.email || null,
      job_title: r.job_title || null,
      organisation: r.organisation || null,
      industry: r.industry || null,
      website: r.website || null,
      notes: r.notes || null,
      lead_status: "no_reply",
    }));
    const { error } = await supabase.from("campaign_contacts").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${payload.length} contact(s)`);
    void load();
  };

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CC | null>(null);

  const load = async () => {
    const [{ data: c }, { data: l }, { data: t }, { data: cm }] = await Promise.all([
      supabase.from("campaign_contacts").select("*").eq("campaign_id", campaign.id).order("created_at"),
      supabase.from("lead_status_options").select("key,label").order("position"),
      supabase.from("email_templates").select("*").order("name"),
      supabase.from("campaigns").select("stages").eq("id", campaign.id).maybeSingle(),
    ]);
    setRows((c ?? []) as CC[]);
    setLeadOpts((l ?? []) as LeadOpt[]);
    setTemplates((t ?? []) as Template[]);
    setStages(((cm?.stages ?? {}) as StagesMap));
  };
  useEffect(() => { void load(); }, [campaign.id]);

  const filtered = useMemo(() => rows.filter((r) => !q || [r.first_name, r.last_name, r.email, r.organisation].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()))), [rows, q]);

  const updateStageConfig = async (stage: StageKey, patch: Partial<StageConfig>) => {
    if (!editable) return;
    const next: StagesMap = { ...stages, [stage]: { ...(stages[stage] || {}), ...patch } };
    setStages(next);
    const { error } = await supabase.from("campaigns").update({ stages: next as never }).eq("id", campaign.id);
    if (error) { toast.error(error.message); void load(); }
  };

  const openTemplate = (id: string | null | undefined) => {
    const t = templates.find((x) => x.id === id);
    if (!t) { toast.error("Select a template first"); return; }
    setEditTemplate(t);
    setTemplateOpen(true);
  };

  const remove = async (r: CC) => {
    if (!confirm("Delete contact?")) return;
    const { error } = await supabase.from("campaign_contacts").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); void load();
  };

  const updateStage = async (r: CC, stage: StageKey, next: { sent_at?: string | null } | null) => {
    const current: OutreachMap = { ...(r.outreach || {}) };
    if (next === null) {
      delete current[stage];
    } else {
      current[stage] = { ...(current[stage] || {}), ...next };
    }
    // optimistic
    setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, outreach: current } : x));
    const { error } = await supabase.from("campaign_contacts").update({ outreach: current as never }).eq("id", r.id);
    if (error) { toast.error(error.message); void load(); }
  };

  const toggleStage = (r: CC, stage: StageKey, checked: boolean) => {
    if (!editable) return;
    if (checked) void updateStage(r, stage, { sent_at: new Date().toISOString() });
    else void updateStage(r, stage, null);
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4 mr-1" />Campaigns</Button>
        <div>
          <h2 className="text-xl font-semibold">{campaign.name}</h2>
          {campaign.description && <p className="text-sm text-muted-foreground">{campaign.description}</p>}
        </div>
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-6 space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Outreach schedule</h3>
            <p className="text-xs text-muted-foreground">Set a due date and link an email template for each stage of this campaign.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {STAGES.map((s) => {
              const cfg = stages[s.key] || {};
              const linked = templates.find((t) => t.id === cfg.template_id);
              return (
                <div key={s.key} className="rounded-md border bg-card/40 p-3 space-y-2">
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Due date</Label>
                    <Input
                      type="date"
                      className="h-8"
                      value={cfg.due_date ?? ""}
                      disabled={!editable}
                      onChange={(e) => void updateStageConfig(s.key, { due_date: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email template</Label>
                    <div className="flex gap-1">
                      <Select
                        value={cfg.template_id ?? "__none__"}
                        onValueChange={(v) => void updateStageConfig(s.key, { template_id: v === "__none__" ? null : v })}
                        disabled={!editable}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select template" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 shrink-0 md:h-8 md:w-8"
                        aria-label={linked ? `Open ${linked.name}` : "Open selected template"}
                        title={linked ? `Open "${linked.name}"` : "Select a template first"}
                        disabled={!linked}
                        onClick={() => openTemplate(cfg.template_id)}
                      >
                        <ExternalLink className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search contacts" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {editable && <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={downloadTemplate}><Download className="size-4 mr-2" />CSV template</Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4 mr-2" />Import CSV</Button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onImport} />
              <Button className="bg-gradient-primary text-primary-foreground" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />Add contact</Button>
            </div>}
          </div>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Organisation</TableHead>
              <TableHead>Lead status</TableHead>
              {STAGES.map((s) => <TableHead key={s.key} className="whitespace-nowrap">{s.label}</TableHead>)}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? <TableRow><TableCell colSpan={5 + STAGES.length} className="text-center text-muted-foreground py-8">No contacts in this campaign.</TableCell></TableRow> :
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.first_name} {r.last_name}</TableCell>
                    <TableCell>{r.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.organisation || "—"}</TableCell>
                    <TableCell>
                      {editable ? (
                        <Select
                          value={r.lead_status}
                          onValueChange={async (v) => {
                            setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, lead_status: v } : x));
                            const { error } = await supabase.from("campaign_contacts").update({ lead_status: v }).eq("id", r.id);
                            if (error) { toast.error(error.message); void load(); }
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
                            <span className="text-sm text-muted-foreground tabular-nums w-[100px]">
                              {checked ? formatDateUK(stageData?.sent_at) : "—"}
                            </span>
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right">
                      {editable && <>
                        <Button variant="ghost" size="icon" aria-label="Edit contact" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="Delete contact" onClick={() => remove(r)}><Trash2 className="size-4" /></Button>
                      </>}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          </div>
          <CCDialog open={open} onOpenChange={setOpen} contact={editing} campaignId={campaign.id} leadOpts={leadOpts} onSaved={load} />
        </CardContent>
      </Card>
      <TemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} template={editTemplate} onSaved={load} />
    </div>
  );
}

function CCDialog({ open, onOpenChange, contact, campaignId, leadOpts, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; contact: CC | null; campaignId: string; leadOpts: LeadOpt[]; onSaved: () => void;
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
    toast.success("Saved"); onOpenChange(false); onSaved();
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

function TemplatesTab({ editable }: { editable: boolean }) {
  const [rows, setRows] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  const load = async () => {
    const { data } = await supabase.from("email_templates").select("*").order("name");
    setRows((data ?? []) as Template[]);
  };
  useEffect(() => { void load(); }, []);

  const remove = async (t: Template) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    const { error } = await supabase.from("email_templates").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); void load();
  };

  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6 space-y-4">
        <div className="flex justify-end">
          {editable && <Button className="bg-gradient-primary text-primary-foreground" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />New email template</Button>}
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Subject</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No templates yet.</TableCell></TableRow> :
              rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.subject}</TableCell>
                  <TableCell>{t.approved ? <Badge>Approved</Badge> : <Badge variant="secondary">Draft</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {editable && <>
                      <Button variant="ghost" size="icon" aria-label="Edit email template" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Delete email template" onClick={() => remove(t)}><Trash2 className="size-4" /></Button>
                    </>}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <TemplateDialog open={open} onOpenChange={setOpen} template={editing} onSaved={load} />
      </CardContent>
    </Card>
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

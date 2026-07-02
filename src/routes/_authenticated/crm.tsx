import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { logActivity } from "@/lib/activity";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Plus, Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { CustomFieldValues } from "@/components/CustomFieldValues";
import { useCustomFieldColumns } from "@/components/CustomFieldDisplay";

export const Route = createFileRoute("/_authenticated/crm")({ component: CrmPage });

type Org = { id: string; name: string; industry: string | null; website: string | null; notes: string | null; custom?: Record<string, unknown> | null };
type Contact = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; job_title: string | null; organisation_id: string | null; is_lead: boolean; notes: string | null; custom?: Record<string, unknown> | null };

function CrmPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("crm");
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground mt-1">Contacts, leads and organisations.</p>
        </div>
      </div>
      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="orgs">Organisations</TabsTrigger>
        </TabsList>
        <TabsContent value="contacts" className="mt-4"><ContactsTab editable={editable} /></TabsContent>
        <TabsContent value="orgs" className="mt-4"><OrgsTab editable={editable} /></TabsContent>
      </Tabs>
    </div>
  );
}

function OrgsTab({ editable }: { editable: boolean }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [editing, setEditing] = useState<Org | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("organisations").select("*").order("name");
    setOrgs((data ?? []) as Org[]);
  };
  useEffect(() => { void load(); }, []);

  const remove = async (o: Org) => {
    if (!confirm(`Delete organisation "${o.name}"?`)) return;
    const { error } = await supabase.from("organisations").delete().eq("id", o.id);
    if (error) { toast.error(error.message); return; }
    await logActivity({ module: "crm", entity_type: "organisation", entity_id: o.id, verb: "deleted", summary: `Deleted organisation ${o.name}` });
    toast.success("Deleted"); void load();
  };

  const saveCell = async (row: Org, key: string, value: unknown) => {
    const { error } = await supabase.from("organisations").update({ [key]: value } as never).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const columns: DataTableColumn<Org>[] = [
    { key: "name", header: "Name", accessor: (r) => r.name, editable, type: "text" },
    { key: "industry", header: "Industry", accessor: (r) => r.industry ?? "", editable, type: "text" },
    {
      key: "website", header: "Website", accessor: (r) => r.website ?? "",
      render: (r) => r.website ? <a href={r.website} target="_blank" rel="noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{r.website}</a> : <span className="text-muted-foreground">—</span>,
      editable, type: "text",
    },
  ];
  const customCols = useCustomFieldColumns<Org>("crm");
  const allColumns = [...columns, ...customCols];

  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <DataTable
          tableKey="crm.orgs"
          columns={allColumns}
          rows={orgs}
          rowId={(r) => r.id}
          onSaveCell={saveCell}
          emptyMessage="No organisations yet."
          toolbarLeft={editable && <Button className="bg-gradient-primary text-primary-foreground" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />New organisation</Button>}
          actions={editable ? (o) => (
            <>
              <Button variant="ghost" size="icon" aria-label={`Edit ${o.name}`} onClick={() => { setEditing(o); setOpen(true); }}><Pencil className="size-4" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Delete ${o.name}`} onClick={() => remove(o)}><Trash2 className="size-4" /></Button>
            </>
          ) : undefined}
        />
        <OrgDialog open={open} onOpenChange={setOpen} org={editing} onSaved={load} />
      </CardContent>
    </Card>
  );
}

function OrgDialog({ open, onOpenChange, org, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; org: Org | null; onSaved: () => void }) {
  const [name, setName] = useState(""); const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState(""); const [notes, setNotes] = useState("");
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  useEffect(() => {
    setName(org?.name ?? ""); setIndustry(org?.industry ?? "");
    setWebsite(org?.website ?? ""); setNotes(org?.notes ?? "");
    setCustom((org?.custom as Record<string, unknown>) ?? {});
  }, [org, open]);

  const submit = async () => {
    if (!name.trim()) return;
    const payload = { name, industry: industry || null, website: website || null, notes: notes || null, custom: custom as never };
    if (org) {
      const { error } = await supabase.from("organisations").update(payload).eq("id", org.id);
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "crm", entity_type: "organisation", entity_id: org.id, verb: "updated", summary: `Updated organisation ${name}` });
    } else {
      const { data, error } = await supabase.from("organisations").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "crm", entity_type: "organisation", entity_id: data.id, verb: "created", summary: `Created organisation ${name}` });
    }
    toast.success("Saved"); onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{org ? "Edit organisation" : "New organisation"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
            <div className="space-y-1"><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <CustomFieldValues module="crm" value={custom} onChange={setCustom} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground" disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContactsTab({ editable }: { editable: boolean }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [{ data: c }, { data: o }] = await Promise.all([
      supabase.from("contacts").select("*").order("created_at", { ascending: false }),
      supabase.from("organisations").select("id, name, industry, website, notes").order("name"),
    ]);
    setContacts((c ?? []) as Contact[]); setOrgs((o ?? []) as Org[]);
  };
  useEffect(() => { void load(); }, []);

  const remove = async (c: Contact) => {
    if (!confirm(`Delete contact "${c.first_name} ${c.last_name}"?`)) return;
    const { error } = await supabase.from("contacts").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await logActivity({ module: "crm", entity_type: "contact", entity_id: c.id, verb: "deleted", summary: `Deleted contact ${c.first_name} ${c.last_name}` });
    toast.success("Deleted"); void load();
  };

  const convertToLead = async (c: Contact) => {
    if (!confirm(`Add "${c.first_name} ${c.last_name}" as a lead?`)) return;
    const { data: existing } = await supabase.from("leads").select("id").eq("contact_id", c.id).maybeSingle();
    if (existing) { toast.info("This contact is already a lead."); return; }
    const { error } = await supabase.from("leads").insert({
      contact_id: c.id, organisation_id: c.organisation_id,
      first_name: c.first_name, last_name: c.last_name,
      email: c.email, phone: c.phone, job_title: c.job_title,
    } as never);
    if (error) { toast.error(error.message); return; }
    if (!c.is_lead) await supabase.from("contacts").update({ is_lead: true }).eq("id", c.id);
    toast.success("Added to Leads"); void load();
  };

  const saveCell = async (row: Contact, key: string, value: unknown) => {
    const { error } = await supabase.from("contacts").update({ [key]: value } as never).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const columns: DataTableColumn<Contact>[] = [
    { key: "first_name", header: "First name", accessor: (r) => r.first_name, editable, type: "text" },
    { key: "last_name", header: "Last name", accessor: (r) => r.last_name, editable, type: "text" },
    { key: "email", header: "Email", accessor: (r) => r.email ?? "", editable, type: "text" },
    { key: "organisation_id", header: "Organisation", accessor: (r) => orgs.find((o) => o.id === r.organisation_id)?.name ?? "", filterable: true },
    { key: "job_title", header: "Job title", accessor: (r) => r.job_title ?? "", editable, type: "text" },
    {
      key: "is_lead", header: "Type", accessor: (r) => (r.is_lead ? "lead" : "client"),
      render: (r) => r.is_lead ? <Badge variant="secondary">Lead</Badge> : <Badge>Client</Badge>,
      editable, type: "select",
      options: [{ value: "lead", label: "Lead" }, { value: "client", label: "Client" }],
    },
  ];
  const customCols = useCustomFieldColumns<Contact>("crm");
  const allColumns = [...columns, ...customCols];

  // Custom saveCell to map "lead"/"client" string back to boolean for the is_lead column
  const customSave = async (row: Contact, key: string, value: unknown) => {
    if (key === "is_lead") {
      await saveCell(row, "is_lead", value === "lead");
      return;
    }
    await saveCell(row, key, value);
  };

  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <DataTable
          tableKey="crm.contacts"
          columns={allColumns}
          rows={contacts}
          rowId={(r) => r.id}
          onSaveCell={customSave}
          emptyMessage="No contacts."
          toolbarLeft={editable && <Button className="bg-gradient-primary text-primary-foreground" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />New contact</Button>}
          actions={editable ? (c) => (
            <>
              <Button variant="ghost" size="icon" aria-label="Add as lead" title="Add as lead" onClick={() => convertToLead(c)}><UserPlus className="size-4" /></Button>
              <Button variant="ghost" size="icon" aria-label="Edit contact" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="size-4" /></Button>
              <Button variant="ghost" size="icon" aria-label="Delete contact" onClick={() => remove(c)}><Trash2 className="size-4" /></Button>
            </>
          ) : undefined}
        />
        <ContactDialog open={open} onOpenChange={setOpen} contact={editing} orgs={orgs} onSaved={load} />
      </CardContent>
    </Card>
  );
}

function ContactDialog({ open, onOpenChange, contact, orgs, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; contact: Contact | null; orgs: Org[]; onSaved: () => void;
}) {
  const [first, setFirst] = useState(""); const [last, setLast] = useState("");
  const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState(""); const [orgId, setOrgId] = useState<string>("__none__");
  const [isLead, setIsLead] = useState(true); const [notes, setNotes] = useState("");
  const [custom, setCustom] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setFirst(contact?.first_name ?? ""); setLast(contact?.last_name ?? "");
    setEmail(contact?.email ?? ""); setPhone(contact?.phone ?? "");
    setJobTitle(contact?.job_title ?? ""); setOrgId(contact?.organisation_id ?? "__none__");
    setIsLead(contact?.is_lead ?? true); setNotes(contact?.notes ?? "");
    setCustom((contact?.custom as Record<string, unknown>) ?? {});
  }, [contact, open]);

  const submit = async () => {
    if (!first.trim() && !last.trim()) return;
    const payload = {
      first_name: first, last_name: last, email: email || null, phone: phone || null,
      job_title: jobTitle || null, organisation_id: orgId === "__none__" ? null : orgId,
      is_lead: isLead, notes: notes || null, custom: custom as never,
    };
    if (contact) {
      const { error } = await supabase.from("contacts").update(payload).eq("id", contact.id);
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "crm", entity_type: "contact", entity_id: contact.id, verb: "updated", summary: `Updated contact ${first} ${last}` });
    } else {
      const { data, error } = await supabase.from("contacts").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logActivity({ module: "crm", entity_type: "contact", entity_id: data.id, verb: "created", summary: `Created ${isLead ? "lead" : "client"} ${first} ${last}` });
    }
    toast.success("Saved"); onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{contact ? "Edit contact" : "New contact"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>First name</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} /></div>
            <div className="space-y-1"><Label>Last name</Label><Input value={last} onChange={(e) => setLast(e.target.value)} /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="space-y-1"><Label>Job title</Label><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Organisation</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={isLead ? "lead" : "client"} onValueChange={(v) => setIsLead(v === "lead")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <CustomFieldValues module="crm" value={custom} onChange={setCustom} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

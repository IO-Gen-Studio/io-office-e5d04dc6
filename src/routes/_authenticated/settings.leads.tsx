import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/leads")({ component: SettingsLeads });

const COLORS = ["slate", "blue", "emerald", "purple", "indigo", "amber", "rose"];

type StatusRow = { id: string; key: string; label: string; color: string; position: number; active: boolean };
type OptRow = { id: string; label: string; position: number; active: boolean };
type LabelRow = { id: string; field_key: string; label: string };

function SettingsLeads() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Configure labels, statuses, next actions and sources used across the Leads module.
      </p>
      <FieldLabelsCard />
      <StatusesCard />
      <OptionsCard
        title="Next Action options"
        description="Choices available in the Next Action dropdown."
        table="lead_next_action_options"
      />
      <OptionsCard
        title="Source options"
        description="Where the lead came from."
        table="lead_source_options"
      />
    </div>
  );
}

function FieldLabelsCard() {
  const [rows, setRows] = useState<LabelRow[]>([]);
  const load = async () => {
    const { data } = await supabase.from("lead_field_labels").select("id,field_key,label").order("position");
    setRows((data ?? []) as LabelRow[]);
  };
  useEffect(() => { void load(); }, []);
  const save = async (r: LabelRow, label: string) => {
    const { error } = await supabase.from("lead_field_labels").update({ label }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Label updated"); void load();
  };
  return (
    <Card className="shadow-soft">
      <CardHeader><CardTitle className="text-base">Field labels</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((r) => (
          <div key={r.id} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{r.field_key}</Label>
            <Input defaultValue={r.label} onBlur={(e) => e.target.value !== r.label && save(r, e.target.value)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StatusesCard() {
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("slate");
  const load = async () => {
    const { data } = await supabase.from("lead_pipeline_status_options").select("*").order("position");
    setRows((data ?? []) as StatusRow[]);
  };
  useEffect(() => { void load(); }, []);
  const add = async () => {
    if (!label.trim()) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) + "_" + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("lead_pipeline_status_options").insert({ label, color, key, position: rows.length + 1 } as never);
    if (error) { toast.error(error.message); return; }
    setLabel(""); void load();
  };
  const update = async (r: StatusRow, patch: Partial<StatusRow>) => {
    const { error } = await supabase.from("lead_pipeline_status_options").update(patch as never).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };
  const remove = async (r: StatusRow) => {
    if (!confirm(`Delete status "${r.label}"?`)) return;
    await supabase.from("lead_pipeline_status_options").delete().eq("id", r.id);
    void load();
  };
  return (
    <Card className="shadow-soft">
      <CardHeader><CardTitle className="text-base">Pipeline statuses</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <Input className="flex-1" defaultValue={r.label} onBlur={(e) => e.target.value !== r.label && update(r, { label: e.target.value })} />
            <Select value={r.color} onValueChange={(v) => update(r, { color: v })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="size-4" /></Button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input placeholder="Add status label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={add}><Plus className="size-4 mr-1" />Add</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OptionsCard({ title, description, table }: { title: string; description: string; table: "lead_next_action_options" | "lead_source_options" }) {
  const [rows, setRows] = useState<OptRow[]>([]);
  const [label, setLabel] = useState("");
  const load = async () => {
    const { data } = await supabase.from(table).select("id,label,position,active").order("position");
    setRows((data ?? []) as OptRow[]);
  };
  useEffect(() => { void load(); }, [table]);
  const add = async () => {
    if (!label.trim()) return;
    const { error } = await supabase.from(table).insert({ label, position: rows.length + 1 } as never);
    if (error) { toast.error(error.message); return; }
    setLabel(""); void load();
  };
  const update = async (r: OptRow, patch: Partial<OptRow>) => {
    await supabase.from(table).update(patch as never).eq("id", r.id);
    void load();
  };
  const remove = async (r: OptRow) => {
    if (!confirm(`Delete "${r.label}"?`)) return;
    await supabase.from(table).delete().eq("id", r.id);
    void load();
  };
  return (
    <Card className="shadow-soft">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{description}</p>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <Input className="flex-1" defaultValue={r.label} onBlur={(e) => e.target.value !== r.label && update(r, { label: e.target.value })} />
            <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="size-4" /></Button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input placeholder="Add option" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button onClick={add}><Plus className="size-4 mr-1" />Add</Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/lib/format";
import { Plus, Trash2, GitBranch, Upload, Download, Pencil, FileSpreadsheet, Check, StickyNote } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

export type CostParentType = "project" | "subscription";

type Version = {
  id: string;
  parent_type: string;
  parent_id: string;
  version: number;
  label: string | null;
  notes: string | null;
  is_current: boolean;
  created_at: string;
};

type Item = {
  id: string;
  version_id: string;
  position: number;
  item_no: string | null;
  description: string;
  quantity: number;
  final_cost: number;
  supplier_cost: number;
  invoiced: boolean;
};

export function CostBreakdown({
  parentType, parentId, editable, onTotalsChange,
}: {
  parentType: CostParentType;
  parentId: string;
  editable: boolean;
  onTotalsChange?: (totals: { final: number; supplier: number }) => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [prevItems, setPrevItems] = useState<Item[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemsLoadedFor, setItemsLoadedFor] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);


  const loadVersions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cost_versions").select("*")
      .eq("parent_type", parentType).eq("parent_id", parentId)
      .order("version", { ascending: false });
    const vs = (data ?? []) as Version[];
    setVersions(vs);
    const current = vs.find((v) => v.is_current) ?? vs[0] ?? null;
    setActiveId(current?.id ?? null);
    setLoading(false);
  };

  const loadItems = async (vid: string) => {
    const { data } = await supabase
      .from("cost_items").select("*").eq("version_id", vid).order("position");
    setItems((data ?? []) as Item[]);
    setItemsLoadedFor(vid);
  };

  useEffect(() => { void loadVersions(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [parentType, parentId]);
  useEffect(() => {
    if (activeId) void loadItems(activeId);
    else { setItems([]); setItemsLoadedFor(null); }
  }, [activeId]);

  // Load the previous version's items so we can highlight what changed.
  useEffect(() => {
    const act = versions.find((v) => v.id === activeId);
    if (!act) { setPrevItems(null); return; }
    const prev = versions.filter((v) => v.version < act.version).sort((a, b) => b.version - a.version)[0];
    if (!prev) { setPrevItems(null); return; }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("cost_items").select("*").eq("version_id", prev.id).order("position");
      if (!cancelled) setPrevItems((data ?? []) as Item[]);
    })();
    return () => { cancelled = true; };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [activeId, versions]);

  useEffect(() => {
    const act = versions.find((v) => v.id === activeId);
    setNotesDraft(act?.notes ?? "");
    setNotesOpen(false);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [activeId, versions]);


  const totals = useMemo(() => {
    return items.reduce(
      (a, i) => ({
        final: a.final + Number(i.final_cost || 0),
        supplier: a.supplier + Number(i.supplier_cost || 0),
      }),
      { final: 0, supplier: 0 },
    );
  }, [items]);

  useEffect(() => {
    // Only report totals once items have actually been loaded for the active version.
    // Without this guard, an initial render with empty items overwrites the parent's
    // stored cost with 0 before the real items arrive.
    if (!activeId || itemsLoadedFor !== activeId) return;
    onTotalsChange?.(totals);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [totals.final, totals.supplier, itemsLoadedFor, activeId]);

  const active = versions.find((v) => v.id === activeId) ?? null;
  const prevVersion = useMemo(() => {
    if (!active) return null;
    return versions.filter((v) => v.version < active.version).sort((a, b) => b.version - a.version)[0] ?? null;
  }, [versions, active]);

  const prevByKey = useMemo(() => {
    const m = new Map<string, Item>();
    (prevItems ?? []).forEach((i, idx) => {
      m.set((i.item_no?.trim() || `#${idx}`).toLowerCase(), i);
    });
    return m;
  }, [prevItems]);

  const matchPrev = (i: Item, idx: number): Item | undefined => {
    if (!prevItems) return undefined;
    return prevByKey.get((i.item_no?.trim() || `#${idx}`).toLowerCase()) ?? prevItems[idx];
  };

  const changedCls = (changed: boolean) =>
    changed ? "bg-amber-100/70 dark:bg-amber-500/15 rounded-sm" : "";

  const saveNotes = async () => {
    if (!active) return;
    const { error } = await supabase.from("cost_versions").update({ notes: notesDraft || null }).eq("id", active.id);
    if (error) return toast.error(error.message);
    setVersions((prev) => prev.map((v) => v.id === active.id ? { ...v, notes: notesDraft || null } : v));
    toast.success("Notes saved");
  };



  const createVersion = async (cloneFromActive: boolean) => {
    const nextNum = versions.length === 0 ? 1 : Math.max(...versions.map((v) => v.version)) + 1;
    // Unset current on others
    if (versions.length > 0) {
      await supabase.from("cost_versions").update({ is_current: false })
        .eq("parent_type", parentType).eq("parent_id", parentId);
    }
    const { data, error } = await supabase.from("cost_versions").insert({
      parent_type: parentType, parent_id: parentId, version: nextNum,
      label: `v${nextNum}`, is_current: true,
    }).select().single();
    if (error || !data) { toast.error(error?.message ?? "Failed"); await loadVersions(); return; }
    if (cloneFromActive && items.length > 0) {
      await supabase.from("cost_items").insert(items.map((i) => ({
        version_id: data.id, position: i.position, item_no: i.item_no,
        description: i.description, quantity: i.quantity,
        final_cost: i.final_cost, supplier_cost: i.supplier_cost,
      })));
    }
    toast.success(`Version ${nextNum} created`);
    await loadVersions();
    setActiveId(data.id);
  };

  const setCurrent = async (vid: string) => {
    await supabase.from("cost_versions").update({ is_current: false })
      .eq("parent_type", parentType).eq("parent_id", parentId);
    await supabase.from("cost_versions").update({ is_current: true }).eq("id", vid);
    void loadVersions();
  };

  const deleteVersion = async (vid: string) => {
    if (!confirm("Delete this version and its items?")) return;
    const { error } = await supabase.from("cost_versions").delete().eq("id", vid);
    if (error) return toast.error(error.message);
    void loadVersions();
  };

  const addItem = async () => {
    if (!activeId) return;
    const { error } = await supabase.from("cost_items").insert({
      version_id: activeId, position: items.length,
      item_no: String(items.length + 1), description: "", quantity: 1,
      final_cost: 0, supplier_cost: 0,
    });
    if (error) return toast.error(error.message);
    void loadItems(activeId);
  };

  const updateItem = async (id: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
    const { error } = await supabase.from("cost_items").update(patch).eq("id", id);
    if (error) { toast.error(error.message); if (activeId) void loadItems(activeId); }
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("cost_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeId) void loadItems(activeId);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let cur: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else field += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { cur.push(field); field = ""; }
        else if (ch === '\n' || ch === '\r') {
          if (field !== "" || cur.length > 0) { cur.push(field); rows.push(cur); cur = []; field = ""; }
          if (ch === '\r' && text[i + 1] === '\n') i++;
        } else field += ch;
      }
    }
    if (field !== "" || cur.length > 0) { cur.push(field); rows.push(cur); }
    return rows.filter((r) => r.some((c) => c.trim() !== ""));
  };

  const importFile = async (file: File) => {
    if (!activeId) { toast.error("Create a version first"); return; }
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    let rows: string[][] = [];
    if (ext === "xlsx" || ext === "xls") {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" });
      rows = aoa.map((r) => (r as unknown[]).map((c) => (c == null ? "" : String(c))));
    } else {
      const text = await file.text();
      rows = parseCSV(text);
    }
    if (rows.length === 0) { toast.error("Empty CSV"); return; }
    // Detect header
    const first = rows[0].map((c) => c.toLowerCase().trim());
    const looksLikeHeader = first.some((c) => ["item", "item #", "item no", "description", "qty", "quantity", "final", "final cost", "supplier", "supplier cost", "investment"].includes(c));
    let headerMap: { item?: number; desc?: number; qty?: number; final?: number; supplier?: number } = {};
    let dataStart = 0;
    if (looksLikeHeader) {
      dataStart = 1;
      first.forEach((c, idx) => {
        if (c.includes("item")) headerMap.item = idx;
        else if (c.includes("desc")) headerMap.desc = idx;
        else if (c.includes("qty") || c.includes("quantity")) headerMap.qty = idx;
        else if (c.includes("supplier") || c.includes("investment")) headerMap.supplier = idx;
        else if (c.includes("final") || c.includes("cost") || c.includes("price")) headerMap.final = idx;
      });
    } else {
      headerMap = { item: 0, desc: 1, qty: 2, final: 3, supplier: 4 };
    }
    const inserts = rows.slice(dataStart).map((r, i) => ({
      version_id: activeId,
      position: items.length + i,
      item_no: headerMap.item !== undefined ? (r[headerMap.item] ?? String(items.length + i + 1)) : String(items.length + i + 1),
      description: headerMap.desc !== undefined ? (r[headerMap.desc] ?? "") : "",
      quantity: headerMap.qty !== undefined ? Number(r[headerMap.qty]) || 1 : 1,
      final_cost: headerMap.final !== undefined ? Number(r[headerMap.final]) || 0 : 0,
      supplier_cost: headerMap.supplier !== undefined ? Number(r[headerMap.supplier]) || 0 : 0,
    }));
    if (inserts.length === 0) { toast.error("No rows found"); return; }
    const { error } = await supabase.from("cost_items").insert(inserts);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${inserts.length} item${inserts.length === 1 ? "" : "s"}`);
    void loadItems(activeId);
  };

  const downloadTemplate = () => {
    const csv = "Item #,Description,Quantity,Final Cost,Investment\n1,Example line item,1,100,60\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cost-items-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportXLSX = () => {
    const rows = items.map((i) => {
      const finalCost = Number(i.final_cost || 0);
      const inv = Number(i.supplier_cost || 0);
      return {
        "Item #": i.item_no ?? "",
        "Description": i.description,
        "Quantity": Number(i.quantity || 0),
        "Final Cost": finalCost,
        "Investment": inv,
        "Profit": finalCost - inv,
      };
    });
    rows.push({
      "Item #": "",
      "Description": "Totals",
      "Quantity": 0,
      "Final Cost": totals.final,
      "Investment": totals.supplier,
      "Profit": totals.final - totals.supplier,
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cost breakdown");
    const label = active?.label ?? `v${active?.version ?? 1}`;
    XLSX.writeFile(wb, `cost-breakdown-${label}.xlsx`);
  };


  if (loading) return <p className="text-sm text-muted-foreground">Loading cost breakdown…</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <GitBranch className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Version:</span>
        {versions.length > 0 ? (
          <Select value={activeId ?? ""} onValueChange={setActiveId}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  v{v.version}{v.is_current ? " (current)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : <span className="text-sm text-muted-foreground">No versions yet</span>}
        {active && !active.is_current && editable && (
          <Button size="sm" variant="outline" onClick={() => setCurrent(active.id)}>Set as current</Button>
        )}
        {active?.is_current && <Badge variant="secondary">Current</Badge>}
        {editable && active && (
          <Button
            size="sm"
            variant={editMode ? "default" : "outline"}
            onClick={() => setEditMode((v) => !v)}
            title={editMode ? "Finish editing" : "Edit items"}
          >
            {editMode ? <><Check className="size-4 mr-1" />Done</> : <><Pencil className="size-4 mr-1" />Edit</>}
          </Button>
        )}
        {editable && active && (
          <Button size="sm" variant="outline" onClick={exportXLSX} disabled={items.length === 0}>
            <FileSpreadsheet className="size-4 mr-1" />Export XLSX
          </Button>
        )}
        {editable && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => createVersion(true)} disabled={versions.length === 0}>Duplicate version</Button>
            <Button size="sm" onClick={() => createVersion(false)}><Plus className="size-4 mr-1" />New version</Button>
            {active && versions.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => deleteVersion(active.id)}><Trash2 className="size-4" /></Button>
            )}
          </div>
        )}
      </div>

      {!active ? (
        <p className="text-sm text-muted-foreground">Create a version to start adding items.</p>
      ) : (
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left p-2 w-20">Item #</th>
                <th className="text-left p-2">Description</th>
                <th className="text-right p-2 w-20">Qty</th>
                <th className="text-right p-2 w-32">Final cost</th>
                <th className="text-right p-2 w-32">Investment</th>
                <th className="text-right p-2 w-32">Profit</th>
                {editable && editMode && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={editable && editMode ? 7 : 6} className="text-center text-muted-foreground py-6">No items yet.</td></tr>
              ) : items.map((i) => {
                const lineFinal = Number(i.final_cost || 0);
                const lineInv = Number(i.supplier_cost || 0);
                const canEdit = editable && editMode;
                return (
                  <tr key={i.id} className="border-b">
                    <td className="p-1.5"><Input className="h-8" disabled={!canEdit} value={i.item_no ?? ""} onChange={(e) => updateItem(i.id, { item_no: e.target.value })} /></td>
                    <td className="p-1.5"><Input className="h-8" disabled={!canEdit} value={i.description} onChange={(e) => updateItem(i.id, { description: e.target.value })} /></td>
                    <td className="p-1.5"><Input className="h-8 text-right" type="number" disabled={!canEdit} value={i.quantity} onChange={(e) => updateItem(i.id, { quantity: Number(e.target.value) || 0 })} /></td>
                    <td className="p-1.5"><Input className="h-8 text-right" type="number" disabled={!canEdit} value={i.final_cost} onChange={(e) => updateItem(i.id, { final_cost: Number(e.target.value) || 0 })} /></td>
                    <td className="p-1.5"><Input className="h-8 text-right" type="number" disabled={!canEdit} value={i.supplier_cost} onChange={(e) => updateItem(i.id, { supplier_cost: Number(e.target.value) || 0 })} /></td>
                    <td className="p-2 text-right tabular-nums">{formatGBP(lineFinal - lineInv)}</td>
                    {editable && editMode && <td className="p-1.5 text-right"><Button variant="ghost" size="icon" aria-label="Delete cost item" onClick={() => removeItem(i.id)}><Trash2 className="size-4" /></Button></td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/20">
              <tr className="font-medium">
                <td colSpan={3} className="p-2 text-right">Totals</td>
                <td className="p-2 text-right tabular-nums">{formatGBP(totals.final)}</td>
                <td className="p-2 text-right tabular-nums">{formatGBP(totals.supplier)}</td>
                <td className="p-2 text-right tabular-nums">{formatGBP(totals.final - totals.supplier)}</td>
                {editable && editMode && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editable && active && editMode && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={addItem}><Plus className="size-4 mr-1" />Add item</Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4 mr-1" />Import CSV / Excel
          </Button>
          <Button size="sm" variant="ghost" onClick={downloadTemplate}>
            <Download className="size-4 mr-1" />Template
          </Button>
          <input
            ref={fileInputRef} type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }}
          />
        </div>
      )}
    </div>
  );
}

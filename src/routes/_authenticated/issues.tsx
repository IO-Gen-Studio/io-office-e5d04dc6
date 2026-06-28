import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  CheckCircle2,
  CircleDot,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  UserRound,
} from "lucide-react";
import { FieldDialog, type FieldDef, TYPE_LABELS } from "@/components/CustomFieldDialog";
import { CustomFieldValues } from "@/components/CustomFieldValues";
import { ReferencePreview } from "@/components/CustomFieldValues";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { useFiscalYear } from "@/lib/fiscal-year";
import { DataTable, type DataTableColumn, type ColumnType } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/issues")({ component: IssuesPage });

type Issue = {
  id: string;
  issue_number: number;
  task: string;
  issue_date: string | null;
  priority: string | null;
  owner: string | null;
  owner_id: string | null;
  status: string;
  comment: string | null;
  custom: Record<string, unknown>;
};

type Profile = { id: string; full_name: string; email: string };

const EMPTY_ISSUE = {
  task: "",
  issue_date: "",
  priority: "",
  owner_id: "",
  status: "Open",
  comment: "",
};

function IssuesPage() {
  const { canEdit, user, activeTenantId } = useAuth();
  const editable = canEdit("issues");
  const [rows, setRows] = useState<Issue[]>([]);
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [issueOpen, setIssueOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const load = async () => {
    const [
      { data: issues, error: issueError },
      { data: columns, error: columnError },
      { data: people, error: profileError },
    ] = await Promise.all([
      supabase.from("issues").select("*").order("issue_number", { ascending: true }),
      supabase.from("issue_column_defs").select("*").order("position", { ascending: true }),
      supabase.from("profiles").select("id,full_name,email").eq("active", true).order("full_name"),
    ]);
    if (issueError || columnError || profileError)
      toast.error(
        issueError?.message ??
          columnError?.message ??
          profileError?.message ??
          "Unable to load issues",
      );
    setRows((issues ?? []) as Issue[]);
    setDefs((columns ?? []) as FieldDef[]);
    setProfiles((people ?? []) as Profile[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const saveCell = async (row: Issue, key: string, value: unknown) => {
    const update = key.startsWith("custom.")
      ? { custom: { ...(row.custom ?? {}), [key.slice(7)]: value } }
      : { [key]: value };
    const { error } = await supabase
      .from("issues")
      .update(update as never)
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (
      key === "owner_id" &&
      value &&
      value !== row.owner_id &&
      activeTenantId &&
      value !== user?.id
    ) {
      await supabase.from("notifications").insert({
        user_id: String(value),
        tenant_id: activeTenantId,
        type: "issue_assignment",
        title: "Issue assigned to you",
        body: `Task ${row.issue_number}: ${row.task}`,
        link: "/issues",
      });
    }
    void load();
  };

  const removeIssue = async (issue: Issue) => {
    if (!confirm(`Delete issue #${issue.issue_number}?`)) return;
    const { error } = await supabase.from("issues").delete().eq("id", issue.id);
    if (error) return toast.error(error.message);
    toast.success("Issue deleted");
    void load();
  };

  const columns = useMemo<DataTableColumn<Issue>[]>(() => {
    const builtIn = new Map<string, DataTableColumn<Issue>>([
      [
        "issue_number",
        {
          key: "issue_number",
          header: "Task ID",
          accessor: (r) => r.issue_number,
          type: "number",
          align: "right",
          width: "90px",
          editable,
        },
      ],
      [
        "task",
        {
          key: "task",
          header: "Task",
          accessor: (r) => r.task,
          type: "text",
          editable,
          width: "320px",
        },
      ],
      [
        "issue_date",
        {
          key: "issue_date",
          header: "Date",
          accessor: (r) => r.issue_date,
          type: "date",
          editable,
          width: "140px",
        },
      ],
      [
        "priority",
        {
          key: "priority",
          header: "Priority",
          accessor: (r) => r.priority,
          editable,
          type: "select",
          options: [
            { value: "H", label: "High" },
            { value: "M", label: "Medium" },
            { value: "L", label: "Low" },
          ],
          render: (r) =>
            r.priority ? (
              <Badge
                variant={
                  r.priority === "H" ? "destructive" : r.priority === "L" ? "outline" : "secondary"
                }
              >
                {r.priority === "H" ? "High" : r.priority === "M" ? "Medium" : "Low"}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
      ],
      [
        "owner_id",
        {
          key: "owner_id",
          header: "Owner",
          accessor: (r) => r.owner_id ?? r.owner,
          type: "select",
          editable,
          options: profiles.map((profile) => ({
            value: profile.id,
            label: profile.full_name || profile.email,
          })),
          render: (r) =>
            profiles.find((profile) => profile.id === r.owner_id)?.full_name ||
            r.owner || <span className="text-muted-foreground">—</span>,
        },
      ],
      [
        "status",
        {
          key: "status",
          header: "Status",
          accessor: (r) => r.status,
          editable,
          type: "select",
          options: [
            { value: "Open", label: "Open" },
            { value: "In Progress", label: "In Progress" },
            { value: "Resolved", label: "Resolved" },
            { value: "Closed", label: "Closed" },
          ],
          render: (r) => (
            <Badge
              variant={r.status === "Closed" || r.status === "Resolved" ? "default" : "secondary"}
            >
              {r.status}
            </Badge>
          ),
        },
      ],
      [
        "comment",
        {
          key: "comment",
          header: "Comment",
          accessor: (r) => r.comment,
          type: "text",
          editable,
          width: "360px",
        },
      ],
    ]);
    const custom = defs
      .filter((def) => !def.is_builtin && def.is_active !== false)
      .map<DataTableColumn<Issue>>((def) => ({
        key: `custom.${def.key}`,
        header: def.label,
        accessor: (r) => (r.custom ?? {})[def.key],
        editable: editable && ["text", "number", "date", "dropdown", "checkbox"].includes(def.type),
        type: (def.type === "dropdown"
          ? "select"
          : def.type === "checkbox"
            ? "boolean"
            : ["text", "number", "date"].includes(def.type)
              ? def.type
              : "text") as ColumnType,
        options:
          def.type === "dropdown" && Array.isArray(def.options)
            ? def.options.map((option) => ({ value: String(option), label: String(option) }))
            : undefined,
        render: (r) => {
          const val = (r.custom ?? {})[def.key];
          if (val === null || val === undefined || val === "")
            return <span className="text-muted-foreground">—</span>;
          if (def.type === "reference" && typeof val === "string") {
            return (
              <ReferencePreview
                target={(def.options as { target?: string })?.target ?? "contacts"}
                value={val}
              />
            );
          }
          if (def.type === "checkbox") {
            return <Badge variant={val ? "default" : "secondary"}>{val ? "Yes" : "No"}</Badge>;
          }
          if (Array.isArray(val)) return val.join(", ");
          return String(val);
        },
      }));
    const customMap = new Map(custom.map((column) => [column.key.slice(7), column]));
    return defs
      .filter((def) => def.is_active !== false)
      .map((def) => {
        const column = def.is_builtin ? builtIn.get(def.key) : customMap.get(def.key);
        return column ? { ...column, header: def.label } : null;
      })
      .filter((column): column is DataTableColumn<Issue> => column !== null);
  }, [defs, editable, profiles]);

  const { inRange } = useFiscalYear();
  const inYear = rows.filter((row) => inRange(row.issue_date));
  const resolved = inYear.filter((row) => row.status === "Resolved" || row.status === "Closed");
  const ongoing = inYear.filter((row) => row.status !== "Resolved" && row.status !== "Closed");
  const assignedToMe = inYear.filter((row) => row.owner_id === user?.id);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <CircleAlert className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Operations</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Issues Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track operational issues in a flexible, shared workspace.
          </p>
        </div>
        {editable && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setColumnsOpen(true)}>
              <Settings2 className="size-4" />
              Manage columns
            </Button>
            <Button
              onClick={() => {
                setEditingIssue(null);
                setIssueOpen(true);
              }}
            >
              <Plus className="size-4" />
              New issue
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Open Issues"
          value={ongoing.length}
          icon={<CircleDot className="size-5 text-primary" />}
        />
        <KpiCard
          label="Resolved Issues"
          value={resolved.length}
          icon={<CheckCircle2 className="size-5 text-primary" />}
        />
        <KpiCard
          label="Assigned to Me"
          value={assignedToMe.length}
          icon={<UserRound className="size-5 text-primary" />}
        />
      </div>
      <Tabs defaultValue="ongoing">
        <TabsList>
          <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
        <TabsContent value="ongoing">
          <IssuesGrid
            tableKey="issues-ongoing"
            rows={ongoing}
            columns={columns}
            editable={editable}
            onSaveCell={saveCell}
            onEdit={(issue) => {
              setEditingIssue(issue);
              setIssueOpen(true);
            }}
            onRemove={removeIssue}
          />
        </TabsContent>
        <TabsContent value="resolved">
          <IssuesGrid
            tableKey="issues-resolved"
            rows={resolved}
            columns={columns}
            editable={editable}
            onSaveCell={saveCell}
            onEdit={(issue) => {
              setEditingIssue(issue);
              setIssueOpen(true);
            }}
            onRemove={removeIssue}
          />
        </TabsContent>
      </Tabs>
      {issueOpen && (
        <IssueDialog
          issue={editingIssue}
          profiles={profiles}
          activeTenantId={activeTenantId}
          currentUserId={user?.id}
          nextNumber={Math.max(0, ...rows.map((r) => r.issue_number)) + 1}
          onClose={() => setIssueOpen(false)}
          onSaved={() => {
            setIssueOpen(false);
            void load();
          }}
        />
      )}
      {columnsOpen && (
        <ColumnsDialog defs={defs} onClose={() => setColumnsOpen(false)} onChanged={load} />
      )}
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function IssuesGrid({
  tableKey,
  rows,
  columns,
  editable,
  onSaveCell,
  onEdit,
  onRemove,
}: {
  tableKey: string;
  rows: Issue[];
  columns: DataTableColumn<Issue>[];
  editable: boolean;
  onSaveCell: (row: Issue, key: string, value: unknown) => Promise<void>;
  onEdit: (issue: Issue) => void;
  onRemove: (issue: Issue) => Promise<unknown>;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <DataTable
          tableKey={tableKey}
          columns={columns}
          rows={rows}
          rowId={(row) => row.id}
          onSaveCell={onSaveCell}
          emptyMessage="No issues in this view."
          actions={
            editable
              ? (issue) => (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit issue ${issue.issue_number}`}
                      onClick={() => onEdit(issue)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete issue ${issue.issue_number}`}
                      onClick={() => void onRemove(issue)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
}

function IssueDialog({
  issue,
  profiles,
  activeTenantId,
  currentUserId,
  nextNumber,
  onClose,
  onSaved,
}: {
  issue: Issue | null;
  profiles: Profile[];
  activeTenantId: string | null;
  currentUserId: string | undefined;
  nextNumber: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(
    issue
      ? {
          task: issue.task,
          issue_date: issue.issue_date ?? "",
          priority: issue.priority ?? "",
          owner_id: issue.owner_id ?? "",
          status: issue.status,
          comment: issue.comment ?? "",
          custom: issue.custom ?? {},
        }
      : { ...EMPTY_ISSUE, custom: {} },
  );
  const [number, setNumber] = useState(issue?.issue_number ?? nextNumber);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.task.trim()) return toast.error("Task is required");
    setSaving(true);
    const payload = {
      issue_number: number,
      task: form.task.trim(),
      issue_date: form.issue_date || null,
      priority: form.priority || null,
      owner_id: form.owner_id || null,
      owner:
        profiles.find((profile) => profile.id === form.owner_id)?.full_name ?? issue?.owner ?? null,
      status: form.status,
      comment: form.comment.trim() || null,
      custom: form.custom,
    };
    const result = issue
      ? await supabase
          .from("issues")
          .update(payload as never)
          .eq("id", issue.id)
      : await supabase.from("issues").insert(payload as never);
    setSaving(false);
    if (result.error) return toast.error(result.error.message);
    if (
      form.owner_id &&
      form.owner_id !== issue?.owner_id &&
      activeTenantId &&
      form.owner_id !== currentUserId
    ) {
      await supabase.from("notifications").insert({
        user_id: form.owner_id,
        tenant_id: activeTenantId,
        type: "issue_assignment",
        title: "Issue assigned to you",
        body: `Task ${number}: ${form.task.trim()}`,
        link: "/issues",
      });
    }
    toast.success(issue ? "Issue updated" : "Issue created");
    onSaved();
  };
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="flex w-[95vw] flex-col gap-0 p-0 sm:max-w-[min(760px,95vw)]">
        <SheetHeader className="shrink-0 border-b p-6 pb-4">
          <SheetTitle>{issue ? `Edit task ${issue.issue_number}` : "New issue"}</SheetTitle>
        </SheetHeader>
        <div className="grid flex-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="issue-number">Task ID</Label>
            <Input
              id="issue-number"
              type="number"
              value={number}
              onChange={(e) => setNumber(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="issue-date">Date</Label>
            <Input
              id="issue-date"
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="issue-task">Task</Label>
            <Textarea
              id="issue-task"
              rows={3}
              value={form.task}
              onChange={(e) => setForm({ ...form, task: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select
              value={form.priority || "none"}
              onValueChange={(value) =>
                setForm({ ...form, priority: value === "none" ? "" : value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="H">High</SelectItem>
                <SelectItem value="M">Medium</SelectItem>
                <SelectItem value="L">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <Select
              value={form.owner_id || "none"}
              onValueChange={(owner_id) =>
                setForm({ ...form, owner_id: owner_id === "none" ? "" : owner_id })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name || profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Open", "In Progress", "Resolved", "Closed"].map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="issue-comment">Comment</Label>
            <Textarea
              id="issue-comment"
              rows={4}
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <CustomFieldValues
              module="issues"
              value={form.custom}
              onChange={(custom) => setForm({ ...form, custom })}
            />
          </div>
        </div>
        <SheetFooter className="shrink-0 border-t p-6 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save issue"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ColumnsDialog({
  defs,
  onClose,
  onChanged,
}: {
  defs: FieldDef[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<FieldDef | null>(null);
  const [creating, setCreating] = useState(false);

  const remove = async (def: FieldDef) => {
    if (
      !confirm(
        `Delete the “${def.label}” column? Existing values in this column will no longer be shown.`,
      )
    )
      return;
    const { error } = await supabase.from("issue_column_defs").delete().eq("id", def.id);
    if (error) return toast.error(error.message);
    toast.success("Column deleted");
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage shared columns</DialogTitle>
          <DialogDescription>
            New columns are available to everyone. Each person can drag, hide, sort, and filter them
            in their own view.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Add column
            </Button>
          </div>
          <div className="max-h-[400px] overflow-auto space-y-2">
            {defs.map((def) => (
              <div key={def.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{def.label}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {TYPE_LABELS[def.type]}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(def)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => void remove(def)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>

        {(creating || editing) && (
          <FieldDialog
            module="issues"
            existing={editing}
            existingKeys={new Set(defs.filter((f) => f.id !== editing?.id).map((f) => f.key))}
            nextPosition={defs.length}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSaved={() => {
              setCreating(false);
              setEditing(null);
              onChanged();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

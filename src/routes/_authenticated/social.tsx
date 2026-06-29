import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { logActivity } from "@/lib/activity";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Eye, ArrowUpDown, ArrowUp, ArrowDown, Image as ImageIcon } from "lucide-react";

import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { CustomFieldValues } from "@/components/CustomFieldValues";
import { SocialPostMockupDialog } from "@/components/SocialPostMockup";
import { useBuiltinFieldLabel, useBuiltinFieldOptions } from "@/lib/builtin-labels";
import { useFiscalYear } from "@/lib/fiscal-year";

type Platform = Database["public"]["Enums"]["social_platform"];
type PostStatus = Database["public"]["Enums"]["post_status"];
type ApprovalStatus = Database["public"]["Enums"]["approval_status"];



type Plan = {
  id: string; platform: Platform; title: string; copy: string; media_path: string | null;
  scheduled_at: string | null; post_status: PostStatus; approval_status: ApprovalStatus;
  approvers: string[] | null;
  custom?: Record<string, unknown> | null;
};
type Profile = { id: string; full_name: string };

export const Route = createFileRoute("/_authenticated/social")({ component: SocialPage });

function SocialPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("social");
  const [rows, setRows] = useState<Plan[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [viewing, setViewing] = useState<Plan | null>(null);

  const load = async () => {
    const [{ data }, { data: pf }] = await Promise.all([
      supabase.from("social_plans").select("*").order("scheduled_at", { ascending: true, nullsFirst: false }),
      supabase.from("profiles").select("id,full_name").order("full_name"),
    ]);
    setRows((data ?? []) as Plan[]);
    setProfiles((pf ?? []) as Profile[]);
  };
  useEffect(() => { void load(); }, []);

  const remove = async (p: Plan) => {
    if (!confirm("Delete post plan?")) return;
    const { error } = await supabase.from("social_plans").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    await logActivity({ module: "social", entity_type: "post", entity_id: p.id, verb: "deleted", summary: `Deleted ${p.platform} post` });
    toast.success("Deleted"); void load();
  };
  const platformLabel = useBuiltinFieldLabel("social", "platform");
  const approvalLabel = useBuiltinFieldLabel("social", "approval_status");
  const postStatusLabel = useBuiltinFieldLabel("social", "post_status");

  const draftRows = rows.filter((r) => r.post_status !== "posted");
  const postedRows = rows.filter((r) => r.post_status === "posted");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Social Planner</h1>
          <p className="text-muted-foreground mt-1">Plan, approve and track posts across platforms.</p>
        </div>
        {editable && <Button className="bg-gradient-primary text-primary-foreground" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-2" />New post</Button>}
      </div>
      <Tabs defaultValue="draft" className="space-y-4">
        <TabsList>
          <TabsTrigger value="draft">Draft ({draftRows.length})</TabsTrigger>
          <TabsTrigger value="posted">Posted ({postedRows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="draft">
          <PlansTable
            rows={draftRows}
            highlightForApproval
            editable={editable}
            platformLabel={platformLabel}
            approvalLabel={approvalLabel}
            postStatusLabel={postStatusLabel}
            onEdit={(p) => { setEditing(p); setOpen(true); }}
            onView={setViewing}
            onRemove={remove}
          />
        </TabsContent>
        <TabsContent value="posted">
          <PlansTable
            rows={postedRows}
            highlightForApproval={false}
            editable={editable}
            platformLabel={platformLabel}
            approvalLabel={approvalLabel}
            postStatusLabel={postStatusLabel}
            onEdit={(p) => { setEditing(p); setOpen(true); }}
            onView={setViewing}
            onRemove={remove}
          />
        </TabsContent>
      </Tabs>
      <PlanDialog open={open} onOpenChange={setOpen} plan={editing} profiles={profiles} onSaved={load} />
      <SocialPostMockupDialog
        open={!!viewing}
        onOpenChange={(o) => { if (!o) setViewing(null); }}
        plan={viewing ? (rows.find((r) => r.id === viewing.id) ?? viewing) : null}
        editable={editable}
        onApprovalChange={load}
      />
    </div>
  );
}

type SortKey = "platform" | "title" | "scheduled_at" | "approval_status" | "post_status";
type SortDir = "asc" | "desc";

function PlansTable({
  rows, highlightForApproval, editable,
  platformLabel, approvalLabel, postStatusLabel,
  onEdit, onView, onRemove,
}: {
  rows: Plan[]; highlightForApproval: boolean; editable: boolean;
  platformLabel: (v: string) => string;
  approvalLabel: (v: string) => string;
  postStatusLabel: (v: string) => string;
  onEdit: (p: Plan) => void; onView: (p: Plan) => void; onRemove: (p: Plan) => void;
}) {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [approvalFilter, setApprovalFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("scheduled_at");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const platforms = Array.from(new Set(rows.map((r) => r.platform)));
  const approvals = Array.from(new Set(rows.map((r) => r.approval_status)));

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };
  const SortIcon = ({ k }: { k: SortKey }) => sortKey !== k
    ? <ArrowUpDown className="size-3 inline ml-1 opacity-50" />
    : sortDir === "asc" ? <ArrowUp className="size-3 inline ml-1" /> : <ArrowDown className="size-3 inline ml-1" />;

  const { inRange } = useFiscalYear();
  const filtered = rows.filter((p) => {
    if (!inRange(p.scheduled_at)) return false;
    if (platformFilter !== "all" && p.platform !== platformFilter) return false;
    if (approvalFilter !== "all" && p.approval_status !== approvalFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(p.title || "").toLowerCase().includes(q) && !(p.copy || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (highlightForApproval) {
      const aFor = a.approval_status === "for_approval" ? 0 : 1;
      const bFor = b.approval_status === "for_approval" ? 0 : 1;
      if (aFor !== bFor) return aFor - bFor;
    }
    const av = (a[sortKey] ?? "") as string;
    const bv = (b[sortKey] ?? "") as string;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search title or copy…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {platforms.map((p) => <SelectItem key={p} value={p}>{platformLabel(p)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={approvalFilter} onValueChange={setApprovalFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Approval" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All approvals</SelectItem>
              {approvals.map((a) => <SelectItem key={a} value={a}>{approvalLabel(a)}</SelectItem>)}
            </SelectContent>
          </Select>
          {(search || platformFilter !== "all" || approvalFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setPlatformFilter("all"); setApprovalFilter("all"); }}>Clear</Button>
          )}
        </div>
        {sorted.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">No posts.</div>
        ) : (
          <div className="[column-fill:_balance] columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {sorted.map((p) => {
              const isForApproval = highlightForApproval && p.approval_status === "for_approval";
              return (
                <PostCard
                  key={p.id}
                  plan={p}
                  highlight={isForApproval}
                  editable={editable}
                  platformLabel={platformLabel}
                  approvalLabel={approvalLabel}
                  postStatusLabel={postStatusLabel}
                  onEdit={onEdit}
                  onView={onView}
                  onRemove={onRemove}
                />
              );
            })}
          </div>
        )}

      </CardContent>
    </Card>
  );
}

const PLATFORM_THEME: Record<string, { bar: string; chip: string; handle: string }> = {
  instagram: { bar: "bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-400", chip: "bg-rose-500 text-white", handle: "@your.brand" },
  linkedin: { bar: "bg-[#0a66c2]", chip: "bg-[#0a66c2] text-white", handle: "Your Brand · Company" },
  x: { bar: "bg-black", chip: "bg-black text-white", handle: "@yourbrand" },
  facebook: { bar: "bg-[#1877f2]", chip: "bg-[#1877f2] text-white", handle: "Your Brand" },
  tiktok: { bar: "bg-gradient-to-r from-[#ff0050] to-[#00f2ea]", chip: "bg-black text-white", handle: "@yourbrand" },
  youtube: { bar: "bg-[#ff0000]", chip: "bg-[#ff0000] text-white", handle: "Your Brand" },
  threads: { bar: "bg-zinc-900", chip: "bg-zinc-900 text-white", handle: "@yourbrand" },
  eventbrite: { bar: "bg-[#d1410c]", chip: "bg-[#d1410c] text-white", handle: "Hosted by Your Brand" },
};

function getMedia(path: string | null): { url: string; kind: "image" | "video" | "pdf" | "other" } | null {
  if (!path) return null;
  const ext = path.toLowerCase().split(".").pop() ?? "";
  const { data } = supabase.storage.from("social-media").getPublicUrl(path);
  let kind: "image" | "video" | "pdf" | "other" = "other";
  if (["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(ext)) kind = "image";
  else if (["mp4", "webm", "mov", "m4v", "ogg"].includes(ext)) kind = "video";
  else if (ext === "pdf") kind = "pdf";
  return { url: data.publicUrl, kind };
}

function PostCard({
  plan, highlight, editable, platformLabel, approvalLabel, postStatusLabel,
  onEdit, onView, onRemove,
}: {
  plan: Plan; highlight: boolean; editable: boolean;
  platformLabel: (v: string) => string;
  approvalLabel: (v: string) => string;
  postStatusLabel: (v: string) => string;
  onEdit: (p: Plan) => void; onView: (p: Plan) => void; onRemove: (p: Plan) => void;
}) {
  const theme = PLATFORM_THEME[plan.platform] ?? PLATFORM_THEME.linkedin;
  const media = getMedia(plan.media_path);
  const isVertical = plan.platform === "tiktok";
  return (
    <div className={`mb-4 break-inside-avoid rounded-2xl border bg-card shadow-soft overflow-hidden group transition hover:shadow-lg ${highlight ? "ring-2 ring-sidebar-primary" : ""}`}>
      <div className={`h-1.5 ${theme.bar}`} />
      <button type="button" onClick={() => onView(plan)} className="block w-full text-left">
        {/* Mini platform preview */}
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          <div className={`size-7 rounded-full grid place-items-center text-[10px] font-semibold ${theme.chip}`}>IO</div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate">{theme.handle}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {plan.scheduled_at ? new Date(plan.scheduled_at).toLocaleDateString() : "Unscheduled"} · {platformLabel(plan.platform)}
            </div>
          </div>
        </div>
        {media ? (
          <div className={`bg-muted overflow-hidden ${isVertical ? "aspect-[9/16]" : ""}`}>
            {media.kind === "image" && <img src={media.url} alt={plan.title || "Post media"} className="w-full h-auto block group-hover:scale-[1.02] transition-transform duration-300" />}
            {media.kind === "video" && <video src={media.url} className="w-full h-auto block" muted playsInline />}
            {media.kind === "pdf" && (
              <div className="aspect-square grid place-items-center text-xs text-muted-foreground">PDF attachment</div>
            )}
            {media.kind === "other" && (
              <div className="aspect-square grid place-items-center text-xs text-muted-foreground"><ImageIcon className="size-6 opacity-50" /></div>
            )}
          </div>
        ) : (
          <div className={`px-4 py-6 ${plan.platform === "x" ? "bg-black text-white" : plan.platform === "tiktok" ? "bg-black text-white" : "bg-muted/30"}`}>
            <div className="text-sm font-medium line-clamp-2">{plan.title || "Untitled"}</div>
          </div>
        )}
        <div className="px-3 py-3 space-y-2">
          {plan.title && media && <div className="text-sm font-semibold leading-snug line-clamp-2">{plan.title}</div>}
          <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{plan.copy || "—"}</div>
        </div>
      </button>
      <div className="px-3 pb-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {plan.approval_status === "approved"
            ? <Badge className="text-[10px]">{approvalLabel("approved")}</Badge>
            : plan.approval_status === "for_approval"
              ? <Badge className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 text-[10px]">{approvalLabel("for_approval")}</Badge>
              : <Badge variant="outline" className="text-[10px]">{approvalLabel("not_approved")}</Badge>}
          <Badge variant={plan.post_status === "posted" ? "default" : plan.post_status === "cancelled" ? "destructive" : "secondary"} className="text-[10px]">{postStatusLabel(plan.post_status)}</Badge>
        </div>
        <div className="flex items-center -mr-1">
          <Button variant="ghost" size="icon" title="Preview" onClick={() => onView(plan)}><Eye className="size-4" /></Button>
          {editable && <>
            <Button variant="ghost" size="icon" aria-label={`Edit ${plan.title}`} onClick={() => onEdit(plan)}><Pencil className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label={`Delete ${plan.title}`} onClick={() => onRemove(plan)}><Trash2 className="size-4" /></Button>
          </>}
        </div>
      </div>
    </div>
  );
}


function PlanDialog({ open, onOpenChange, plan, profiles, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; plan: Plan | null; profiles: Profile[]; onSaved: () => void }) {
  const { activeTenantId, user } = useAuth();
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [title, setTitle] = useState("");
  const [copy, setCopy] = useState(""); const [scheduledAt, setScheduledAt] = useState("");
  const [approval, setApproval] = useState<ApprovalStatus>("not_approved");
  const [status, setStatus] = useState<PostStatus>("not_posted");
  const [mediaPath, setMediaPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  const [approvers, setApprovers] = useState<string[]>([]);
  const previousApproversRef = useRef<string[]>([]);

  useEffect(() => {
    setPlatform(plan?.platform ?? "linkedin");
    setTitle(plan?.title ?? "");
    setCopy(plan?.copy ?? "");
    setScheduledAt(plan?.scheduled_at ? new Date(plan.scheduled_at).toISOString().slice(0, 10) : "");
    setApproval(plan?.approval_status ?? "not_approved");
    setStatus(plan?.post_status ?? "not_posted");
    setMediaPath(plan?.media_path ?? null);
    setCustom((plan?.custom as Record<string, unknown>) ?? {});
    const initial = (plan?.approvers ?? []) as string[];
    setApprovers(initial);
    previousApproversRef.current = initial;
  }, [plan, open]);

  const onUpload = async (file: File) => {
    if (!activeTenantId) { toast.error("Select an organisation first"); return; }
    setUploading(true);
    const path = `${activeTenantId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("social-media").upload(path, file);
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setMediaPath(path);
    toast.success("Uploaded");
  };

  const toggleApprover = (id: string) => {
    setApprovers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const notifyApprovers = async (planId: string, newApproverIds: string[]) => {
    if (newApproverIds.length === 0 || !activeTenantId) return;
    const rows = newApproverIds.map((uid) => ({
      user_id: uid,
      tenant_id: activeTenantId,
      type: "social_approval_request",
      title: "Post needs your approval",
      body: `${title || platform} is awaiting your review`,
      link: "/social",
    }));
    await supabase.from("notifications").insert(rows as never);
  };

  const submit = async () => {
    const effectiveApprovers = approval === "for_approval" ? approvers : [];
    const payload = {
      platform, title, copy, media_path: mediaPath,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      approval_status: approval, post_status: status,
      approvers: effectiveApprovers,
      custom: custom as never,
    };
    let savedId: string;
    if (plan) {
      const { error } = await supabase.from("social_plans").update(payload).eq("id", plan.id);
      if (error) { toast.error(error.message); return; }
      savedId = plan.id;
      await logActivity({ module: "social", entity_type: "post", entity_id: plan.id, verb: "updated", summary: `Updated ${platform} post` });
    } else {
      const { data, error } = await supabase.from("social_plans").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      savedId = data.id;
      await logActivity({ module: "social", entity_type: "post", entity_id: data.id, verb: "created", summary: `Planned ${platform} post` });
    }
    // Notify only newly added approvers (don't spam) and exclude the current user
    if (approval === "for_approval") {
      const prev = new Set(previousApproversRef.current);
      const toNotify = effectiveApprovers.filter((id) => !prev.has(id) && id !== user?.id);
      await notifyApprovers(savedId, toNotify);
    }
    toast.success("Saved"); onOpenChange(false); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[95vw] sm:max-w-[min(900px,95vw)] flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b shrink-0"><SheetTitle>{plan ? "Edit post" : "New post"}</SheetTitle></SheetHeader>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <PlanDialogSelects platform={platform} setPlatform={setPlatform} approval={approval} setApproval={setApproval} status={status} setStatus={setStatus} scheduledAt={scheduledAt} setScheduledAt={setScheduledAt} />
          <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label>Copy</Label><Textarea rows={10} value={copy} onChange={(e) => setCopy(e.target.value)} className="min-h-[200px]" /></div>
          <div className="space-y-1">
            <Label>Media (image, video or PDF)</Label>
            <Input type="file" accept="image/*,video/*,application/pdf,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }} />
            {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
            {mediaPath && <MediaPreview path={mediaPath} onRemove={() => setMediaPath(null)} />}
          </div>
          {approval === "for_approval" && (
            <div className="space-y-1">
              <Label>Approvers</Label>
              <p className="text-xs text-muted-foreground">Selected reviewers will be notified.</p>
              <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                {profiles.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No users available.</p>
                ) : profiles.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={approvers.includes(p.id)}
                      onChange={() => toggleApprover(p.id)}
                      className="size-4"
                    />
                    <span>{p.full_name || "—"}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <CustomFieldValues module="social" value={custom} onChange={setCustom} />
        </div>
        <SheetFooter className="p-6 pt-4 border-t shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground">Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function MediaPreview({ path, onRemove }: { path: string; onRemove: () => void }) {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  const { data } = supabase.storage.from("social-media").getPublicUrl(path);
  const url = data.publicUrl;
  const isPdf = ext === "pdf";
  const isVideo = ["mp4", "webm", "mov", "m4v", "ogg"].includes(ext);
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(ext);
  return (
    <div className="space-y-2 rounded-md border p-2 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate flex-1">{path}</a>
        <Button variant="ghost" size="sm" type="button" onClick={onRemove}>Remove</Button>
      </div>
      <div className="rounded overflow-hidden bg-background">
        {isPdf ? (
          <iframe src={url} title="PDF preview" className="w-full h-80 border-0" />
        ) : isVideo ? (
          <video src={url} controls className="w-full max-h-80" />
        ) : isImage ? (
          <img src={url} alt="Media preview" className="w-full max-h-80 object-contain" />
        ) : (
          <p className="text-xs text-muted-foreground p-3">Preview not available for this file type.</p>
        )}
      </div>
    </div>
  );
}

function PlanDialogSelects({
  platform, setPlatform, approval, setApproval, status, setStatus, scheduledAt, setScheduledAt,
}: {
  platform: Platform; setPlatform: (v: Platform) => void;
  approval: ApprovalStatus; setApproval: (v: ApprovalStatus) => void;
  status: PostStatus; setStatus: (v: PostStatus) => void;
  scheduledAt: string; setScheduledAt: (v: string) => void;
}) {
  const platformOptions = useBuiltinFieldOptions("social", "platform");
  const approvalOptions = useBuiltinFieldOptions("social", "approval_status");
  const postStatusOptions = useBuiltinFieldOptions("social", "post_status");
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label>Platform</Label>
        <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{platformOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Scheduled date</Label><Input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>
      <div className="space-y-1">
        <Label>Approval</Label>
        <Select value={approval} onValueChange={(v) => setApproval(v as ApprovalStatus)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{approvalOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Post status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as PostStatus)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{postStatusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminCreateUser,
  adminListUsers,
  adminResetPassword,
  adminSetAdminRole,
  adminSetModuleAccess,
  adminUpdateProfile,
} from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { generatePassword } from "@/lib/password";
import { Copy, Plus, RefreshCw, KeyRound, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/_authenticated/settings/users")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const [{ data: r }, { data: s }] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle(),
      supabase.from("super_admins").select("user_id").eq("user_id", data.user.id).maybeSingle(),
    ]);
    if (!r && !s) throw redirect({ to: "/dashboard" });
  },
  component: UsersPage,
});

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "calendar", label: "Calendar" },
  { key: "crm", label: "CRM" },
  { key: "outreach", label: "Email Outreach" },
  { key: "social", label: "Social Planner" },
  { key: "projects", label: "Projects & Works" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "issues", label: "Issues Tracker" },
] as const;

type Profile = {
  id: string;
  email: string;
  full_name: string;
  job_title: string | null;
  active: boolean;
  must_change_password: boolean;
  last_sign_in_at: string | null;
};
type Access = {
  user_id: string;
  module: string;
  can_view: boolean;
  can_edit: boolean;
  tenant_id: string;
};

function UsersPage() {
  const { activeTenantId, isSuperAdmin, tenants } = useAuth();
  const listFn = useServerFn(adminListUsers);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [access, setAccess] = useState<Access[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await listFn({ data: { tenant_id: activeTenantId ?? undefined } } as never);
      setProfiles(r.profiles as Profile[]);
      setAdminIds(
        new Set(
          r.roles
            .filter((x: { role: string; user_id: string }) => x.role === "admin")
            .map((x: { role: string; user_id: string }) => x.user_id),
        ),
      );
      setAccess(r.access as Access[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
  }, [activeTenantId]);

  const tenantLabel = tenants.find((t) => t.id === activeTenantId)?.name ?? "—";

  return (
    <Card className="shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Users & access</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {isSuperAdmin
              ? `Showing all users. Module access edits apply to organisation: ${tenantLabel}`
              : `Members of ${tenantLabel}`}
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-gradient-primary text-primary-foreground"
        >
          <Plus className="size-4 mr-2" />
          New user
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell className="text-muted-foreground">{p.job_title || "—"}</TableCell>
                  <TableCell>
                    {adminIds.has(p.id) ? (
                      <Badge>Admin</Badge>
                    ) : (
                      <Badge variant="secondary">Member</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.active ? (
                      <Badge variant="outline">Active</Badge>
                    ) : (
                      <Badge variant="destructive">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.last_sign_in_at
                      ? new Date(p.last_sign_in_at).toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={reload} />
      {editing && (
        <EditUserDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          profile={editing}
          isAdmin={adminIds.has(editing.id)}
          tenantId={activeTenantId ?? ""}
          access={access.filter((a) => a.user_id === editing.id && a.tenant_id === activeTenantId)}
          onSaved={reload}
        />
      )}
    </Card>
  );
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(generatePassword())}
        title="Generate"
      >
        <RefreshCw className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success("Copied");
        }}
        title="Copy"
      >
        <Copy className="size-4" />
      </Button>
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const createFn = useServerFn(adminCreateUser);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setFullName("");
      setJobTitle("");
      setPassword(generatePassword());
    }
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await createFn({ data: { email, full_name: fullName, job_title: jobTitle, password } });
      toast.success("User created. Share their temporary password.");
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            They'll be required to change the password on first login.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Job title</Label>
            <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Temporary password</Label>
            <PasswordField value={password} onChange={setPassword} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || !email || !fullName || password.length < 8}
            className="bg-gradient-primary text-primary-foreground"
          >
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  open,
  onOpenChange,
  profile,
  isAdmin,
  tenantId,
  access,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile: Profile;
  isAdmin: boolean;
  tenantId: string;
  access: Access[];
  onSaved: () => void;
}) {
  const updateFn = useServerFn(adminUpdateProfile);
  const roleFn = useServerFn(adminSetAdminRole);
  const accessFn = useServerFn(adminSetModuleAccess);
  const resetFn = useServerFn(adminResetPassword);

  const [fullName, setFullName] = useState(profile.full_name);
  const [jobTitle, setJobTitle] = useState(profile.job_title ?? "");
  const [active, setActive] = useState(profile.active);
  const [admin, setAdmin] = useState(isAdmin);
  const [entries, setEntries] = useState(() =>
    MODULES.map((m) => {
      const a = access.find((x) => x.module === m.key);
      return { module: m.key, can_view: !!a?.can_view, can_edit: !!a?.can_edit };
    }),
  );
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateFn({
        data: { user_id: profile.id, full_name: fullName, job_title: jobTitle || null, active },
      });
      await roleFn({ data: { user_id: profile.id, is_admin: admin } });
      if (tenantId) {
        await accessFn({ data: { user_id: profile.id, tenant_id: tenantId, entries } });
      }
      toast.success("Saved");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const resetPw = async () => {
    if (newPassword.length < 8) {
      toast.error("Generate or enter a password (min 8 chars) first.");
      return;
    }
    try {
      await resetFn({ data: { user_id: profile.id, password: newPassword } });
      toast.success("Password reset. Share it with the user.");
      navigator.clipboard.writeText(newPassword);
      setNewPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage {profile.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Job title</Label>
              <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              <div>
                <div className="text-sm font-medium">Admin</div>
                <div className="text-xs text-muted-foreground">
                  Full access to everything including user management.
                </div>
              </div>
            </div>
            <Switch checked={admin} onCheckedChange={setAdmin} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">
                Disabled users keep their account but can't be assigned.
              </div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <div>
            <Label className="mb-2 block">Module access</Label>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead className="w-24 text-center">View</TableHead>
                    <TableHead className="w-24 text-center">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MODULES.map((m, i) => (
                    <TableRow key={m.key}>
                      <TableCell>{m.label}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={entries[i].can_view || entries[i].can_edit}
                          disabled={admin}
                          onCheckedChange={(v) =>
                            setEntries((e) =>
                              e.map((x, j) =>
                                j === i
                                  ? { ...x, can_view: !!v, can_edit: v ? x.can_edit : false }
                                  : x,
                              ),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={entries[i].can_edit}
                          disabled={admin}
                          onCheckedChange={(v) =>
                            setEntries((e) =>
                              e.map((x, j) =>
                                j === i
                                  ? { ...x, can_edit: !!v, can_view: v ? true : x.can_view }
                                  : x,
                              ),
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {admin && (
              <p className="text-xs text-muted-foreground mt-1">
                Admins automatically have full access.
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4" />
              Reset password
            </div>
            <p className="text-xs text-muted-foreground">
              The user's current password stays unchanged unless you generate or enter a new one and
              click "Set new password".
            </p>
            <div className="flex gap-2">
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave empty to keep current password"
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setNewPassword(generatePassword())}
                title="Generate"
              >
                <RefreshCw className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!newPassword}
                onClick={() => {
                  navigator.clipboard.writeText(newPassword);
                  toast.success("Copied");
                }}
                title="Copy"
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={resetPw} disabled={newPassword.length < 8}>
              Set new password
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-gradient-primary text-primary-foreground"
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

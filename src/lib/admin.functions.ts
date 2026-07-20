import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function isSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("super_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}
async function isTenantMember(userId: string, tenantId: string) {
  const { data } = await supabaseAdmin
    .from("tenant_members")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return { isMember: !!data, role: data?.role ?? null };
}
async function isTenantAdmin(userId: string, tenantId: string) {
  if (await isSuperAdmin(userId)) return true;
  const { isMember, role: memberRole } = await isTenantMember(userId, tenantId);
  // Must actually be a member of the target tenant. Legacy global admin
  // role only elevates when the caller is also a member of that tenant.
  if (!isMember) return false;
  if (memberRole === "owner") return true;
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!role;
}
async function assertTenantMember(userId: string, tenantId: string) {
  if (await isSuperAdmin(userId)) return;
  const { isMember } = await isTenantMember(userId, tenantId);
  if (!isMember) throw new Error("Forbidden: not a member of target organisation");
}

async function assertAdmin(userId: string) {
  if (await isSuperAdmin(userId)) return;
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}
async function assertSuperAdmin(userId: string) {
  if (!(await isSuperAdmin(userId))) throw new Error("Forbidden: super admin only");
}

// Ensure the target user shares at least one tenant with the caller.
// Super admins bypass this check. Returns the set of shared tenant IDs.
async function assertSharesTenant(callerId: string, targetUserId: string): Promise<void> {
  if (await isSuperAdmin(callerId)) return;
  if (callerId === targetUserId) return;
  const [{ data: callerMems }, { data: targetMems }] = await Promise.all([
    supabaseAdmin.from("tenant_members").select("tenant_id").eq("user_id", callerId),
    supabaseAdmin.from("tenant_members").select("tenant_id").eq("user_id", targetUserId),
  ]);
  const callerSet = new Set((callerMems ?? []).map((m) => m.tenant_id));
  const shared = (targetMems ?? []).some((m) => callerSet.has(m.tenant_id));
  if (!shared) throw new Error("Forbidden: target user is not in your organisation");
}

export const clearMustChangePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        full_name: z.string().min(1).max(120),
        job_title: z.string().max(120).optional().default(""),
        tenant_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        job_title: data.job_title,
        must_change_password: true,
      },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        job_title: data.job_title,
        must_change_password: true,
      })
      .eq("id", uid);
    // Auto-add to tenant if provided; otherwise to creator's active tenant
    let tenantId = data.tenant_id;
    if (!tenantId) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("active_tenant_id")
        .eq("id", context.userId)
        .maybeSingle();
      tenantId = (p?.active_tenant_id ?? undefined) as string | undefined;
    }
    if (tenantId) {
      await supabaseAdmin
        .from("tenant_members")
        .upsert(
          { tenant_id: tenantId, user_id: uid, role: "member" } as never,
          { onConflict: "tenant_id,user_id" } as never,
        );
      await supabaseAdmin.from("profiles").update({ active_tenant_id: tenantId }).eq("id", uid);
    }
    return { user_id: uid };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        password: z.string().min(8).max(128),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await assertSharesTenant(context.userId, data.user_id);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", data.user_id);
    return { ok: true };
  });

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        full_name: z.string().min(1).max(120),
        job_title: z.string().max(120).nullable(),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await assertSharesTenant(context.userId, data.user_id);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        job_title: data.job_title,
        active: data.active,
      })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        is_admin: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    // Only super admins can grant/revoke the global admin role (it is not tenant-scoped).
    await assertSuperAdmin(context.userId);
    if (data.is_admin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: data.user_id, role: "admin" } as never,
          { onConflict: "user_id,role" } as never,
        );
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", "admin");
    }
    return { ok: true };
  });

const MODULES = [
  "dashboard",
  "calendar",
  "crm",
  "outreach",
  "social",
  "projects",
  "subscriptions",
  "issues",
  "settings",
] as const;

export const adminSetModuleAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        tenant_id: z.string().uuid(),
        entries: z
          .array(
            z.object({
              module: z.enum(MODULES),
              can_view: z.boolean(),
              can_edit: z.boolean(),
            }),
          )
          .max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isTenantAdmin(context.userId, data.tenant_id))) {
      throw new Error("Forbidden: admin only");
    }
    await supabaseAdmin
      .from("module_access")
      .delete()
      .eq("user_id", data.user_id)
      .eq("tenant_id", data.tenant_id);
    const rows = data.entries
      .filter((e) => e.can_view || e.can_edit)
      .map((e) => ({
        user_id: data.user_id,
        tenant_id: data.tenant_id,
        module: e.module,
        can_view: e.can_view || e.can_edit,
        can_edit: e.can_edit,
      }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from("module_access").insert(rows as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tenant_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const superAdmin = await isSuperAdmin(context.userId);

    // Non-super admins MUST provide a tenant_id and must be a member of it.
    let tenantId = data.tenant_id;
    if (!superAdmin) {
      if (!tenantId) {
        const { data: p } = await supabaseAdmin
          .from("profiles")
          .select("active_tenant_id")
          .eq("id", context.userId)
          .maybeSingle();
        tenantId = (p?.active_tenant_id ?? undefined) as string | undefined;
      }
      if (!tenantId) throw new Error("Forbidden: tenant_id required");
      const { data: callerMem } = await supabaseAdmin
        .from("tenant_members")
        .select("user_id")
        .eq("user_id", context.userId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!callerMem) throw new Error("Forbidden: not a member of that organisation");
    }

    const [
      { data: profiles },
      { data: roles },
      { data: access },
      { data: members },
      { data: supers },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: true }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("module_access").select("*"),
      supabaseAdmin.from("tenant_members").select("*"),
      supabaseAdmin.from("super_admins").select("user_id"),
    ]);

    // Pull last_sign_in_at from auth.users via the Admin API (paginate to cover all users).
    const lastSignInById = new Map<string, string | null>();
    try {
      let page = 1;
      // perPage max is 1000 in supabase-js
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: authPage, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (authErr) break;
        for (const u of authPage.users) {
          lastSignInById.set(u.id, u.last_sign_in_at ?? null);
        }
        if (authPage.users.length < 1000) break;
        page += 1;
      }
    } catch {
      // non-fatal — column will just show "—"
    }

    let visibleProfiles = profiles ?? [];
    let visibleRoles = roles ?? [];
    let visibleAccess = access ?? [];
    let visibleMembers = members ?? [];
    let visibleSupers = superAdmin ? (supers ?? []) : [];

    if (!superAdmin && tenantId) {
      const memberIds = new Set(
        (members ?? []).filter((m) => m.tenant_id === tenantId).map((m) => m.user_id),
      );
      visibleProfiles = visibleProfiles.filter((p) => memberIds.has(p.id));
      visibleMembers = (members ?? []).filter((m) => m.tenant_id === tenantId);
      visibleAccess = (access ?? []).filter(
        (a) => a.tenant_id === tenantId && memberIds.has(a.user_id),
      );
      visibleRoles = (roles ?? []).filter((r) => memberIds.has(r.user_id));
    }

    const profilesWithLogin = visibleProfiles.map((p) => ({
      ...p,
      last_sign_in_at: lastSignInById.get(p.id) ?? null,
    }));
    return {
      profiles: profilesWithLogin,
      roles: visibleRoles,
      access: visibleAccess,
      members: visibleMembers,
      supers: visibleSupers,
    };
  });

// ====== Tenant management (super admin only) ======

export const adminListTenants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data } = await supabaseAdmin.from("tenants").select("*").order("name");
    return { tenants: data ?? [] };
  });

export const adminCreateTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(120),
        slug: z
          .string()
          .min(1)
          .max(60)
          .regex(/^[a-z0-9-]+$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin
      .from("tenants")
      .insert(data as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { tenant: created };
  });

export const adminUpdateTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(120),
        active: z.boolean(),
        logo_url: z.string().url().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("tenants")
      .update({ name: data.name, active: data.active, logo_url: data.logo_url ?? null } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("tenants").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAssignTenantMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        tenant_id: z.string().uuid(),
        role: z.enum(["owner", "member"]).default("member"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("tenant_members")
      .upsert(
        { tenant_id: data.tenant_id, user_id: data.user_id, role: data.role } as never,
        { onConflict: "tenant_id,user_id" } as never,
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRemoveTenantMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        tenant_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("tenant_members")
      .delete()
      .eq("user_id", data.user_id)
      .eq("tenant_id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        is_super: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.is_super) {
      await supabaseAdmin
        .from("super_admins")
        .upsert(
          { user_id: data.user_id, granted_by: context.userId } as never,
          { onConflict: "user_id" } as never,
        );
    } else {
      if (data.user_id === context.userId)
        throw new Error("Cannot remove your own super admin role");
      await supabaseAdmin.from("super_admins").delete().eq("user_id", data.user_id);
    }
    return { ok: true };
  });

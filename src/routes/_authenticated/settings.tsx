import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsLayout });

function SettingsLayout() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const tabs = [
    { to: "/settings/profile", label: "Profile" },
    ...(isSuperAdmin ? [{ to: "/settings/tenants", label: "Organisations" }] : []),
    ...(isAdmin || isSuperAdmin ? [
      { to: "/settings/users", label: "Users & Access" },
      { to: "/settings/fields", label: "Other Information" },
      { to: "/settings/milestones", label: "Milestones" },
      { to: "/settings/plans", label: "Subscription Plans" },
      { to: "/settings/cost-proposal", label: "Cost Proposal" },
      { to: "/settings/leads", label: "Leads" },
      { to: "/settings/fiscal-year", label: "Financial Year" },
    ] : []),
  ];
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} className={cn(
            "px-4 py-2 text-sm border-b-2 -mb-px",
            path === t.to ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}>{t.label}</Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
}

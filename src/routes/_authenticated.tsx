import {
  createFileRoute,
  Outlet,
  Link,
  useRouterState,
  useNavigate,
  redirect,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Mail,
  CalendarDays,
  Megaphone,
  Briefcase,
  CreditCard,
  Bell,
  Settings,
  LogOut,
  Menu,
  CircleAlert,
  Gauge,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import logoUrl from "@/assets/io-gen-logo.png";
import { FiscalYearProvider, FiscalYearSelect } from "@/lib/fiscal-year";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  module?: string;
  external?: boolean;
  href?: string;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, module: "calendar" },
];
const BIZ_DEV: NavItem[] = [
  { to: "/crm", label: "Contacts", icon: Users, module: "crm" },
  { to: "/outreach", label: "Email Outreach", icon: Mail, module: "outreach" },
  { to: "/social", label: "Social Planner", icon: Megaphone, module: "social" },
];
const OPS: NavItem[] = [
  { to: "/projects", label: "Projects & Works", icon: Briefcase, module: "projects" },
  { to: "/subscriptions", label: "Subscriptions", icon: CreditCard, module: "subscriptions" },
  { to: "/issues", label: "Issues Tracker", icon: CircleAlert, module: "issues" },
  {
    to: "https://data.io-gen.app",
    label: "Data Flow Tracker",
    icon: Gauge,
    module: "issues",
    external: true,
  },
];

function AuthLayout() {
  const {
    profile,
    signOut,
    canView,
    isAdmin,
    isSuperAdmin,
    user,
    loading,
    tenants,
    activeTenantId,
    switchTenant,
  } = useAuth();
  const [unread, setUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!loading && profile?.must_change_password && !redirectedRef.current) {
      redirectedRef.current = true;
      void navigate({ to: "/reset-password" });
    }
  }, [loading, profile?.must_change_password, navigate]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .is("read_at", null)
        .eq("user_id", userId);
      setUnread(count ?? 0);
    };
    void load();
    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const adminVisible = isAdmin || isSuperAdmin;

  return (
    <FiscalYearProvider>
    <div className="min-h-dvh w-full flex bg-background">
      <FloatingSidebar canView={canView} adminVisible={adminVisible} onSignOut={() => signOut()} />


      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-card">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle className="flex items-center gap-2">
              <img src={logoUrl} alt="" className="h-7 w-7 object-contain" />
              <span className="text-sm font-semibold">Business Ops</span>
            </SheetTitle>
          </SheetHeader>
          <MobileNavBody
            canView={canView}
            adminVisible={adminVisible}
            onNavigate={() => setMobileOpen(false)}
            onSignOut={() => {
              setMobileOpen(false);
              signOut();
            }}
          />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 md:pr-3">
        <header className="flex items-center px-4 md:px-8 h-14 gap-2 sticky top-0 z-10 bg-background/80 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {(tenants.length > 0 || isSuperAdmin) &&
            (tenants.length === 1 && !isSuperAdmin ? (
              <span className="text-sm font-medium truncate max-w-[200px]">{tenants[0].name}</span>
            ) : (
              <Select
                value={activeTenantId ?? undefined}
                onValueChange={(v) => {
                  void switchTenant(v);
                }}
                disabled={tenants.length === 0}
              >
                <SelectTrigger className="w-[220px] h-9 bg-card border-border/60 rounded-xl">
                  <SelectValue placeholder="Select organisation" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {!t.active && " (disabled)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          <div className="flex-1" />
          <Link
            to="/notifications"
            className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <Badge className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] px-1 text-[10px] bg-destructive text-destructive-foreground flex items-center justify-center rounded-full">
                {unread > 9 ? "9+" : unread}
              </Badge>
            )}
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2 h-9">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {(profile?.full_name || user?.email || "U").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-sm">
                  {profile?.full_name || user?.email}
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>Account</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-1">
                <div className="px-3 py-2 text-xs text-muted-foreground">{profile?.email}</div>
                <Link
                  to="/settings/profile"
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  Profile
                </Link>
                {adminVisible && (
                  <Link
                    to="/settings/users"
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    User management
                  </Link>
                )}
                <Button
                  variant="ghost"
                  onClick={() => signOut()}
                  className="w-full justify-start rounded-lg px-3"
                >
                  <LogOut className="size-4" /> Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex-1 overflow-auto px-4 md:px-8 pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function navGroups(canView: (m: string) => boolean) {
  return [
    { label: "Overview", items: NAV.filter((i) => !i.module || canView(i.module)) },
    { label: "Business Development", items: BIZ_DEV.filter((i) => !i.module || canView(i.module)) },
    { label: "Operations", items: OPS.filter((i) => !i.module || canView(i.module)) },
  ].filter((g) => g.items.length > 0);
}

function FloatingSidebar({
  canView,
  adminVisible,
  onSignOut,
}: {
  canView: (m: string) => boolean;
  adminVisible: boolean;
  onSignOut: () => void;
}) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => path === p || path.startsWith(p + "/");
  const groups = navGroups(canView);

  return (
    <aside className="hidden md:flex flex-col w-[220px] bg-card shrink-0 h-[calc(100vh-1.5rem)] sticky top-3 ml-3 rounded-2xl border border-border/60 shadow-floating overflow-hidden">
      <div className="flex items-center gap-2 h-14 px-4">
        <img src={logoUrl} alt="" className="h-7 w-7 object-contain" />
        <span className="font-semibold text-sm text-foreground tracking-tight">Business Ops</span>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pt-1 px-2 pb-2">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </div>
            {group.items.map((item) => {
              const active = !item.external && isActive(item.to);
              const className = `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`;
              if (item.external) {
                return (
                  <a
                    key={item.to}
                    href={item.to}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="leading-tight truncate">{item.label}</span>
                  </a>
                );
              }
              return (
                <Link key={item.to} to={item.to} className={className}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="leading-tight truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 shrink-0 pb-3 px-2 border-t border-border/60 pt-2">
        {adminVisible && (
          <Link
            to="/settings/profile"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive("/settings")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            }`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="leading-tight truncate">Settings</span>
          </Link>
        )}
        <Button
          variant="ghost"
          onClick={onSignOut}
          className="w-full justify-start gap-3 px-3 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="leading-tight truncate">Sign out</span>
        </Button>
      </div>
    </aside>
  );
}

function MobileNavBody({
  canView,
  adminVisible,
  onNavigate,
  onSignOut,
}: {
  canView: (m: string) => boolean;
  adminVisible: boolean;
  onNavigate: () => void;
  onSignOut: () => void;
}) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => path === p || path.startsWith(p + "/");
  const groups = navGroups(canView);
  return (
    <nav className="flex flex-col gap-3 px-2 pt-2 pb-4">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </div>
          {group.items.map((item) => {
            const active = !item.external && isActive(item.to);
            const className = `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            }`;
            if (item.external) {
              return (
                <a
                  key={item.to}
                  href={item.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onNavigate}
                  className={className}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </a>
              );
            }
            return (
              <Link key={item.to} to={item.to} onClick={onNavigate} className={className}>
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
      <div className="border-t border-border/60 mt-2 pt-2 flex flex-col gap-0.5">
        {adminVisible && (
          <Link
            to="/settings/profile"
            onClick={onNavigate}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
          >
            <Settings className="h-4 w-4" /> Settings
          </Link>
        )}
        <Button
          variant="ghost"
          onClick={onSignOut}
          className="w-full justify-start gap-3 px-3 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </nav>
  );
}

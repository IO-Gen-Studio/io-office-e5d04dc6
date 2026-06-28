import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Mail, Briefcase, CreditCard } from "lucide-react";
import { useFiscalYear } from "@/lib/fiscal-year";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { profile } = useAuth();
  const { range } = useFiscalYear();
  const [counts, setCounts] = useState({ contacts: 0, campaigns: 0, projects: 0, subscriptions: 0 });

  useEffect(() => {
    (async () => {
      let contactsQ = supabase.from("contacts").select("*", { count: "exact", head: true });
      let campaignsQ = supabase.from("campaigns").select("*", { count: "exact", head: true });
      let projectsQ = supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "in_progress");
      let subsQ = supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active");
      if (range) {
        contactsQ = contactsQ.gte("created_at", range.start).lte("created_at", `${range.end}T23:59:59`);
        campaignsQ = campaignsQ.gte("created_at", range.start).lte("created_at", `${range.end}T23:59:59`);
        projectsQ = projectsQ.gte("start_date", range.start).lte("start_date", range.end);
        subsQ = subsQ.gte("renewal_date", range.start).lte("renewal_date", range.end);
      }
      const [{ count: cContacts }, { count: cCampaigns }, { count: cProjects }, { count: cSubs }] = await Promise.all([
        contactsQ, campaignsQ, projectsQ, subsQ,
      ]);
      setCounts({ contacts: cContacts ?? 0, campaigns: cCampaigns ?? 0, projects: cProjects ?? 0, subscriptions: cSubs ?? 0 });
    })();
  }, [range?.start, range?.end]);

  const kpis = [
    { label: "Contacts", value: counts.contacts, icon: Users },
    { label: "Active campaigns", value: counts.campaigns, icon: Mail },
    { label: "Open projects", value: counts.projects, icon: Briefcase },
    { label: "Active subscriptions", value: counts.subscriptions, icon: CreditCard },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">Here's a snapshot of your business.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="shadow-soft">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm text-muted-foreground font-medium">{k.label}</CardTitle>
              <k.icon className="size-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-3xl font-semibold text-gradient">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { useFiscalYear } from "@/lib/fiscal-year";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/fiscal-year")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: r } = await supabase
      .from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    if (!r) throw redirect({ to: "/dashboard" });
  },
  component: FiscalYearSettings,
});

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function pad(n: number) { return n.toString().padStart(2, "0"); }
function lastDayOfMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }

function computeRange(startMonth: number, startYear: number) {
  // FY starting on startMonth/startYear, ending day before next year's startMonth/1
  const endYear = startMonth === 1 ? startYear : startYear + 1;
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endDay = lastDayOfMonth(endYear, endMonth);
  return {
    start_date: `${startYear}-${pad(startMonth)}-01`,
    end_date: `${endYear}-${pad(endMonth)}-${pad(endDay)}`,
  };
}

function defaultLabel(startMonth: number, startYear: number) {
  return startMonth === 1 ? `FY${startYear}` : `FY${startYear + 1}`;
}

function FiscalYearSettings() {
  const { activeTenantId } = useAuth();
  const { years, reload } = useFiscalYear();
  const [startMonth, setStartMonth] = useState<number>(1);
  const [savingMonth, setSavingMonth] = useState(false);

  const [newYear, setNewYear] = useState<number>(new Date().getFullYear());
  const [newLabel, setNewLabel] = useState<string>("");

  useEffect(() => {
    if (!activeTenantId) return;
    (async () => {
      const { data } = await supabase
        .from("fiscal_year_settings").select("start_month").eq("tenant_id", activeTenantId).maybeSingle();
      if (data) setStartMonth(data.start_month as number);
    })();
  }, [activeTenantId]);

  useEffect(() => {
    setNewLabel(defaultLabel(startMonth, newYear));
  }, [startMonth, newYear]);

  const saveStartMonth = async () => {
    if (!activeTenantId) return;
    setSavingMonth(true);
    const { error } = await supabase
      .from("fiscal_year_settings")
      .upsert({ tenant_id: activeTenantId, start_month: startMonth } as never, { onConflict: "tenant_id" });
    setSavingMonth(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Fiscal year start month saved");
  };

  const addYear = async () => {
    if (!activeTenantId) return;
    const range = computeRange(startMonth, newYear);
    const { error } = await supabase.from("fiscal_years").insert({
      tenant_id: activeTenantId,
      label: newLabel || defaultLabel(startMonth, newYear),
      start_date: range.start_date,
      end_date: range.end_date,
      is_current: years.length === 0,
    } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Year added");
    await reload();
  };

  const removeYear = async (id: string) => {
    if (!confirm("Delete this fiscal year?")) return;
    const { error } = await supabase.from("fiscal_years").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    await reload();
  };

  const setCurrent = async (id: string) => {
    if (!activeTenantId) return;
    // Clear existing current then set new one
    await supabase.from("fiscal_years").update({ is_current: false } as never).eq("tenant_id", activeTenantId).eq("is_current", true);
    const { error } = await supabase.from("fiscal_years").update({ is_current: true } as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Current year updated");
    await reload();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Fiscal year start month</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Start month</Label>
            <Select value={String(startMonth)} onValueChange={(v) => setStartMonth(Number(v))}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveStartMonth} disabled={savingMonth}>Save</Button>
          <p className="text-xs text-muted-foreground basis-full">
            Determines the start of each fiscal year. New years added below pre-fill from this setting.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Add fiscal year</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Start year</Label>
            <Input type="number" value={newYear} onChange={(e) => setNewYear(Number(e.target.value))} className="w-[140px]" />
          </div>
          <div className="space-y-1">
            <Label>Label</Label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="w-[180px]" />
          </div>
          <div className="text-sm text-muted-foreground self-end pb-2">
            {(() => { const r = computeRange(startMonth, newYear); return `${r.start_date} → ${r.end_date}`; })()}
          </div>
          <Button onClick={addYear}><Plus className="h-4 w-4" /> Add</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Fiscal years</CardTitle></CardHeader>
        <CardContent>
          {years.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fiscal years yet. Add your first year above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {years.map((y) => (
                  <TableRow key={y.id}>
                    <TableCell className="font-medium">{y.label}</TableCell>
                    <TableCell>{y.start_date}</TableCell>
                    <TableCell>{y.end_date}</TableCell>
                    <TableCell>{y.is_current ? <Badge>Current</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {!y.is_current && (
                        <Button size="sm" variant="outline" onClick={() => setCurrent(y.id)} title="Set as current">
                          <Star className="h-4 w-4" /> Set current
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => removeYear(y.id)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";

export type FiscalYear = {
  id: string;
  tenant_id: string;
  label: string;
  start_date: string; // yyyy-mm-dd
  end_date: string;
  is_current: boolean;
};

type FYContext = {
  years: FiscalYear[];
  activeYearId: string | null; // null = "All years"
  activeYear: FiscalYear | null;
  setActiveYearId: (id: string | null) => void;
  range: { start: string; end: string } | null;
  inRange: (date: string | null | undefined) => boolean;
  overlapsRange: (start: string | null | undefined, end: string | null | undefined) => boolean;
  reload: () => Promise<void>;
};

const Ctx = createContext<FYContext | null>(null);

const STORAGE_PREFIX = "fy.active.";

export function FiscalYearProvider({ children }: { children: ReactNode }) {
  const { activeTenantId } = useAuth();
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [activeYearId, setActiveYearIdState] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeTenantId) { setYears([]); return; }
    const { data } = await supabase
      .from("fiscal_years")
      .select("*")
      .eq("tenant_id", activeTenantId)
      .order("start_date", { ascending: false });
    const list = (data ?? []) as FiscalYear[];
    setYears(list);
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_PREFIX + activeTenantId) : null;
    if (stored === "all") {
      setActiveYearIdState(null);
    } else if (stored && list.some((y) => y.id === stored)) {
      setActiveYearIdState(stored);
    } else {
      const current = list.find((y) => y.is_current) ?? list[0] ?? null;
      setActiveYearIdState(current?.id ?? null);
    }
  }, [activeTenantId]);

  useEffect(() => { void load(); }, [load]);

  const setActiveYearId = useCallback((id: string | null) => {
    setActiveYearIdState(id);
    if (activeTenantId && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_PREFIX + activeTenantId, id ?? "all");
    }
  }, [activeTenantId]);

  const activeYear = useMemo(() => years.find((y) => y.id === activeYearId) ?? null, [years, activeYearId]);
  const range = activeYear ? { start: activeYear.start_date, end: activeYear.end_date } : null;

  const inRange = useCallback((date: string | null | undefined) => {
    if (!range) return true;
    if (!date) return false;
    const d = date.slice(0, 10);
    return d >= range.start && d <= range.end;
  }, [range]);

  const overlapsRange = useCallback((start: string | null | undefined, end: string | null | undefined) => {
    if (!range) return true;
    const s = (start ?? end ?? "").slice(0, 10);
    const e = (end ?? start ?? "").slice(0, 10);
    if (!s && !e) return false;
    return s <= range.end && e >= range.start;
  }, [range]);

  const value: FYContext = { years, activeYearId, activeYear, setActiveYearId, range, inRange, overlapsRange, reload: load };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFiscalYear() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFiscalYear must be used inside FiscalYearProvider");
  return ctx;
}

export function FiscalYearSelect() {
  const { years, activeYearId, setActiveYearId } = useFiscalYear();
  // Use native select for zero-dep simplicity matching tenant select aesthetics
  return (
    <select
      value={activeYearId ?? "all"}
      onChange={(e) => setActiveYearId(e.target.value === "all" ? null : e.target.value)}
      className="h-9 px-3 rounded-xl border border-border/60 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      aria-label="Financial year"
      title="Financial year"
    >
      {years.length === 0 && <option value="all">All years</option>}
      {years.map((y) => (
        <option key={y.id} value={y.id}>{y.label}{y.is_current ? " (current)" : ""}</option>
      ))}
      {years.length > 0 && <option value="all">All years</option>}
    </select>
  );
}

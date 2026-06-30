import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatDateUK } from "@/lib/format";
import { UK_BANK_HOLIDAYS } from "@/lib/uk-bank-holidays";
import { useFiscalYear } from "@/lib/fiscal-year";

export const Route = createFileRoute("/_authenticated/calendar")({ component: CalendarPage });

type EventType = "team_holiday" | "conference" | "exhibition" | "other";

const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: "other", label: "General" },
  { value: "team_holiday", label: "Team Holiday" },
  { value: "conference", label: "Online Conference / Webinar" },
  { value: "exhibition", label: "Exhibition / Trade Show" },
];
const eventTypeLabel = (v: string | null | undefined) =>
  EVENT_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? "General";

type EvKind = "milestone" | "post" | "renewal" | "project" | "event" | "bank_holiday";
type Ev = {
  date: string; label: string; detail?: string;
  kind: EvKind; eventType?: EventType | null; eventId?: string;
};

type EventRow = {
  id: string; title: string; description: string | null; event_date: string;
  end_date: string | null;
  start_time: string | null; end_time: string | null; location: string | null; created_by: string | null;
  event_type: string | null;
};

// Tailwind classes per kind / event type. Bank holidays + team holidays share a colour.
const colorFor = (e: Pick<Ev, "kind" | "eventType">): string => {
  if (e.kind === "bank_holiday") return "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100";
  if (e.kind === "milestone") return "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100";
  if (e.kind === "post") return "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100";
  if (e.kind === "renewal") return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100";
  if (e.kind === "project") return "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100";
  // events: by event_type
  switch (e.eventType) {
    case "team_holiday": return "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100";
    case "conference": return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100";
    case "exhibition": return "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100";
    default: return "bg-primary/15 text-primary";
  }
};

const KIND_LEGEND: { label: string; sample: Pick<Ev, "kind" | "eventType"> }[] = [
  { label: "Milestone", sample: { kind: "milestone" } },
  { label: "Social post", sample: { kind: "post" } },
  { label: "Renewal", sample: { kind: "renewal" } },
  { label: "Project due", sample: { kind: "project" } },
  { label: "Team holiday", sample: { kind: "event", eventType: "team_holiday" } },
  { label: "Conference / Webinar", sample: { kind: "event", eventType: "conference" } },
  { label: "Exhibition / Trade show", sample: { kind: "event", eventType: "exhibition" } },
  { label: "UK bank holiday", sample: { kind: "bank_holiday" } },
];

function CalendarPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Ev[]>([]);
  const [eventRows, setEventRows] = useState<EventRow[]>([]);
  const { range } = useFiscalYear();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  // Note: calendar always opens on the current month, not the fiscal year start.
  void range;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    const [{ data: ms }, { data: sp }, { data: subs }, { data: pr }, { data: ev }] = await Promise.all([
      supabase.from("milestones").select("label,due_date").not("due_date", "is", null),
      supabase.from("social_plans").select("platform,scheduled_at,copy,title").not("scheduled_at", "is", null),
      supabase.from("subscriptions").select("plan_name,renewal_date").not("renewal_date", "is", null),
      supabase.from("projects").select("title,end_date").not("end_date", "is", null),
      supabase.from("events").select("*").order("event_date"),
    ]);
    const out: Ev[] = [];
    (ms ?? []).forEach((m) => out.push({ date: m.due_date as string, label: `Milestone: ${m.label}`, kind: "milestone" }));
    (sp ?? []).forEach((s) => out.push({ date: (s.scheduled_at as string).slice(0, 10), label: `${s.platform}: ${(s.title || s.copy || "").slice(0, 40)}`, kind: "post" }));
    (subs ?? []).forEach((s) => out.push({ date: s.renewal_date as string, label: `Renewal: ${s.plan_name}`, kind: "renewal" }));
    (pr ?? []).forEach((p) => out.push({ date: p.end_date as string, label: `Due: ${p.title}`, kind: "project" }));
    const evs = (ev ?? []) as EventRow[];
    setEventRows(evs);
    evs.forEach((e) => {
      const start = e.event_date;
      const end = e.end_date && e.end_date > e.event_date ? e.end_date : e.event_date;
      let ds = start;
      while (ds <= end) {
        out.push({
          date: ds, label: e.title, detail: e.description ?? undefined,
          kind: "event", eventType: (e.event_type as EventType | null) ?? null, eventId: e.id,
        });
        const [y, m, d] = ds.split("-").map(Number);
        const next = new Date(Date.UTC(y, m - 1, d + 1));
        ds = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
      }
    });
    UK_BANK_HOLIDAYS.forEach((h) => out.push({ date: h.date, label: `🇬🇧 ${h.title}`, kind: "bank_holiday" }));
    setEvents(out);
  };

  useEffect(() => { void load(); }, []);

  const { year, month, days, firstDow } = useMemo(() => {
    const y = cursor.getFullYear(); const m = cursor.getMonth();
    const lastDate = new Date(y, m + 1, 0).getDate();
    const jsDow = new Date(y, m, 1).getDay();
    return { year: y, month: m, days: Array.from({ length: lastDate }, (_, i) => i + 1), firstDow: (jsDow + 6) % 7 };
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Ev[]>();
    events.forEach((e) => { const arr = map.get(e.date) ?? []; arr.push(e); map.set(e.date, arr); });
    return map;
  }, [events]);

  const monthName = cursor.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const today = new Date().toISOString().slice(0, 10);

  const selectedItems = selectedDate ? byDay.get(selectedDate) ?? [] : [];
  const selectedEvents = selectedDate
    ? eventRows.filter((e) => {
        const end = e.end_date && e.end_date > e.event_date ? e.end_date : e.event_date;
        return selectedDate >= e.event_date && selectedDate <= end;
      })
    : [];
  const selectedBankHols = selectedDate ? UK_BANK_HOLIDAYS.filter((h) => h.date === selectedDate) : [];

  const removeEvent = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); void load();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1">Events, milestones, posts, renewals and deadlines.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="size-4" /></Button>
          <div className="font-medium w-40 text-center">{monthName}</div>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Button>
          <Button className="bg-gradient-primary text-primary-foreground" size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="size-4 mr-1" />New event
          </Button>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {KIND_LEGEND.map((l) => (
              <Badge key={l.label} variant="secondary" className={`text-[10px] ${colorFor(l.sample)}`}>{l.label}</Badge>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground mb-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="px-2 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}
            {days.map((d) => {
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const evs = byDay.get(dateStr) ?? [];
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  className={`min-h-24 rounded-lg border p-1.5 text-left transition-colors hover:border-primary ${isSelected ? "border-primary ring-2 ring-primary/30" : isToday ? "border-primary bg-primary/5" : "bg-card"}`}
                >
                  <div className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{d}</div>
                  <div className="space-y-0.5 mt-1">
                    {evs.slice(0, 3).map((e, i) => (
                      <Badge key={i} variant="secondary" className={`text-[10px] block truncate w-full justify-start ${colorFor(e)}`} title={e.label}>{e.label}</Badge>
                    ))}
                    {evs.length > 3 && <p className="text-[10px] text-muted-foreground">+{evs.length - 3} more</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selectedDate} onOpenChange={(o) => !o && setSelectedDate(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedDate ? (() => { const [y, m, d] = selectedDate.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); })() : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <Button size="sm" className="w-full bg-gradient-primary text-primary-foreground" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="size-4 mr-1" />Add event on this date
            </Button>

            {selectedBankHols.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">UK bank holiday</h3>
                {selectedBankHols.map((h) => (
                  <div key={h.date + h.title} className={`rounded-md border p-2 text-sm ${colorFor({ kind: "bank_holiday" })}`}>🇬🇧 {h.title}</div>
                ))}
              </div>
            )}

            {selectedEvents.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Events</h3>
                {selectedEvents.map((e) => (
                  <Card key={e.id} className="shadow-soft">
                    <CardContent className="pt-4 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{e.title}</p>
                            <Badge variant="secondary" className={`text-[10px] ${colorFor({ kind: "event", eventType: (e.event_type as EventType | null) })}`}>{eventTypeLabel(e.event_type)}</Badge>
                          </div>
                          {e.end_date && e.end_date > e.event_date && (
                            <p className="text-xs text-muted-foreground">
                              {formatDateUK(e.event_date)} – {formatDateUK(e.end_date)}
                            </p>
                          )}
                          {(e.start_time || e.end_time) && (
                            <p className="text-xs text-muted-foreground">{e.start_time ?? ""}{e.end_time ? ` – ${e.end_time}` : ""}</p>
                          )}
                          {e.location && <p className="text-xs text-muted-foreground">📍 {e.location}</p>}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Edit ${e.title}`} onClick={() => { setEditing(e); setDialogOpen(true); }}><Pencil className="size-4" /></Button>
                          {(e.created_by === user?.id) && (
                            <Button variant="ghost" size="icon" aria-label={`Delete ${e.title}`} onClick={() => removeEvent(e.id)}><Trash2 className="size-4" /></Button>
                          )}
                        </div>
                      </div>
                      {e.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{e.description}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {selectedItems.filter((i) => i.kind !== "event" && i.kind !== "bank_holiday").length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Other items</h3>
                {selectedItems.filter((i) => i.kind !== "event" && i.kind !== "bank_holiday").map((i, idx) => (
                  <div key={idx} className="rounded-md border p-2 text-sm flex items-center gap-2">
                    <Badge variant="secondary" className={`text-[10px] capitalize ${colorFor(i)}`}>{i.kind}</Badge>
                    <span>{i.label}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedItems.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing scheduled. Add an event to get started.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <EventDialog
        open={dialogOpen} onOpenChange={setDialogOpen}
        event={editing} defaultDate={selectedDate}
        onSaved={() => { setDialogOpen(false); void load(); }}
      />
    </div>
  );
}

function EventDialog({ open, onOpenChange, event, defaultDate, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  event: EventRow | null; defaultDate: string | null; onSaved: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [eventType, setEventType] = useState<EventType>("other");

  useEffect(() => {
    setTitle(event?.title ?? "");
    setDescription(event?.description ?? "");
    setEventDate(event?.event_date ?? defaultDate ?? new Date().toISOString().slice(0, 10));
    setEndDate(event?.end_date ?? "");
    setStartTime(event?.start_time ?? "");
    setEndTime(event?.end_time ?? "");
    setLocation(event?.location ?? "");
    setEventType(((event?.event_type as EventType | null) ?? "other"));
  }, [event, defaultDate, open]);

  const submit = async () => {
    if (!title.trim() || !eventDate) return;
    if (endDate && endDate < eventDate) {
      toast.error("End date must be on or after start date");
      return;
    }
    const payload = {
      title, description: description || null, event_date: eventDate,
      end_date: endDate || null,
      start_time: startTime || null, end_time: endTime || null,
      location: location || null,
      event_type: eventType,
      created_by: event?.created_by ?? user?.id ?? null,
    };
    if (event) {
      const { error } = await supabase.from("events").update(payload).eq("id", event.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("events").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Saved"); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Event type</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Start date *</Label><Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>End date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">Leave end date empty for single-day events. Use it for multi-day events like holidays.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Start time</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div className="space-y-1"><Label>End time</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div className="space-y-1"><Label>Description</Label><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground" disabled={!title.trim() || !eventDate}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

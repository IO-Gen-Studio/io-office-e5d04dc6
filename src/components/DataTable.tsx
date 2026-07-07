import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter,
  Search,
  Settings2,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ColumnType = "text" | "number" | "date" | "select" | "boolean";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  /** value used for sorting/filtering and as default render */
  accessor: (row: T) => unknown;
  /** custom display */
  render?: (row: T) => ReactNode;
  type?: ColumnType;
  /** options for type:"select" — value/label pairs */
  options?: { value: string; label: string }[];
  /** allow inline editing; if true, onSaveCell will be called */
  editable?: boolean;
  /** db field name when editable; defaults to key */
  editField?: string;
  align?: "left" | "right" | "center";
  /** css width e.g. "120px" */
  width?: string;
  sortable?: boolean;
  filterable?: boolean;
  hideable?: boolean;
};

type Prefs = {
  order: string[];
  hidden: string[];
  sort: { key: string; dir: "asc" | "desc" } | null;
  filters: Record<string, string>;
  showFilters: boolean;
};

type DataTableProps<T> = {
  tableKey: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowId: (row: T) => string;
  onSaveCell?: (row: T, columnKey: string, value: unknown) => Promise<void> | void;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => ReactNode;
  emptyMessage?: string;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
};

function defaultPrefs(cols: { key: string }[]): Prefs {
  return { order: cols.map((c) => c.key), hidden: [], sort: null, filters: {}, showFilters: false };
}

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    tableKey,
    columns,
    rows,
    rowId,
    onSaveCell,
    onRowClick,
    actions,
    emptyMessage,
    toolbarLeft,
    toolbarRight,
  } = props;
  const { user } = useAuth();
  const storeKey = `dt:${tableKey}:${user?.id ?? "anon"}`;

  const [prefs, setPrefs] = useState<Prefs>(() => {
    if (typeof window === "undefined") return defaultPrefs(columns);
    try {
      const raw = window.localStorage.getItem(storeKey);
      if (!raw) return defaultPrefs(columns);
      const parsed = JSON.parse(raw) as Prefs;
      // reconcile with current column set
      const known = new Set(columns.map((c) => c.key));
      const order = parsed.order.filter((k) => known.has(k));
      columns.forEach((c) => {
        if (!order.includes(c.key)) order.push(c.key);
      });
      return { ...defaultPrefs(columns), ...parsed, order };
    } catch {
      return defaultPrefs(columns);
    }
  });
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(storeKey, JSON.stringify(prefs));
  }, [prefs, storeKey]);

  // Reconcile saved order with the current column set whenever columns change.
  // Initial mount may receive an empty columns array (data still loading); without
  // this, the saved order stays empty and the table renders blank until remount.
  useEffect(() => {
    setPrefs((prev) => {
      const known = new Set(columns.map((c) => c.key));
      const filtered = prev.order.filter((k) => known.has(k));
      const next = [...filtered];
      let changed = filtered.length !== prev.order.length;
      columns.forEach((c) => {
        if (!next.includes(c.key)) {
          next.push(c.key);
          changed = true;
        }
      });
      return changed ? { ...prev, order: next } : prev;
    });
  }, [columns]);

  const orderedCols = useMemo(() => {
    const map = new Map(columns.map((c) => [c.key, c]));
    return prefs.order
      .map((k) => map.get(k))
      .filter((c): c is DataTableColumn<T> => !!c)
      .filter((c) => !prefs.hidden.includes(c.key));
  }, [columns, prefs.order, prefs.hidden]);

  // Filtering
  const filteredRows = useMemo(() => {
    const active = Object.entries(prefs.filters).filter(([, v]) => v && v.trim().length > 0);
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesColumns = active.every(([key, q]) => {
        const col = columns.find((c) => c.key === key);
        if (!col) return true;
        const v = col.accessor(row);
        if (v === null || v === undefined) return false;
        return String(v).toLowerCase().includes(q.toLowerCase());
      });
      if (!matchesColumns) return false;
      if (!query) return true;
      return columns.some((col) =>
        String(col.accessor(row) ?? "")
          .toLowerCase()
          .includes(query),
      );
    });
  }, [rows, prefs.filters, columns, search]);

  // Sorting
  const sortedRows = useMemo(() => {
    if (!prefs.sort) return filteredRows;
    const col = columns.find((c) => c.key === prefs.sort!.key);
    if (!col) return filteredRows;
    const dir = prefs.sort.dir === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return (
        String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }) *
        dir
      );
    });
  }, [filteredRows, prefs.sort, columns]);

  const toggleSort = (key: string) => {
    setPrefs((p) => {
      if (!p.sort || p.sort.key !== key) return { ...p, sort: { key, dir: "asc" } };
      if (p.sort.dir === "asc") return { ...p, sort: { key, dir: "desc" } };
      return { ...p, sort: null };
    });
  };

  const toggleHidden = (key: string) => {
    setPrefs((p) =>
      p.hidden.includes(key)
        ? { ...p, hidden: p.hidden.filter((k) => k !== key) }
        : { ...p, hidden: [...p.hidden, key] },
    );
  };

  const reset = () => setPrefs(defaultPrefs(columns));
  const setFilter = (key: string, value: string) =>
    setPrefs((p) => ({ ...p, filters: { ...p.filters, [key]: value } }));

  // Drag reorder
  const dragKey = useRef<string | null>(null);
  const onDragStart = (key: string) => (e: React.DragEvent) => {
    dragKey.current = key;
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (key: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragKey.current;
    dragKey.current = null;
    if (!from || from === key) return;
    setPrefs((p) => {
      const order = [...p.order];
      const fromIdx = order.indexOf(from);
      const toIdx = order.indexOf(key);
      if (fromIdx < 0 || toIdx < 0) return p;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, from);
      return { ...p, order };
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {toolbarLeft}
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all columns…"
            aria-label="Search all columns"
            className="pl-9"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPrefs((p) => ({ ...p, showFilters: !p.showFilters }))}
          >
            <Filter className="size-4 mr-1" />
            Filters
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="size-4 mr-1" />
                Columns
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>Show columns</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-1">
                {columns
                  .filter((c) => c.hideable !== false)
                  .map((c) => (
                    <label
                      key={c.key}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={!prefs.hidden.includes(c.key)}
                        onCheckedChange={() => toggleHidden(c.key)}
                      />
                      <span>{c.header}</span>
                    </label>
                  ))}
                <div className="my-2 border-t border-border" />
                <Button
                  variant="ghost"
                  onClick={reset}
                  className="w-full justify-start rounded-lg px-3"
                >
                  <RotateCcw className="size-4" />
                  Reset to default
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          {toolbarRight}
        </div>
      </div>

      <div className="relative w-full overflow-auto rounded-md border">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b">
              {orderedCols.map((c) => (
                <th
                  key={c.key}
                  draggable
                  onDragStart={onDragStart(c.key)}
                  onDragOver={onDragOver}
                  onDrop={onDrop(c.key)}
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(
                    "h-10 px-2 text-left align-middle font-medium text-muted-foreground select-none",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => c.sortable !== false && toggleSort(c.key)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-foreground transition-colors",
                      c.sortable === false && "cursor-default hover:text-muted-foreground",
                    )}
                  >
                    <span className="cursor-grab" title="Drag to reorder">
                      ⋮⋮
                    </span>
                    {c.header}
                    {c.sortable !== false &&
                      (prefs.sort?.key === c.key ? (
                        prefs.sort.dir === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-30" />
                      ))}
                  </button>
                </th>
              ))}
              {actions && (
                <th className="h-10 px-2 text-right text-muted-foreground font-medium">Actions</th>
              )}
            </tr>
            {prefs.showFilters && (
              <tr className="border-b bg-muted/30">
                {orderedCols.map((c) => (
                  <th key={c.key} className="px-2 py-1">
                    {c.filterable === false ? null : c.type === "select" && c.options ? (
                      <Select
                        value={prefs.filters[c.key] ?? "__all__"}
                        onValueChange={(v) => setFilter(c.key, v === "__all__" ? "" : v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All</SelectItem>
                          {c.options.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        className="h-8 text-xs"
                        placeholder="Filter"
                        value={prefs.filters[c.key] ?? ""}
                        onChange={(e) => setFilter(c.key, e.target.value)}
                      />
                    )}
                  </th>
                ))}
                {actions && <th />}
              </tr>
            )}
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={orderedCols.length + (actions ? 1 : 0)}
                  className="text-center text-muted-foreground py-8"
                >
                  {emptyMessage ?? "No data."}
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => (
                <tr
                  key={rowId(row)}
                  className={cn(
                    "border-b transition-colors hover:bg-muted/50",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {orderedCols.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "p-2 align-middle",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                      )}
                      onClick={(e) => {
                        if (c.editable && onSaveCell) e.stopPropagation();
                      }}
                    >
                      {c.editable && onSaveCell ? (
                        <EditableCell row={row} col={c} onSave={onSaveCell} />
                      ) : c.render ? (
                        c.render(row)
                      ) : (
                        formatDefault(c.accessor(row))
                      )}
                    </td>
                  ))}
                  {actions && (
                    <td className="p-2 text-right" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDefault(v: unknown): ReactNode {
  if (v === null || v === undefined || v === "")
    return <span className="text-muted-foreground">—</span>;
  return String(v);
}

function EditableCell<T>({
  row,
  col,
  onSave,
}: {
  row: T;
  col: DataTableColumn<T>;
  onSave: (row: T, key: string, value: unknown) => Promise<void> | void;
}) {
  const raw = col.accessor(row);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(raw == null ? "" : String(raw));

  useEffect(() => {
    setValue(raw == null ? "" : String(raw));
  }, [raw]);

  const display = col.render ? col.render(row) : formatDefault(raw);

  const commit = async (next: string) => {
    setEditing(false);
    const original = raw == null ? "" : String(raw);
    if (next === original) return;
    let parsed: unknown = next;
    if (col.type === "number") parsed = next === "" ? null : Number(next);
    else if (col.type === "date") parsed = next === "" ? null : next;
    else if (col.type === "text" && next === "") parsed = null;
    await onSave(row, col.editField ?? col.key, parsed);
  };

  if (col.type === "boolean") {
    return (
      <Checkbox
        checked={Boolean(raw)}
        onCheckedChange={(c) => onSave(row, col.editField ?? col.key, c === true)}
      />
    );
  }

  if (col.type === "select" && col.options) {
    return (
      <Select
        value={String(raw ?? "")}
        onValueChange={(v) => onSave(row, col.editField ?? col.key, v)}
      >
        <SelectTrigger className="h-8 text-xs w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {col.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (editing) {
    return (
      <Input
        autoFocus
        type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void commit(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setEditing(false);
            setValue(raw == null ? "" : String(raw));
          }
        }}
        className="h-8 text-sm"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full text-left hover:bg-muted/40 rounded px-1 py-0.5 -mx-1 -my-0.5"
    >
      {display}
    </button>
  );
}

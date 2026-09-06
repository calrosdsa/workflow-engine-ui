// Second workbench story — deliberately NOT another simple primitive.
// DataTable composes dnd-kit's DndContext + SortableContext + a keyboard
// sensor (see data-table.tsx's own handleDragEnd/sensors) — real,
// non-trivial interactivity that needs a live browser DOM (pointer events,
// focus, drag), not just JSX rendering correctly. If this misbehaves but
// Button's story looks fine, the gap is almost certainly a stub Ladle's
// isolated page is missing that a real app page provides for free (a
// polyfill, a wrapping context) — worth knowing NOW rather than the first
// time someone reaches for the workbench on a genuinely complex component.
import { useState } from "react";
import type { StoryDefault } from "@ladle/react";
import { DataTable, type DataTableColumn } from "./data-table";
import { Badge } from "./badge";

export default {
  title: "UI/DataTable",
} satisfies StoryDefault;

interface Row {
  id: string;
  name: string;
  status: "active" | "invited" | "suspended";
  role: string;
}

const ROWS: Row[] = [
  { id: "1", name: "Amara Okoye", status: "active", role: "Owner" },
  { id: "2", name: "Diego Fuentes", status: "invited", role: "Editor" },
  { id: "3", name: "Priya Natarajan", status: "active", role: "Viewer" },
  { id: "4", name: "Sofia Marchetti", status: "suspended", role: "Editor" },
];

const STATUS_VARIANT: Record<Row["status"], "default" | "secondary" | "destructive"> = {
  active: "default",
  invited: "secondary",
  suspended: "destructive",
};

const BASE_COLUMNS: DataTableColumn[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "role", label: "Role", sortable: true },
  {
    key: "status",
    label: "Status",
    render: (row) => <Badge variant={STATUS_VARIANT[row.status as Row["status"]]}>{String(row.status)}</Badge>,
  },
];

// Stateful sort + draggable columns — exercises onSortChange AND
// onColumnsReorder together, both of which are no-ops for callers that
// don't pass them (per the component's own doc comment), so this is also
// the story that would catch a regression in that opt-in behavior.
export const SortableAndReorderable = () => {
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columnOrder, setColumnOrder] = useState(BASE_COLUMNS.map((c) => c.key));

  const columns = columnOrder
    .map((key) => BASE_COLUMNS.find((c) => c.key === key)!)
    .filter(Boolean);

  const sorted = [...ROWS].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    return String(a[sortField as keyof Row]).localeCompare(String(b[sortField as keyof Row])) * dir;
  });

  return (
    <DataTable
      columns={columns}
      rows={sorted as unknown as Record<string, unknown>[]}
      getRowId={(row) => row.id as string}
      sortField={sortField}
      sortDir={sortDir}
      onSortChange={(field) => {
        if (field === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
          setSortField(field);
          setSortDir("asc");
        }
      }}
      onColumnsReorder={setColumnOrder}
    />
  );
};

export const Loading = () => (
  <DataTable columns={BASE_COLUMNS} rows={[]} getRowId={(row) => row.id as string} loading />
);

export const Empty = () => (
  <DataTable
    columns={BASE_COLUMNS}
    rows={[]}
    getRowId={(row) => row.id as string}
    emptyMessage="No team members yet."
  />
);

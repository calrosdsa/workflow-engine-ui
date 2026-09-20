// Workbench story for the dashboard parameters panel.
//
// The states worth looking at are the ones an author actually passes
// through and that no unit test renders: nothing declared yet, a parameter
// bound to a real tile, and the two half-built states the panel has to say
// something useful about — a parameter bound to nothing, and a dashboard
// with no tile that can be bound at all.
import { useEffect } from "react";
import type { StoryDefault } from "@ladle/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { formsApi } from "@/features/forms/api";
import type { FormDefinition } from "@/features/forms/types";
import "./widgets";
import { ParametersSection } from "./ParametersSection";
import { useDashboardStore } from "./store";
import type { DashboardParameter, DashboardSchema, ParameterBinding, WidgetInstance } from "./schema";
import { DEFAULT_DASHBOARD_SETTINGS } from "./schema";

export default {
  title: "Dashboard/Parameters panel",
} satisfies StoryDefault;

const FORM = {
  id: "invoices",
  name: "Sales Invoice",
  slug: "invoices",
  fields: [
    { name: "region", label: "Region", type: "enum" },
    { name: "grand_total", label: "Grand Total", type: "decimal" },
    { name: "due_date", label: "Due Date", type: "date" },
  ],
} as unknown as FormDefinition;

// The binding editor resolves each tile's fields through the WIDGET's own
// form — stubbed here the same way the chart stories stub the aggregate.
formsApi.get = async () => FORM;

const tile = (id: string, type: string, title: string, config: unknown): WidgetInstance =>
  ({ id, type, title, chrome: "card", layout: { x: 0, y: 0, w: 6, h: 6 }, config });

const CHART = tile("w1", "chart", "Revenue by month", { formId: "invoices", chartType: "bar", series: [] });
const TABLE = tile("w2", "table", "Open invoices", { formId: "invoices" });
const HEADING = tile("w3", "heading", "Overview", { text: "Overview" });

function Panel({ title, note, widgets, parameters, bindings }: {
  title: string;
  note: string;
  widgets: WidgetInstance[];
  parameters?: DashboardParameter[];
  bindings?: ParameterBinding[];
}) {
  // Loaded through the store because the panel reads and mutates it — a
  // story that passed props instead would not exercise the real wiring.
  useEffect(() => {
    const schema: DashboardSchema = {
      version: 1,
      settings: { ...DEFAULT_DASHBOARD_SETTINGS },
      widgets,
      parameters,
      parameterBindings: bindings,
    };
    useDashboardStore.getState().loadSchema(schema);
  }, [widgets, parameters, bindings]);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 256 }}>
      <strong style={{ fontSize: 13 }}>{title}</strong>
      <span style={{ fontSize: 11, opacity: 0.7 }}>{note}</span>
      <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 6, background: "hsl(var(--card))" }}>
        <QueryClientProvider client={client}>
          <ParametersSection />
        </QueryClientProvider>
      </div>
    </div>
  );
}

// One store instance is shared, so the panels are rendered one story at a
// time rather than side by side — the last mount would otherwise win.
export const Empty = () => (
  <I18nProvider>
    <div style={{ padding: 16 }}>
      <Panel
        title="Nothing declared"
        note="The starting state. Says what a parameter is FOR, not just that there are none."
        widgets={[CHART, TABLE]}
      />
    </div>
  </I18nProvider>
);

export const Bound = () => (
  <I18nProvider>
    <div style={{ padding: 16 }}>
      <Panel
        title="Bound to two tiles"
        note="One control, two tiles, a different field on each. Expand the row to see the bindings editor."
        widgets={[CHART, TABLE]}
        parameters={[{ key: "region", label: "Region", type: "text" }]}
        bindings={[
          { parameterKey: "region", widgetId: "w1", field: "region" },
          { parameterKey: "region", widgetId: "w2", field: "region", op: "eq" },
        ]}
      />
    </div>
  </I18nProvider>
);

export const HalfBuilt = () => (
  <I18nProvider>
    <div style={{ padding: 16 }}>
      <Panel
        title="Declared but bound to nothing"
        note="A control that would render and narrow nothing. The panel says so rather than leaving it to be found at runtime."
        widgets={[CHART, TABLE]}
        parameters={[{ key: "region", label: "Region", type: "text" }]}
      />
    </div>
  </I18nProvider>
);

export const NoTargets = () => (
  <I18nProvider>
    <div style={{ padding: 16 }}>
      <Panel
        title="No bindable tile"
        note="A heading is not bindable, and a chart with no form chosen is not yet. Both are absent from the picker, and the panel explains why."
        widgets={[HEADING, tile("w4", "chart", "Unconfigured", { formId: "" })]}
        parameters={[{ key: "region", label: "Region", type: "text" }]}
      />
    </div>
  </I18nProvider>
);

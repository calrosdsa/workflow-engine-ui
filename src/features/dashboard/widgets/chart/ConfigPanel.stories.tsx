// Workbench story for the chart config panel.
//
// The panel gained a lot at once — a chart-type grid that went from 5 items
// in 5 columns to 7 in 4, two checkboxes, a four-input axis grid, two
// conditional hints and a per-series mark picker — and none of it is
// covered by a test. tsc proves it compiles, not that the grid does not end
// in a ragged row or that a hint lands under the control it explains.
//
// Every panel below renders with NO form loaded, which is the state that
// needs looking at least: the controls gated on `form` stay out, and what
// is left has to still read as a coherent panel rather than a list of
// orphaned checkboxes.
import { useState } from "react";
import type { StoryDefault } from "@ladle/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { ChartConfigPanel } from "./ConfigPanel";
import { createDefaultChartConfig, type ChartWidgetConfig } from "./schema";

export default {
  title: "Dashboard/Chart config panel",
} satisfies StoryDefault;

function Panel({ title, note, initial }: {
  title: string;
  note: string;
  initial: Partial<ChartWidgetConfig>;
}) {
  const [config, setConfig] = useState<ChartWidgetConfig>({ ...createDefaultChartConfig(), ...initial });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <strong style={{ fontSize: 13 }}>{title}</strong>
      <span style={{ fontSize: 11, opacity: 0.7 }}>{note}</span>
      <div style={{ width: 320, border: "1px solid hsl(var(--border))", borderRadius: 6, padding: 12 }}>
        <QueryClientProvider client={client}>
          <ChartConfigPanel config={config} onChange={setConfig} clientId="c1" appId="a1" />
        </QueryClientProvider>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, padding: 16, alignItems: "flex-start" }}>
        {children}
      </div>
    </I18nProvider>
  );
}

export const ChartTypes = () => (
  <Row>
    <Panel
      title="Bar"
      note="Seven types in a four-column grid — the last row is deliberately short rather than the grid being stretched to fit."
      initial={{ chartType: "bar" }}
    />
    <Panel
      title="Combo"
      note="Adds the per-series mark picker; stacking and orientation both apply."
      initial={{ chartType: "combo", series: [{ fn: "count", type: "bar" }, { fn: "sum", field: "amount", type: "line" }] }}
    />
    <Panel
      title="Donut"
      note="No stacking, no orientation, no axis block, no legend toggle — a donut has none of them."
      initial={{ chartType: "donut" }}
    />
    <Panel
      title="Stat"
      note="The narrowest panel: no dimension, no sort, no limit, no axis."
      initial={{ chartType: "stat" }}
    />
  </Row>
);

export const ShapeAndAxis = () => (
  <Row>
    <Panel
      title="Stacked horizontal"
      note="Both shape knobs on. Grouped is simply the stacked box unchecked."
      initial={{ chartType: "bar", stacked: true, orientation: "horizontal" }}
    />
    <Panel
      title="Axis filled in"
      note="Titles and bounds in a 2x2 grid, with data labels below."
      initial={{ chartType: "bar", axis: { xTitle: "Month", yTitle: "Amount", yMin: 0, yMax: 12000 }, dataLabels: true }}
    />
    <Panel
      title="Log axis hint"
      note="The fallback warning appears only once the box is ticked, under the box it explains."
      initial={{ chartType: "line", axis: { yLog: true } }}
    />
  </Row>
);

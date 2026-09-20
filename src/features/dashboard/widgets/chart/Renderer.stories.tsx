// Workbench story for the chart widget's shape vocabulary.
//
// These variants are the one part of the widget that unit tests cannot
// actually check: plot.test.ts proves the ROWS and SERIES are right, but
// whether a stack stacks, whether a horizontal bar swaps its axes, and
// whether a log axis silently fell back to linear are all facts about the
// rendered recharts tree — and jsdom gives ResponsiveContainer a zero-sized
// box, so nothing draws there at all. This page is where they get looked at.
//
// The aggregate call is stubbed rather than the component being reduced to
// a presentational shell: the widget owns its own fetching (useChartData),
// and a story that bypassed that would stop exercising the thing it claims
// to document.
import { useEffect, useState } from "react";
import type { StoryDefault } from "@ladle/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { formsApi, type AggregateRecordsResponse } from "@/features/forms/api";
import { runtimeRouter } from "@/runtime-router";
import { ChartRenderer } from "./Renderer";
import type { Menu } from "@/features/menus/types";
import type { ChartWidgetConfig } from "./schema";
import type { NumberFormat } from "@/features/forms/types";

export default {
  title: "Dashboard/Chart shapes",
} satisfies StoryDefault;

const MONEY: NumberFormat = { style: "currency", currency_symbol: "Bs ", decimals: 0 };

// One measure across four months, split three ways — the shape every
// stacked/grouped variant below reads.
const SPLIT: AggregateRecordsResponse = {
  groups: [
    { key: "Jan", key2: "North", values: [4200] },
    { key: "Jan", key2: "South", values: [2600] },
    { key: "Jan", key2: "East", values: [1400] },
    { key: "Feb", key2: "North", values: [5100] },
    { key: "Feb", key2: "South", values: [3050] },
    { key: "Mar", key2: "North", values: [3900] },
    { key: "Mar", key2: "South", values: [4400] },
    { key: "Mar", key2: "East", values: [2200] },
    { key: "Apr", key2: "North", values: [6300] },
    { key: "Apr", key2: "East", values: [1850] },
  ],
  columns: [
    { role: "group", field: "month", label: "Month" },
    { role: "group2", field: "region", label: "Region" },
    { role: "measure", field: "amount", label: "Amount", fn: "sum", number_format: MONEY },
  ],
};

// Two measures, no split — the shape a combo chart needs, where the two
// disagree by orders of magnitude.
const TWO_MEASURES: AggregateRecordsResponse = {
  groups: [
    { key: "Jan", values: [8200, 41] },
    { key: "Feb", values: [8150, 38] },
    { key: "Mar", values: [10500, 52] },
    { key: "Apr", values: [8150, 60] },
  ],
  columns: [
    { role: "group", field: "month", label: "Month" },
    { role: "measure", field: "amount", label: "Amount", fn: "sum", number_format: MONEY },
    { role: "measure", label: "Invoices", fn: "count" },
  ],
};

// Spans three orders of magnitude, all strictly positive — the only case in
// which a log axis is honoured.
const WIDE_RANGE: AggregateRecordsResponse = {
  groups: [
    { key: "Retail", values: [12] },
    { key: "Wholesale", values: [340] },
    { key: "Export", values: [9800] },
  ],
  columns: [
    { role: "group", field: "channel", label: "Channel" },
    { role: "measure", field: "amount", label: "Amount", fn: "sum" },
  ],
};

// Same spread with a zero in it, which is what a log axis cannot draw.
const HAS_ZERO: AggregateRecordsResponse = {
  groups: [
    { key: "Retail", values: [12] },
    { key: "Wholesale", values: [340] },
    { key: "Cancelled", values: [0] },
  ],
  columns: [
    { role: "group", field: "channel", label: "Channel" },
    { role: "measure", field: "amount", label: "Amount", fn: "sum" },
  ],
};

// Flat, single-measure — for the variants that are about SHAPE and would
// only be confused by a second dimension.
const FLAT: AggregateRecordsResponse = {
  groups: [
    { key: "Jan", values: [8200] },
    { key: "Feb", values: [8150] },
    { key: "Mar", values: [10500] },
    { key: "Apr", values: [9400] },
  ],
  columns: [
    { role: "group", field: "month", label: "Month" },
    { role: "measure", field: "amount", label: "Amount", fn: "sum", number_format: MONEY },
  ],
};

// Keyed by formId rather than held in one "current response" variable: every
// tile on a page mounts before any query resolves, so a single variable
// would serve whichever tile rendered LAST to all of them — which is exactly
// what the first draft of this file did.
const RESPONSES: Record<string, AggregateRecordsResponse> = {};
formsApi.aggregateRecords = async (formId: string) => RESPONSES[formId] ?? { groups: [] };

// Drill-down navigates through the real runtime router, which has no route
// tree on this page — so it is stubbed here, at module scope, exactly as
// the aggregate call above is. The captured destination is then rendered
// under the DrillDown story, which makes "what would this click do" a thing
// you can read rather than something to reason about.
interface CapturedNav { to: string; filter: unknown }
const navListeners = new Set<(n: CapturedNav) => void>();
runtimeRouter.navigate = ((args: { to: string; search?: Record<string, string> }) => {
  const raw = args.search?.ef;
  const nav: CapturedNav = { to: args.to, filter: raw ? JSON.parse(raw) : undefined };
  navListeners.forEach((fn) => fn(nav));
  return Promise.resolve();
}) as typeof runtimeRouter.navigate;

function LastNavigation() {
  const [nav, setNav] = useState<CapturedNav | undefined>(undefined);
  useEffect(() => {
    navListeners.add(setNav);
    return () => { navListeners.delete(setNav); };
  }, []);
  if (!nav) return <p style={{ fontSize: 11, opacity: 0.6, padding: "0 16px" }}>Click a mark — the filter it produces appears here.</p>;
  return (
    <pre style={{ fontSize: 11, padding: 12, margin: "0 16px", border: "1px solid hsl(var(--border))", borderRadius: 6, overflowX: "auto" }}>
      {`${nav.to}\n${JSON.stringify(nav.filter, null, 2)}`}
    </pre>
  );
}

const base: ChartWidgetConfig = {
  formId: "invoices",
  chartType: "bar",
  groupBy: { field: "month" },
  series: [{ fn: "sum", field: "amount" }],
  sortBy: "group",
  sortDir: "asc",
  limit: 50,
  legend: true,
};

// Drill-down only arms when the viewer can see a Search menu for the
// chart's form, so a story that wants to exercise a click has to supply one.
const recordsMenu = (formId: string): Menu => ({
  id: `m_${formId}`,
  slug: `records-${formId}`,
  name: "Records",
  menu_type: "search",
  config: { form_id: formId },
} as unknown as Menu);

function Tile({ title, note, response, config, clickable }: {
  title: string;
  note: string;
  response: AggregateRecordsResponse;
  config: Partial<ChartWidgetConfig>;
  /** Renders at runtime with a matching Search menu, so marks are live. */
  clickable?: boolean;
}) {
  // Registering under this tile's own id is idempotent and order-independent,
  // so it is safe during render in a way `active = response` was not.
  const formId = title.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  RESPONSES[formId] = response;
  const full: ChartWidgetConfig = { ...base, ...config, formId };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <strong style={{ fontSize: 13 }}>{title}</strong>
      <span style={{ fontSize: 11, opacity: 0.7 }}>{note}</span>
      <div style={{ height: 260, border: "1px solid hsl(var(--border))", borderRadius: 6, padding: 8 }}>
        <QueryClientProvider client={client}>
          <ChartRenderer
            config={full}
            instance={{ id: title, type: "chart", layout: { x: 0, y: 0, w: 6, h: 6 }, chrome: "card", config: full }}
            clientId="c1"
            appId="a1"
            menus={clickable ? [recordsMenu(formId)] : []}
            mode={clickable ? "runtime" : "builder"}
          />
        </QueryClientProvider>
      </div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 24, padding: 16 }}>
        {children}
      </div>
    </I18nProvider>
  );
}

export const SecondDimension = () => (
  <Grid>
    <Tile
      title="Grouped"
      note="groupBy2 with stacked unset — bars sit side by side, one per region."
      response={SPLIT}
      config={{ groupBy2: { field: "region" } }}
    />
    <Tile
      title="Stacked"
      note="The same config plus stacked. Apr has no South row; count/sum fill it as 0."
      response={SPLIT}
      config={{ groupBy2: { field: "region" }, stacked: true }}
    />
    <Tile
      title="Stacked area"
      note="stacked applies to areas too — the shape for a composition over time."
      response={SPLIT}
      config={{ chartType: "area", groupBy2: { field: "region" }, stacked: true }}
    />
    <Tile
      title="Extra series, split"
      note="Two measures with a split: one is drawn, and the tile says the other is not."
      response={SPLIT}
      config={{ groupBy2: { field: "region" }, series: [{ fn: "sum", field: "amount" }, { fn: "count" }] }}
    />
  </Grid>
);

export const Orientation = () => (
  <Grid>
    <Tile
      title="Horizontal"
      note="Categories down the side. Recharts calls this layout='vertical'; the config does not."
      response={FLAT}
      config={{ orientation: "horizontal" }}
    />
    <Tile
      title="Horizontal + stacked"
      note="Caps square off when stacked — a rounded edge mid-stack reads as a break."
      response={SPLIT}
      config={{ orientation: "horizontal", groupBy2: { field: "region" }, stacked: true }}
    />
  </Grid>
);

export const PieAndDonut = () => (
  <Grid>
    <Tile title="Pie" note="Labels show the category, as they always have." response={WIDE_RANGE} config={{ chartType: "pie" }} />
    <Tile title="Donut" note="Identical but for the cut-out centre." response={WIDE_RANGE} config={{ chartType: "donut" }} />
    <Tile
      title="Donut + data labels"
      note="dataLabels upgrades the slice label to the formatted value rather than switching labels on."
      response={WIDE_RANGE}
      config={{ chartType: "donut", dataLabels: true }}
    />
  </Grid>
);

export const Combo = () => (
  <Grid>
    <Tile
      title="Bars plus a line"
      note="series[].type, read only for chartType combo. NOTE the shared value axis: an invoice count of ~50 against an amount axis reaching 12,000 flattens onto the floor. A combo is readable only while its measures share a scale — there is no secondary axis."
      response={TWO_MEASURES}
      config={{
        chartType: "combo",
        series: [{ fn: "sum", field: "amount", type: "bar" }, { fn: "count", label: "Invoices", type: "line" }],
      }}
    />
    <Tile
      title="Same series, plain bar chart"
      note="The declared 'line' is inert outside combo — it does not quietly change the chart."
      response={TWO_MEASURES}
      config={{
        chartType: "bar",
        series: [{ fn: "sum", field: "amount", type: "bar" }, { fn: "count", label: "Invoices", type: "line" }],
      }}
    />
  </Grid>
);

export const AxisAndLabels = () => (
  <Grid>
    <Tile
      title="Titles and a zero floor"
      note="yMin 0 stops the axis starting near the data and exaggerating small gaps."
      response={FLAT}
      config={{ axis: { xTitle: "Month", yTitle: "Amount", yMin: 0 } }}
    />
    <Tile
      title="Data labels"
      note="Values printed on the marks, using the measure's own number format."
      response={FLAT}
      config={{ dataLabels: true }}
    />
    <Tile
      title="Log axis, honoured"
      note="12 / 340 / 9800 — all positive, so the log scale applies and the small bar stays visible."
      response={WIDE_RANGE}
      config={{ axis: { yLog: true } }}
    />
    <Tile
      title="Log axis, refused"
      note="The same request with a zero present. A log domain touching zero draws nothing, so this falls back to linear."
      response={HAS_ZERO}
      config={{ axis: { yLog: true } }}
    />
  </Grid>
);

// Clicking a mark navigates to the records behind THAT point. The marks are
// only live here because `clickable` supplies a Search menu for the form —
// without one the chart is inert, which is the state a viewer with no
// records menu sees.
export const DrillDown = () => (
  <>
  <I18nProvider><LastNavigation /></I18nProvider>
  <Grid>
    <Tile
      title="Plain categories"
      note="Each bar drills to its own key. Exactly invertible: the key IS the field's value."
      response={FLAT}
      config={{}}
      clickable
    />
    <Tile
      title="Split segments"
      note="A stacked segment drills to BOTH its category and its split value — the series carries the split, the row carries the category."
      response={SPLIT}
      config={{ groupBy2: { field: "region" }, stacked: true }}
      clickable
    />
    <Tile
      title="Line, click the dot"
      note="On a line the mark is the dot; the stroke between two dots belongs to no single group."
      response={FLAT}
      config={{ chartType: "line" }}
      clickable
    />
    <Tile
      title="Pie slice"
      note="Recharts nests a sector's data one level deeper than a bar's, so this needs its own look rather than an argument that it must work."
      response={WIDE_RANGE}
      config={{ chartType: "pie", groupBy: { field: "channel" } }}
      clickable
    />
    <Tile
      title="No records menu"
      note="The same chart where the viewer can see no Search menu for this form: no pointer cursor, clicks do nothing."
      response={FLAT}
      config={{}}
    />
  </Grid>
  </>
);

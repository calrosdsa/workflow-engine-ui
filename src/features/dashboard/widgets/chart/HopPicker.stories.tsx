// Workbench story for the reference-hop pickers.
//
// The engine accepts a dotted "customer.region" as a dimension or a measure
// (roadmap row 14). What no test can check is whether an author can FIND
// one: the options come from a second form fetched per reference field, and
// they have to read as "from another form" rather than as more fields on
// this one.
import { useState } from "react";
import type { StoryDefault } from "@ladle/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { formsApi } from "@/features/forms/api";
import type { FormDefinition } from "@/features/forms/types";
import "../../widgets";
import { ChartConfigPanel } from "./ConfigPanel";
import { createDefaultChartConfig, type ChartWidgetConfig } from "./schema";

export default { title: "Dashboard/Reference hops" } satisfies StoryDefault;

const ORDERS = {
  id: "orders", name: "Order", slug: "orders",
  fields: [
    { name: "customer", label: "Customer", type: "reference", reference_table: "customers" },
    { name: "status", label: "Status", type: "enum" },
    { name: "total", label: "Total", type: "decimal" },
  ],
} as unknown as FormDefinition;

const CUSTOMERS = {
  id: "customers", name: "Customer", slug: "customers",
  fields: [
    { name: "region", label: "Region", type: "enum" },
    { name: "credit_limit", label: "Credit Limit", type: "decimal" },
    // A far reference is the second hop of a chain the engine refuses, so
    // it must NOT appear in the pickers.
    { name: "owner", label: "Owner", type: "reference", reference_table: "users" },
  ],
} as unknown as FormDefinition;

formsApi.get = async (id: string) => (id === "customers" ? CUSTOMERS : ORDERS);
formsApi.list = async () => [ORDERS, CUSTOMERS] as FormDefinition[];

function Panel({ initial }: { initial: Partial<ChartWidgetConfig> }) {
  const [config, setConfig] = useState<ChartWidgetConfig>({
    ...createDefaultChartConfig(), formId: "orders", ...initial,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <div style={{ width: 320, border: "1px solid hsl(var(--border))", borderRadius: 6, padding: 12 }}>
      <QueryClientProvider client={client}>
        <ChartConfigPanel config={config} onChange={setConfig} clientId="c1" appId="a1" />
      </QueryClientProvider>
    </div>
  );
}

export const Pickers = () => (
  <I18nProvider>
    <div style={{ display: "flex", gap: 24, padding: 16, alignItems: "flex-start" }}>
      <div>
        <strong style={{ fontSize: 13 }}>Group by, unhopped</strong>
        <p style={{ fontSize: 11, opacity: 0.7, maxWidth: 320 }}>
          Open Group by: this form&apos;s fields first, then a “Through a reference” heading with Customer / Region
          and Customer / Credit Limit. Customer / Owner is absent — a far reference would be a chain the engine refuses.
        </p>
        <Panel initial={{ groupBy: { field: "status" } }} />
      </div>
      <div>
        <strong style={{ fontSize: 13 }}>Grouped by a hop</strong>
        <p style={{ fontSize: 11, opacity: 0.7, maxWidth: 320 }}>
          The bucket and band controls stay hidden: a hopped dimension cannot be bucketed, and the engine
          refuses it rather than ignoring it.
        </p>
        <Panel initial={{ groupBy: { field: "customer.region" } }} />
      </div>
      <div>
        <strong style={{ fontSize: 13 }}>Hopped measure</strong>
        <p style={{ fontSize: 11, opacity: 0.7, maxWidth: 320 }}>
          Open the series field: only Customer / Credit Limit is offered under the heading, because a sum
          needs a numeric far field. Switch the measure to Distinct and Customer / Region joins it.
        </p>
        <Panel initial={{ groupBy: { field: "status" }, series: [{ fn: "sum", field: "customer.credit_limit" }] }} />
      </div>
    </div>
  </I18nProvider>
);

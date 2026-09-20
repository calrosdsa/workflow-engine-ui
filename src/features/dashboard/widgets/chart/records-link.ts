// "Show me the records behind this" — shared by the chart's "..." menu
// (the whole chart) and by a click on a data point (one group), so the two
// cannot disagree about which menu they target or how the filter travels.
import { runtimeRouter } from '@/runtime-router'
import { mergeFilters } from './runtime-filter'
import type { ChartWidgetConfig } from './schema'
import type { FilterCondition, FilterGroup } from '@/features/workflows/types'
import type { Menu, SearchMenuConfig } from '@/features/menus/types'

/** The Search menu this chart's records live on, or undefined when the
 *  viewer has none.
 *
 *  Only ever a Search menu whose own form_id matches the chart's source
 *  form, and only from the viewer-visible `menus` snapshot already handed
 *  to every widget — the same visibility guarantee the quick-links widget
 *  relies on: "not in `menus`" already means "this viewer cannot see it". */
export function findRecordsMenu(config: ChartWidgetConfig, menus: Menu[] | undefined): Menu | undefined {
  return menus?.find((m) => m.menu_type === 'search' && (m.config as SearchMenuConfig).form_id === config.formId)
}

/** Navigates to that menu carrying `effectiveFilter`, optionally narrowed
 *  further by the conditions selecting one clicked data point.
 *
 *  The extra conditions are ANDed on as their own nested group rather than
 *  appended to the top level: the effective filter may be an `or`, and
 *  flattening a point's conditions into it would widen the result instead
 *  of narrowing it. mergeFilters already composes exactly this way, which
 *  is why it is reused rather than re-derived. */
export function navigateToRecords(
  menu: Menu,
  clientId: string,
  appId: string,
  effectiveFilter: FilterGroup | undefined,
  extraConditions?: FilterCondition[],
): void {
  const pointFilter: FilterGroup | undefined = extraConditions?.length
    ? { combinator: 'and', conditions: extraConditions, groups: [] }
    : undefined
  const filter = mergeFilters(effectiveFilter, pointFilter)

  // `to` is a dynamic template string, so TanStack Router cannot resolve
  // which registered route it targets at the type level — the same
  // situation RuntimeLink.tsx's own comment documents. Assigning `search`
  // to a widely-typed variable first (rather than passing a fresh object
  // literal inline) sidesteps excess-property-checking against whatever
  // unrelated route's search shape the navigate() overload resolves to.
  //
  // Still JSON: `ef` is READ BACK by parseExternalFilterParam
  // (runtime-router.tsx), and a text form would need the parser that
  // docs/analytics-and-charting-mcp-rnd.md §4.6 holds as step 2. The
  // serializer in features/workflows/filter-text.ts is one-way by design
  // and deliberately does not go here.
  const search: Record<string, string> = filter ? { ef: JSON.stringify(filter) } : {}
  runtimeRouter.navigate({ to: `/${clientId}/${appId}/${menu.slug}`, search })
}

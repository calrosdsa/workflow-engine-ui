// Converts a Custom Page's PageSchema into a DashboardSchema built entirely
// from Content-category widgets — the mechanism that makes "custom pages"
// and "dashboards" one feature rather than two (see docs/dashboard-system-plan.md
// section 5.1). Each PageComponent maps 1:1 to a widget instance of the same
// type — content widgets were deliberately designed with config shapes that
// mirror PageComponent's own fields (see widgets/heading/schema.ts etc.), so
// this is a field remap, not a re-implementation.
//
// Layout mapping: each PageSection becomes one horizontal band of the grid
// (a shared y-range across all its columns), and each PageColumn's flex
// ratio becomes a proportional column-span out of DEFAULT_DASHBOARD_SETTINGS.cols
// (12). Heights are estimated per component type and summed per column, then
// the whole section's height is the tallest column in it — components can
// end up looking short/tall relative to their old flex-rendered page and the
// user is expected to fine-tune afterward (documented in the plan as an
// accepted approximation, not a bug).
import { nanoid } from 'nanoid'
import type { PageSchema, PageComponent, PageColumn } from '@/features/page-builder/schema'
import type { DashboardSchema, WidgetInstance } from './schema'
import { emptyDashboardSchema } from './schema'

const GRID_COLS = 12

// Rough per-type row-height estimate (grid rows, at the default rowHeight
// of 40px — see DEFAULT_DASHBOARD_SETTINGS) for components that have no
// natural "how tall am I" signal the way a table/chart query result would.
// Deliberately generous rather than tight — an oversized tile the user
// shrinks is a much better first impression than clipped text.
const HEIGHT_ESTIMATE: Record<PageComponent['component'], number> = {
  heading: 2,
  paragraph: 3,
  image: 5,
  divider: 1,
  spacer: 1,
  button: 2,
}

function configFor(c: PageComponent): unknown {
  switch (c.component) {
    case 'heading':   return { text: c.text ?? 'Heading', level: c.level ?? 2 }
    case 'paragraph': return { text: c.text ?? '' }
    case 'image':     return { src: c.src ?? '', alt: c.alt ?? '', width: c.width ?? 'full' }
    case 'spacer':     return { height: c.height ?? 24 }
    case 'button':
      return {
        label: c.label ?? 'Button',
        linkType: c.linkType ?? 'external',
        menuSlug: c.menuSlug,
        url: c.url,
        variant: c.variant ?? 'primary',
      }
    case 'divider':
    default:
      return {}
  }
}

function columnSpans(columns: PageColumn[]): number[] {
  const total = columns.reduce((sum, col) => sum + col.ratio, 0) || 1
  // Largest-remainder rounding so spans always sum to exactly GRID_COLS,
  // even when ratios don't divide evenly (e.g. a 3-column 1:1:1 layout would
  // naively round to 4/4/4 = 12 fine, but a 7:3 split needs care: 8.4/3.6 ->
  // round would give 8/4 = 12 by luck; this guards the general case).
  const raw = columns.map((col) => (col.ratio / total) * GRID_COLS)
  const floors = raw.map(Math.floor)
  let remainder = GRID_COLS - floors.reduce((a, b) => a + b, 0)
  const withRemainders = raw.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac)
  const spans = [...floors]
  for (let k = 0; k < remainder; k++) spans[withRemainders[k].i] += 1
  return spans.map((s) => Math.max(1, s))
}

export function pageSchemaToDashboard(schema: PageSchema): DashboardSchema {
  const dashboard = emptyDashboardSchema()
  let y = 0

  for (const section of schema.sections) {
    const spans = columnSpans(section.columns)
    let x = 0
    let sectionHeight = 1

    section.columns.forEach((col, colIndex) => {
      const span = spans[colIndex]
      let colY = y
      for (const component of col.components) {
        const h = HEIGHT_ESTIMATE[component.component] ?? 3
        const instance: WidgetInstance = {
          id: nanoid(),
          // PageComponentType and the content widgets' registered `type`
          // strings are identical by construction (heading/paragraph/image/
          // divider/spacer/button — see widgets/*/index.ts's `type:` fields),
          // so no separate mapping table is needed here.
          type: component.component,
          layout: { x, y: colY, w: span, h, minW: 1, minH: 1 },
          chrome: 'plain',
          config: configFor(component),
        }
        dashboard.widgets.push(instance)
        colY += h
      }
      sectionHeight = Math.max(sectionHeight, colY - y)
      x += span
    })

    y += sectionHeight
  }

  return dashboard
}

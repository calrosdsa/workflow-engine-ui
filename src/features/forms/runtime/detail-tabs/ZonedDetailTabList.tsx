// Layout-aware wrapper around DetailTabList (Detail Page Builder) — groups
// tabConfigs by zone per the form's chosen DETAIL_PAGE_LAYOUTS template and
// renders one independent DetailTabList instance per zone. DetailTabList
// itself stays completely unchanged in behavior: it already owns real,
// non-trivial per-list machinery (visibility, debounced renderIf
// expressions, hideWhenEmpty tracking) that must not be duplicated or
// rewritten — this component only decides HOW MANY DetailTabLists to render
// and where, not how any one of them behaves.
//
// Every template defines the same three zones (schema.ts): 'main' and the
// narrow 'sidebar' share the top row, and the full-width 'activity' zone
// takes its own row underneath.
import { cn } from '@/lib/utils'
import { DetailTabList, type DetailTabListProps } from './DetailTabList'
import { DETAIL_PAGE_LAYOUTS, DEFAULT_DETAIL_PAGE_ZONE, type DetailPageLayoutId } from '@/features/form-builder/schema'

export interface ZonedDetailTabListProps extends DetailTabListProps {
  layout?: DetailPageLayoutId
}

export function ZonedDetailTabList({ layout = 'single', tabConfigs, ...rest }: ZonedDetailTabListProps) {
  const zones = DETAIL_PAGE_LAYOUTS[layout]?.zones ?? DETAIL_PAGE_LAYOUTS.single.zones
  const zoneIds = new Set(zones.map((z) => z.id))

  // Resolves a tab's effective zone: its own `zone` if the active template
  // still defines that id, else DEFAULT_DETAIL_PAGE_ZONE ('main', a fixed
  // id — never "whichever zone happens to be listed first," see that
  // constant's own doc comment for why main-left-sidebar makes that
  // distinction matter). Covers both an unset zone (every pre-existing
  // tab) AND a genuinely stale one (left over after switching away from a
  // template that no longer defines the zone a tab was tagged with) —
  // either way the tab must still render somewhere, not silently vanish.
  const effectiveZone = (t: (typeof tabConfigs)[number]) =>
    t.zone && zoneIds.has(t.zone) ? t.zone : DEFAULT_DETAIL_PAGE_ZONE

  // A zone with zero tabs renders nothing (not an empty box), so a form
  // whose sidebar or activity zone is entirely hidden degrades to exactly
  // the single-column output it had before those zones existed.
  const zoneTabs = zones.map((zone) => ({
    zone,
    tabs: tabConfigs.filter((t) => effectiveZone(t) === zone.id),
  })).filter((z) => z.tabs.length > 0)

  const rowZones = zoneTabs.filter((z) => z.zone.width !== 'full')
  const bottomZones = zoneTabs.filter((z) => z.zone.width === 'full')

  if (zoneTabs.length <= 1) {
    // Exactly the pre-feature shape: one DetailTabList, no extra wrapper
    // markup, no border/width styling a single-column form has no use for.
    return <DetailTabList tabConfigs={tabConfigs} {...rest} />
  }

  // @container (not a `md:` viewport breakpoint) because this same panel
  // renders inside RecordsTable's ~672px drawer as well as a full page: at
  // viewport width a `md:flex-row` would put a 320px sidebar beside ~350px
  // of content in that drawer. Sizing off the CONTAINER instead lets the
  // drawer stack the same way a phone does, with no host-specific prop.
  return (
    <div className={cn('@container flex flex-col', rest.nested ? '' : 'min-h-0 flex-1')}>
      <div className="flex min-h-0 flex-1 flex-col @3xl:flex-row">
        {rowZones.map(({ zone, tabs }, idx) => (
          <div
            key={zone.id}
            className={cn(
              'flex min-h-0 flex-col',
              zone.width === 'flex'
                ? 'order-first flex-1 min-w-0 @3xl:order-none'
                : 'w-full shrink-0 @3xl:w-80',
              idx > 0 && '@3xl:border-l',
            )}
            style={idx > 0 ? { borderColor: 'hsl(var(--border))' } : undefined}
          >
            <DetailTabList tabConfigs={tabs} {...rest} variant={zone.width === 'narrow' ? 'stacked' : 'tabs'} />
          </div>
        ))}
      </div>
      {/* Bounded, with the DetailTabList's own overflow-y-auto body doing the
         scrolling inside it — an unbounded activity strip would let a long
         comment thread push the record's own fields off the page. */}
      {bottomZones.map(({ zone, tabs }) => (
        <div
          key={zone.id}
          className="flex min-h-0 max-h-[45%] shrink-0 flex-col border-t"
          style={{ borderColor: 'hsl(var(--border))' }}
        >
          <DetailTabList tabConfigs={tabs} {...rest} />
        </div>
      ))}
    </div>
  )
}

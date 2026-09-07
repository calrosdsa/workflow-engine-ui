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
  /** 'drawer' when this renders inside a Drawer overlay (RecordsTable's
   *  quick-view, LineItemsGrid's child-row editor) rather than a full page
   *  — the narrow sidebar zone (Attachments/Tags) is dropped ENTIRELY
   *  rather than squeezed to fit, since a capped-width drawer has no good
   *  place to put it. Defaults to 'page', which renders every zone.
   *  Independent of the @container sizing below: that handles a genuine
   *  full page on a narrow viewport (phone width), a real host that still
   *  wants the sidebar, just stacked — this handles a drawer, which never
   *  wants it regardless of width. */
  pageContext?: 'page' | 'drawer'
}

export function ZonedDetailTabList({ layout = 'single', tabConfigs, pageContext = 'page', ...rest }: ZonedDetailTabListProps) {
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

  // In a drawer, a narrow-zone tab is dropped outright, not relocated to
  // 'main' the way a stale/unrecognized zone id is — falling back to main
  // would just move Attachments/Tags into the tab bar instead of hiding
  // them, which isn't what "no room for the sidebar here" means.
  const visibleTabConfigs = pageContext === 'drawer'
    ? tabConfigs.filter((t) => zones.find((z) => z.id === effectiveZone(t))?.width !== 'narrow')
    : tabConfigs

  // A zone with zero tabs renders nothing (not an empty box), so a form
  // whose sidebar or activity zone is entirely hidden (or, in a drawer,
  // filtered out above) degrades to exactly the single-column output it
  // had before those zones existed.
  const zoneTabs = zones.map((zone) => ({
    zone,
    tabs: visibleTabConfigs.filter((t) => effectiveZone(t) === zone.id),
  })).filter((z) => z.tabs.length > 0)

  const rowZones = zoneTabs.filter((z) => z.zone.width !== 'full')
  const bottomZones = zoneTabs.filter((z) => z.zone.width === 'full')

  if (zoneTabs.length <= 1) {
    // Exactly the pre-feature shape: one DetailTabList, no extra wrapper
    // markup, no border/width styling a single-column form has no use for.
    return <DetailTabList tabConfigs={visibleTabConfigs} {...rest} />
  }

  // No height/scroll bounding at any level here — every zone (including the
  // activity strip) sizes to its own content and the whole thing flows as
  // ONE page. There is exactly one scroll region for the whole record
  // detail experience, owned by whichever host renders this: a full page's
  // own <main overflow-y-auto> (RuntimeRecordPage/RuntimeFormRecordPage), or
  // RecordDetailPanel's own wrapper when pageContext="drawer" (a Drawer
  // overlay IS a fixed-height box with no scroll container of its own).
  // Comments/Audit Log previously got their own capped-height, independently
  // -scrolling box pinned below the fold — a second scrollbar mid-page,
  // rather than part of the same page you'd already been scrolling.
  //
  // @container (not a `md:` viewport breakpoint) because this same panel
  // renders inside RecordsTable's ~672px drawer as well as a full page: at
  // viewport width a `md:flex-row` would put a 320px sidebar beside ~350px
  // of content in that drawer. Sizing off the CONTAINER instead lets the
  // drawer stack the same way a phone does, with no host-specific prop.
  return (
    <div className="@container flex flex-col">
      <div className="flex flex-col @3xl:flex-row">
        {rowZones.map(({ zone, tabs }, idx) => (
          <div
            key={zone.id}
            className={cn(
              'flex flex-col',
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
      {bottomZones.map(({ zone, tabs }) => (
        <div key={zone.id} className="flex flex-col border-t" style={{ borderColor: 'hsl(var(--border))' }}>
          <DetailTabList tabConfigs={tabs} {...rest} />
        </div>
      ))}
    </div>
  )
}

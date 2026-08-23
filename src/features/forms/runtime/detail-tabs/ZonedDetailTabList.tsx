// Layout-aware wrapper around DetailTabList (Detail Page Builder) — groups
// tabConfigs by zone per the form's chosen DETAIL_PAGE_LAYOUTS template and
// renders one independent DetailTabList instance per zone, side by side.
// DetailTabList itself stays completely unchanged: it already owns real,
// non-trivial per-list machinery (visibility, debounced renderIf
// expressions, hideWhenEmpty tracking) that must not be duplicated or
// rewritten — this component only decides HOW MANY DetailTabLists to render
// and where, not how any one of them behaves.
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

  // A zone with zero tabs renders nothing (not an empty box) — so 'single'
  // (one zone, always non-empty since every tab defaults into it) and a
  // sidebar template with an empty sidebar both degrade to visually
  // identical single-column output. This is what makes a pre-feature form
  // (no `zone` on any tab, no `detailLayout` set) render byte-for-byte the
  // same as before this component existed.
  const zoneTabs = zones.map((zone) => ({
    zone,
    tabs: tabConfigs.filter((t) => effectiveZone(t) === zone.id),
  })).filter((z) => z.tabs.length > 0)

  if (zoneTabs.length <= 1) {
    // Exactly the pre-feature shape: one DetailTabList, no extra wrapper
    // markup, no border/width styling that a single-column form has no use
    // for. zoneTabs could be empty (tabConfigs itself is empty) or have
    // exactly one non-empty zone — both cases want the plain, un-widthed
    // render DetailTabList already produces on its own.
    return <DetailTabList tabConfigs={tabConfigs} {...rest} />
  }

  return (
    // A sidebar zone template (main-left-sidebar / main-right-sidebar) puts
    // a fixed 320px (w-80) zone beside the flex-1 main zone with no wrap —
    // on a phone that sidebar alone is ~85% of the viewport before the main
    // zone gets anything. Below `md` this stacks every zone full-width
    // instead (content zone first regardless of the template's visual
    // left/right order, since that's the zone a user actually came here
    // for); at `md:` and up it's the original side-by-side layout.
    <div className={cn('flex flex-col md:flex-row', rest.nested ? '' : 'min-h-0 flex-1')}>
      {zoneTabs.map(({ zone, tabs }, idx) => (
        <div
          key={zone.id}
          className={cn(
            'flex min-h-0 flex-col',
            zone.width === 'flex'
              ? 'order-first flex-1 min-w-0 md:order-none'
              : 'w-full shrink-0 md:w-80',
            idx > 0 && 'md:border-l',
          )}
          style={idx > 0 ? { borderColor: 'hsl(var(--border))' } : undefined}
        >
          <DetailTabList tabConfigs={tabs} {...rest} />
        </div>
      ))}
    </div>
  )
}

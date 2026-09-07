// @vitest-environment jsdom
//
// Verifies ZonedDetailTabList's core migration guarantee: a form with no
// `detailLayout`/`zone` data (every form saved before the Detail Page
// Builder existed) must render EXACTLY what plain DetailTabList already
// rendered — same call, same tabConfigs, no extra wrapper. Mocks
// DetailTabList itself (a marker showing which tabConfigs it received) so
// this test exercises only ZonedDetailTabList's own grouping/branching
// logic, not DetailTabList's real visibility/renderIf/hideWhenEmpty
// machinery, which is out of scope here and already relied on unchanged.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ZonedDetailTabList } from './ZonedDetailTabList'
import type { DetailTabConfig } from '@/features/form-builder/schema'

afterEach(() => cleanup())

vi.mock('./DetailTabList', () => ({
  DetailTabList: ({ tabConfigs, variant }: { tabConfigs: DetailTabConfig[]; variant?: string }) => (
    <div data-testid="tab-list" data-ids={tabConfigs.map((t) => t.id).join(',')} data-variant={variant ?? 'tabs'} />
  ),
}))

const baseProps = { formId: 'f1', recordId: 'r1', fields: [] }

function tab(id: string, zone?: string): DetailTabConfig {
  return { id, type: 'details', config: {}, zone }
}

describe('ZonedDetailTabList', () => {
  it('renders exactly one DetailTabList, with no wrapper markup, when layout is omitted (pre-feature default)', () => {
    const tabConfigs = [tab('details'), tab('audit'), tab('linked')]
    const { container } = render(<ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} />)
    const lists = container.querySelectorAll('[data-testid="tab-list"]')
    expect(lists.length).toBe(1)
    expect(lists[0].getAttribute('data-ids')).toBe('details,audit,linked')
    // No zone-wrapper div — the single DetailTabList is the container's
    // only child, exactly as if ZonedDetailTabList didn't exist.
    expect(container.firstElementChild).toBe(lists[0])
  })

  it('renders exactly one DetailTabList for layout="single" too', () => {
    const tabConfigs = [tab('details'), tab('audit')]
    const { container } = render(<ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="single" />)
    expect(container.querySelectorAll('[data-testid="tab-list"]').length).toBe(1)
  })

  it('renders one DetailTabList for a sidebar layout whose sidebar has no tabs yet (empty zone stays invisible)', () => {
    const tabConfigs = [tab('details'), tab('audit')] // no zone set -> both default to 'main'
    const { container } = render(<ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-right-sidebar" />)
    const lists = container.querySelectorAll('[data-testid="tab-list"]')
    expect(lists.length).toBe(1)
    expect(lists[0].getAttribute('data-ids')).toBe('details,audit')
  })

  it('splits into two DetailTabLists, main first, when a sidebar layout has tabs in both zones', () => {
    const tabConfigs = [tab('details'), tab('status', 'sidebar'), tab('audit'), tab('owner', 'sidebar')]
    const { container } = render(<ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-right-sidebar" />)
    const lists = container.querySelectorAll('[data-testid="tab-list"]')
    expect(lists.length).toBe(2)
    expect(lists[0].getAttribute('data-ids')).toBe('details,audit')
    expect(lists[1].getAttribute('data-ids')).toBe('status,owner')
  })

  it('main-left-sidebar renders the sidebar zone first visually, but an UNSET zone still defaults to main (not "whichever zone is listed first")', () => {
    // This is the exact bug this suite exists to catch: main-left-sidebar
    // lists 'sidebar' before 'main' in its zones array for VISUAL order
    // only. An unset-zone tab (every pre-existing tab, before this feature
    // existed) must still land in 'main', or every existing form's tabs
    // would silently jump into the sidebar the moment it switched to this
    // template.
    const tabConfigs = [tab('details'), tab('status', 'sidebar')]
    const { container } = render(<ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-left-sidebar" />)
    const lists = container.querySelectorAll('[data-testid="tab-list"]')
    expect(lists.length).toBe(2)
    // Rendered left-to-right per the template's visual order (sidebar
    // first), but 'details' (unset zone) is inside the MAIN list, not the
    // sidebar one.
    expect(lists[0].getAttribute('data-ids')).toBe('status')
    expect(lists[1].getAttribute('data-ids')).toBe('details')
  })

  it('a tab whose zone id does not exist in the active layout falls back to DEFAULT_DETAIL_PAGE_ZONE (main), not to whichever zone renders first', () => {
    // Simulates a tab left over from switching away from a template that
    // no longer defines the zone it's tagged with. Regression case for
    // main-left-sidebar specifically: 'main' is listed SECOND there, so a
    // naive "fall back to zones[0]" would have wrongly re-homed this tab
    // into the sidebar instead of main.
    const tabConfigs = [tab('orphaned', 'some-removed-zone')]
    const { container } = render(<ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-left-sidebar" />)
    const lists = container.querySelectorAll('[data-testid="tab-list"]')
    expect(lists.length).toBe(1)
    expect(lists[0].getAttribute('data-ids')).toBe('orphaned')
  })

  // A w-80 (320px) sidebar zone beside a flex-1 main zone, with no wrap, ate
  // ~85% of a 375px viewport before the main content got anything (the
  // overflow bug this responsive fix addresses). Sizing is off the
  // CONTAINER (@3xl:), not the viewport (md:), because this same panel also
  // renders inside RecordsTable's ~672px drawer, where a viewport
  // breakpoint would report "wide" and squeeze the content column. jsdom
  // runs no real layout, so this asserts the Tailwind classes that encode
  // the intent — the actual stacking is live-verified in the browser.
  it('sidebar zone is full-width and stacks in a narrow container, fixed 320px in a wide one', () => {
    const tabConfigs = [tab('details'), tab('status', 'sidebar')]
    const { container } = render(<ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-right-sidebar" />)
    const zoneDivs = container.querySelectorAll(':scope > div > div > div')
    const sidebarZone = Array.from(zoneDivs).find((el) => el.querySelector('[data-ids="status"]'))
    expect(sidebarZone).toBeTruthy()
    expect(sidebarZone!.className).toContain('w-full')
    expect(sidebarZone!.className).toContain('@3xl:w-80')
    expect(sidebarZone!.className).not.toMatch(/(?<!@3xl:)\bw-80\b/)
  })

  it('row wrapper stacks its zones vertically in a narrow container, side by side in a wide one', () => {
    const tabConfigs = [tab('details'), tab('status', 'sidebar')]
    const { container } = render(<ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-right-sidebar" />)
    // The root establishes the container; its first child is the row.
    expect(container.firstElementChild!.className).toContain('@container')
    const row = container.firstElementChild!.firstElementChild!
    expect(row.className).toContain('flex-col')
    expect(row.className).toContain('@3xl:flex-row')
  })

  it('renders the sidebar zone stacked (no tab bar) and every other zone as tabs', () => {
    const tabConfigs = [tab('details'), tab('status', 'sidebar'), tab('comment', 'activity')]
    const { container } = render(<ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-right-sidebar" />)
    const variantOf = (id: string) =>
      container.querySelector(`[data-ids="${id}"]`)!.getAttribute('data-variant')
    expect(variantOf('status')).toBe('stacked')
    expect(variantOf('details')).toBe('tabs')
    expect(variantOf('comment')).toBe('tabs')
  })

  it('puts the full-width activity zone in its own row BELOW the main/sidebar row', () => {
    const tabConfigs = [tab('details'), tab('status', 'sidebar'), tab('comment', 'activity')]
    const { container } = render(<ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-right-sidebar" />)
    const root = container.firstElementChild!
    // Two children: the main/sidebar row, then the activity strip.
    expect(root.children.length).toBe(2)
    expect(root.children[0].querySelector('[data-ids="details"]')).toBeTruthy()
    expect(root.children[0].querySelector('[data-ids="status"]')).toBeTruthy()
    expect(root.children[1].querySelector('[data-ids="comment"]')).toBeTruthy()
    expect(root.children[1].className).toContain('border-t')
  })

  describe('pageContext="drawer"', () => {
    it('drops the narrow sidebar zone entirely rather than relocating or squeezing it', () => {
      const tabConfigs = [tab('details'), tab('status', 'sidebar'), tab('comment', 'activity')]
      const { container } = render(
        <ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-right-sidebar" pageContext="drawer" />,
      )
      const lists = container.querySelectorAll('[data-testid="tab-list"]')
      const ids = Array.from(lists).flatMap((l) => (l.getAttribute('data-ids') || '').split(',')).filter(Boolean)
      expect(ids).toEqual(['details', 'comment'])
      expect(ids).not.toContain('status')
    })

    it('still renders the full-width activity zone in a drawer', () => {
      const tabConfigs = [tab('details'), tab('status', 'sidebar'), tab('comment', 'activity')]
      const { container } = render(
        <ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-right-sidebar" pageContext="drawer" />,
      )
      expect(container.querySelector('[data-ids="comment"]')).toBeTruthy()
    })

    it('collapses to the pre-feature single-DetailTabList shape when the sidebar was the only other zone', () => {
      const tabConfigs = [tab('details'), tab('status', 'sidebar')]
      const { container } = render(
        <ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-right-sidebar" pageContext="drawer" />,
      )
      const lists = container.querySelectorAll('[data-testid="tab-list"]')
      expect(lists.length).toBe(1)
      expect(lists[0].getAttribute('data-ids')).toBe('details')
      expect(container.firstElementChild).toBe(lists[0])
    })

    it('defaults to "page" (every zone renders) when pageContext is omitted', () => {
      const tabConfigs = [tab('details'), tab('status', 'sidebar')]
      const { container } = render(<ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-right-sidebar" />)
      const lists = container.querySelectorAll('[data-testid="tab-list"]')
      expect(lists.length).toBe(2)
    })
  })
})

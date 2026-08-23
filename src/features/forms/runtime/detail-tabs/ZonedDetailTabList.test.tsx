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
  DetailTabList: ({ tabConfigs }: { tabConfigs: DetailTabConfig[] }) => (
    <div data-testid="tab-list" data-ids={tabConfigs.map((t) => t.id).join(',')} />
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
  // overflow bug this responsive fix addresses). jsdom doesn't run real
  // layout/media queries, so this only asserts the Tailwind classes that
  // encode the intended behavior are present on the right elements — the
  // actual stacking was live-verified in the browser separately.
  it('sidebar zone is full-width and stacks below md, fixed 320px at md and up', () => {
    const tabConfigs = [tab('details'), tab('status', 'sidebar')]
    const { container } = render(<ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-right-sidebar" />)
    const zoneDivs = container.querySelectorAll(':scope > div > div')
    const sidebarZone = Array.from(zoneDivs).find((el) => el.querySelector('[data-ids="status"]'))
    expect(sidebarZone).toBeTruthy()
    expect(sidebarZone!.className).toContain('w-full')
    expect(sidebarZone!.className).toContain('md:w-80')
    expect(sidebarZone!.className).not.toMatch(/(?<!md:)\bw-80\b/)
  })

  it('outer container stacks zones vertically below md, side by side at md and up', () => {
    const tabConfigs = [tab('details'), tab('status', 'sidebar')]
    const { container } = render(<ZonedDetailTabList {...baseProps} tabConfigs={tabConfigs} layout="main-right-sidebar" />)
    expect(container.firstElementChild!.className).toContain('flex-col')
    expect(container.firstElementChild!.className).toContain('md:flex-row')
  })
})

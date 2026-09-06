import { describe, it, expect, beforeEach } from 'vitest'
import { useFormBuilderStore, useFormMetaStore, updateDetailTabs, updateDetailLayout } from './store'
import { DEFAULT_DETAIL_PAGE_ZONE, type DetailTabConfig } from './schema'

// Guards the Detail Page Builder's layout-switch reconciliation rule: any
// tab whose `zone` isn't one of the NEWLY-selected layout's zone ids must
// be reset to DEFAULT_DETAIL_PAGE_ZONE ('main') in the same update that
// switches the layout, not left to drift out of sync until some later
// render happens to paper over it (ZonedDetailTabList.tsx has its own
// defensive floor for the same rule, but this store function is the
// primary place it's meant to run).

beforeEach(() => {
  useFormBuilderStore.getState().reset()
})

function tab(id: string, zone?: string): DetailTabConfig {
  return { id, type: 'details', config: {}, zone }
}

describe('updateDetailLayout', () => {
  it('sets detailLayout and leaves zoneless tabs untouched', () => {
    updateDetailTabs([tab('a'), tab('b')])
    updateDetailLayout('main-right-sidebar')
    const settings = useFormBuilderStore.getState().schema.settings
    expect(settings?.detailLayout).toBe('main-right-sidebar')
    expect(settings?.detailTabs?.map((t) => t.zone)).toEqual([undefined, undefined])
  })

  it('resets a tab whose zone id no layout defines back to main', () => {
    // A zone left over from a template that no longer exists (or a
    // hand-edited config): no current template defines it, so it must be
    // re-homed rather than left pointing at nothing.
    updateDetailTabs([tab('a', 'some-removed-zone')])
    updateDetailLayout('single')
    const tabs = useFormBuilderStore.getState().schema.settings?.detailTabs
    expect(tabs?.[0].zone).toBe(DEFAULT_DETAIL_PAGE_ZONE)
  })

  it('keeps a sidebar tab when switching to "single", which now defines the same zones as every other template', () => {
    // Every template carries main + sidebar + activity (schema.ts) — a
    // record detail page always has the sidebar and activity chrome, so
    // switching templates only moves which SIDE the sidebar is on and can
    // no longer orphan a sidebar tab.
    updateDetailTabs([tab('a', 'sidebar')])
    updateDetailLayout('single')
    const tabs = useFormBuilderStore.getState().schema.settings?.detailTabs
    expect(tabs?.[0].zone).toBe('sidebar')
  })

  it('leaves a tab\'s sidebar zone alone when switching between two layouts that both define it', () => {
    updateDetailTabs([tab('a', 'sidebar')])
    updateDetailLayout('main-right-sidebar')
    updateDetailLayout('main-left-sidebar')
    const tabs = useFormBuilderStore.getState().schema.settings?.detailTabs
    expect(tabs?.[0].zone).toBe('sidebar')
  })

  it('marks the meta store dirty', () => {
    updateDetailLayout('main-right-sidebar')
    expect(useFormMetaStore.getState().isDirty).toBe(true)
  })
})

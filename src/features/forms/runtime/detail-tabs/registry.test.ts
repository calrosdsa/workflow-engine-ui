import { describe, it, expect } from 'vitest'
import { resolveDetailTabs, defaultDetailTabs } from './registry'
import type { DetailTabConfig } from '@/features/form-builder/schema'

function tab(id: string, type: string, extra: Partial<DetailTabConfig> = {}): DetailTabConfig {
  return { id, type, config: {}, ...extra }
}

describe('resolveDetailTabs', () => {
  it('falls back to defaultDetailTabs() when nothing is configured', () => {
    expect(resolveDetailTabs(undefined)).toEqual(defaultDetailTabs())
    expect(resolveDetailTabs([])).toEqual(defaultDetailTabs())
  })

  // The actual regression: a form saved before 'comment' existed as a
  // built-in already has 'audit' near the front of its array (the old
  // 3-tab default was details/audit/linked) — 'comment' only ever gets
  // APPENDED for such a form, landing after 'audit' in raw array position.
  // Chrome order must not depend on that accident of history.
  it('orders Comments before Audit Log in the activity zone regardless of a form\'s saved array position', () => {
    const configured = [tab('details', 'details'), tab('audit', 'audit'), tab('linked', 'linked')]
    const resolved = resolveDetailTabs(configured)
    const activityTypes = resolved.filter((t) => t.zone === 'activity').map((t) => t.type)
    expect(activityTypes).toEqual(['comment', 'audit'])
  })

  it('orders Attachments before Tags in the sidebar zone the same way', () => {
    const configured = [tab('details', 'details'), tab('tags', 'tags'), tab('audit', 'audit')]
    const resolved = resolveDetailTabs(configured)
    const sidebarTypes = resolved.filter((t) => t.zone === 'sidebar').map((t) => t.type)
    expect(sidebarTypes).toEqual(['attachments', 'tags'])
  })

  it('leaves non-chrome entries in their own original relative order', () => {
    const configured = [tab('connections', 'connections'), tab('details', 'details'), tab('linked', 'linked')]
    const resolved = resolveDetailTabs(configured)
    const nonChromeTypes = resolved.filter((t) => !t.zone || t.zone === 'main').map((t) => t.type)
    expect(nonChromeTypes).toEqual(['connections', 'details', 'linked'])
  })

  it('preserves an existing chrome entry\'s label/hidden/visibility, only overwriting zone', () => {
    const configured = [
      tab('details', 'details'),
      tab('my-audit', 'audit', { label: 'History', hidden: true, zone: 'main' }),
    ]
    const resolved = resolveDetailTabs(configured)
    const audit = resolved.find((t) => t.type === 'audit')
    expect(audit).toMatchObject({ id: 'my-audit', label: 'History', hidden: true, zone: 'activity' })
  })

  it('appends a chrome type missing entirely, in the same shape defaultDetailTabs() uses', () => {
    const configured = [tab('details', 'details')]
    const resolved = resolveDetailTabs(configured)
    const tags = resolved.find((t) => t.type === 'tags')
    expect(tags).toEqual({ id: 'tags', type: 'tags', config: {}, zone: 'sidebar' })
  })
})

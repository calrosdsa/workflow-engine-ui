import { describe, it, expect } from 'vitest'
import { buildRuntimeNavTree } from './nav'
import type { MenuSnapshotItem } from './types'

function menu(overrides: Partial<MenuSnapshotItem> = {}): MenuSnapshotItem {
  return {
    id: 'm1', parent_id: null, menu_type: 'search', slug: 'search-1', name: 'Users',
    sort_order: 0, config: { form_id: 'form-1', columns: [], page_size: 25 },
    permission_mode: 'all', required_role_ids: [], hidden_from_nav: false,
    ...overrides,
  }
}

describe('buildRuntimeNavTree hidden_from_nav filtering', () => {
  const canViewForm = ['forms:form-1:view']

  it('includes a visible menu in the nav tree', () => {
    const tree = buildRuntimeNavTree([menu()], undefined, canViewForm)
    expect(tree.map((n) => n.id)).toEqual(['m1'])
  })

  it('excludes a menu flagged hidden_from_nav, e.g. an auto-paired Add menu', () => {
    const search = menu({ id: 'search-1' })
    const pairedAdd = menu({ id: 'add-1', menu_type: 'add', slug: 'add-1', hidden_from_nav: true })
    const tree = buildRuntimeNavTree([search, pairedAdd], undefined, ['forms:form-1:view', 'forms:form-1:create'])
    expect(tree.map((n) => n.id)).toEqual(['search-1'])
  })

  it('still excludes a hidden_from_nav menu even for a Super Admin (hidden_from_nav is not a permission gate)', () => {
    const pairedAdd = menu({ id: 'add-1', hidden_from_nav: true })
    const tree = buildRuntimeNavTree([pairedAdd], 'any-role', ['*'])
    expect(tree).toEqual([])
  })

  it('a role-gated but not hidden_from_nav menu is still hidden from a non-matching role (unrelated gate, sanity check)', () => {
    const roleGated = menu({ id: 'm1', permission_mode: 'role', required_role_ids: ['admin-role'] })
    const tree = buildRuntimeNavTree([roleGated], 'other-role', [])
    expect(tree).toEqual([])
  })
})

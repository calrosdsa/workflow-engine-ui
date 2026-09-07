import { describe, it, expect } from 'vitest'
import { buildRuntimeNavTree, isModulesModeApp, resolveSidebarNav } from './nav'
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

describe('isModulesModeApp', () => {
  it('is true for a root-level module menu', () => {
    const root = menu({ id: 'm1', menu_type: 'module', parent_id: null })
    expect(isModulesModeApp([root])).toBe(true)
  })

  it('is false when a module menu exists only nested under something else', () => {
    const group = menu({ id: 'g1', menu_type: 'parent', parent_id: null })
    const nestedModule = menu({ id: 'm1', menu_type: 'module', parent_id: 'g1' })
    expect(isModulesModeApp([group, nestedModule])).toBe(false)
  })

  it('is false for an app with no module menus at all', () => {
    expect(isModulesModeApp([menu()])).toBe(false)
  })
})

describe('resolveSidebarNav', () => {
  const canViewAll = ['forms:form-1:view']

  it('is byte-identical to buildRuntimeNavTree for an app with no root-level modules', () => {
    const menus = [menu({ id: 'm1' }), menu({ id: 'm2', parent_id: 'm1', menu_type: 'parent', slug: 'group' })]
    const plain = buildRuntimeNavTree(menus, undefined, canViewAll)
    const { navTree, scopedRoot } = resolveSidebarNav(menus, 'm1', undefined, canViewAll)
    expect(navTree).toEqual(plain)
    expect(scopedRoot).toBeNull()
  })

  it('scopes to the top-level module ancestor’s own children when the current menu is a grandchild', () => {
    const root = menu({ id: 'mod1', menu_type: 'module', slug: 'assets', name: 'Assets', parent_id: null })
    const child = menu({ id: 'search1', menu_type: 'search', parent_id: 'mod1', slug: 'asset-list' })
    const { navTree, scopedRoot } = resolveSidebarNav([root, child], 'search1', undefined, canViewAll)
    expect(navTree.map((n) => n.id)).toEqual(['search1'])
    expect(scopedRoot).toEqual({ id: 'mod1', name: 'Assets', icon: undefined, menu_type: 'module' })
  })

  it('scopes a non-module root tile the same way once the app has any root module', () => {
    const otherModule = menu({ id: 'mod1', menu_type: 'module', slug: 'assets', parent_id: null })
    const legacyRoot = menu({ id: 'legacy1', menu_type: 'search', slug: 'legacy', name: 'Legacy', parent_id: null })
    const legacyChild = menu({ id: 'legacy2', menu_type: 'parent', slug: 'legacy-group', parent_id: 'legacy1' })
    const { navTree, scopedRoot } = resolveSidebarNav([otherModule, legacyRoot, legacyChild], 'legacy2', undefined, canViewAll)
    expect(navTree.map((n) => n.id)).toEqual(['legacy2'])
    expect(scopedRoot).toEqual({ id: 'legacy1', name: 'Legacy', icon: undefined, menu_type: 'search' })
  })

  it('scopes to a Module nested under another Module when viewing that nested module itself, not the top-level parent', () => {
    const topModule = menu({ id: 'mod1', menu_type: 'module', slug: 'accounting', name: 'Accounting & Finance', parent_id: null })
    const flatSibling = menu({ id: 'invoices', menu_type: 'search', slug: 'invoices', parent_id: 'mod1' })
    const setup = menu({ id: 'setup', menu_type: 'module', slug: 'setup', name: 'Setup', parent_id: 'mod1' })
    const setupChild = menu({ id: 'fiscal-years', menu_type: 'search', slug: 'fiscal-years', parent_id: 'setup' })
    const payments = menu({ id: 'payments', menu_type: 'module', slug: 'payments', name: 'Payments', parent_id: 'mod1' })
    const paymentsChild = menu({ id: 'journal-entries', menu_type: 'search', slug: 'journal-entries', parent_id: 'payments' })
    const menus = [topModule, flatSibling, setup, setupChild, payments, paymentsChild]

    const { navTree, scopedRoot } = resolveSidebarNav(menus, 'setup', undefined, canViewAll)
    expect(navTree.map((n) => n.id)).toEqual(['fiscal-years'])
    expect(scopedRoot).toEqual({ id: 'setup', name: 'Setup', icon: undefined, menu_type: 'module' })
  })

  it('scopes to the nearest module ancestor for a grandchild of a nested module, not the outer top-level module', () => {
    const topModule = menu({ id: 'mod1', menu_type: 'module', slug: 'accounting', name: 'Accounting & Finance', parent_id: null })
    const setup = menu({ id: 'setup', menu_type: 'module', slug: 'setup', name: 'Setup', parent_id: 'mod1' })
    const setupChild = menu({ id: 'fiscal-years', menu_type: 'search', slug: 'fiscal-years', parent_id: 'setup' })
    const menus = [topModule, setup, setupChild]

    const { navTree, scopedRoot } = resolveSidebarNav(menus, 'fiscal-years', undefined, canViewAll)
    expect(navTree.map((n) => n.id)).toEqual(['fiscal-years'])
    expect(scopedRoot).toEqual({ id: 'setup', name: 'Setup', icon: undefined, menu_type: 'module' })
  })

  it('falls back to the full tree when the resolved root ancestor is permission-rejected', () => {
    const roleGatedRoot = menu({ id: 'mod1', menu_type: 'module', parent_id: null, permission_mode: 'role', required_role_ids: ['admin'] })
    const child = menu({ id: 'search1', menu_type: 'search', parent_id: 'mod1' })
    const { navTree, scopedRoot } = resolveSidebarNav([roleGatedRoot, child], 'search1', 'other-role', canViewAll)
    expect(navTree).toEqual(buildRuntimeNavTree([roleGatedRoot, child], 'other-role', canViewAll))
    expect(scopedRoot).toBeNull()
  })
})

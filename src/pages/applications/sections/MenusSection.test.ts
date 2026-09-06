// Client-side mirror of api/menus/handler.go's validateModuleParent — the
// module-nesting constraint (a 'module' menu may only sit at the top level
// or under another 'module' menu) enforced during drag-and-drop before an
// invalid move ever reaches the server. Covered here as a pure function
// rather than by simulating a full dnd-kit pointer-sensor drag, which is
// exercised live in the browser instead (see the module-menu-type feature's
// end-to-end check).
import { describe, it, expect } from 'vitest'
import { isValidModuleParent } from './MenusSection'
import type { Menu } from '@/features/menus/types'

function menu(id: string, menu_type: Menu['menu_type']): Menu {
  return {
    id, app_id: '', parent_id: null, menu_type, slug: id, name: id,
    sort_order: 0, config: {} as Menu['config'], permission_mode: 'all',
    required_role_ids: [], hidden_from_nav: false, created_at: '', updated_at: '',
  }
}

describe('isValidModuleParent', () => {
  const allMenus = [menu('mod1', 'module'), menu('group1', 'parent'), menu('search1', 'search')]

  it('allows the top level (null parent)', () => {
    expect(isValidModuleParent(null, allMenus)).toBe(true)
  })

  it('allows nesting under another module', () => {
    expect(isValidModuleParent('mod1', allMenus)).toBe(true)
  })

  it('rejects nesting under a Group (parent) menu', () => {
    expect(isValidModuleParent('group1', allMenus)).toBe(false)
  })

  it('rejects nesting under any other non-module type', () => {
    expect(isValidModuleParent('search1', allMenus)).toBe(false)
  })

  it('rejects a nonexistent parent id', () => {
    expect(isValidModuleParent('does-not-exist', allMenus)).toBe(false)
  })
})

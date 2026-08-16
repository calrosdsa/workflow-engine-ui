import { describe, it, expect, vi } from 'vitest'
import { ensurePairedAddMenu } from './MenusSection'
import type { Menu, AddMenuConfig } from '@/features/menus/types'

function searchMenu(overrides: Partial<Menu> = {}): Menu {
  return {
    id: 'search-1', app_id: 'app-1', parent_id: null, menu_type: 'search',
    slug: 'search-abc123', name: 'Users', sort_order: 0,
    config: { form_id: 'form-1', columns: [], page_size: 25 },
    permission_mode: 'all', required_role_ids: [], hidden_from_nav: false,
    created_at: '', updated_at: '',
    ...overrides,
  }
}

function addMenu(formId: string, overrides: Partial<Menu> = {}): Menu {
  return {
    id: 'add-1', app_id: 'app-1', parent_id: null, menu_type: 'add',
    slug: 'add-abc123', name: 'Add User', sort_order: 0,
    config: { form_id: formId, success_behavior: 'message', navigate_after_save: false } satisfies AddMenuConfig,
    permission_mode: 'all', required_role_ids: [], hidden_from_nav: true,
    created_at: '', updated_at: '',
    ...overrides,
  }
}

describe('ensurePairedAddMenu', () => {
  it('creates a hidden Add menu for the same form when none exists', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(addMenu('form-1'))
    const search = searchMenu()

    await ensurePairedAddMenu({
      allMenus: [search], searchMenu: search, formId: 'form-1',
      permissionMode: 'all', requiredRoleIds: [],
      createMutation: { mutateAsync } as never,
    })

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    const payload = mutateAsync.mock.calls[0][0]
    expect(payload.menu_type).toBe('add')
    expect(payload.hidden_from_nav).toBe(true)
    expect((payload.config as AddMenuConfig).form_id).toBe('form-1')
  })

  it('does not create a duplicate when a paired Add menu already exists for the form', async () => {
    const mutateAsync = vi.fn()
    const search = searchMenu()
    const existingAdd = addMenu('form-1')

    await ensurePairedAddMenu({
      allMenus: [search, existingAdd], searchMenu: search, formId: 'form-1',
      permissionMode: 'all', requiredRoleIds: [],
      createMutation: { mutateAsync } as never,
    })

    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('creates a new pair when the Search menu is re-pointed at a different form', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(addMenu('form-2'))
    const search = searchMenu({ config: { form_id: 'form-2', columns: [], page_size: 25 } })
    // An Add menu paired to the OLD form should not count as a match for the new one.
    const staleAdd = addMenu('form-1')

    await ensurePairedAddMenu({
      allMenus: [search, staleAdd], searchMenu: search, formId: 'form-2',
      permissionMode: 'all', requiredRoleIds: [],
      createMutation: { mutateAsync } as never,
    })

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect((mutateAsync.mock.calls[0][0].config as AddMenuConfig).form_id).toBe('form-2')
  })

  it('copies the Search menu\'s role gating onto the paired Add menu', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(addMenu('form-1'))
    const search = searchMenu({ permission_mode: 'role', required_role_ids: ['admin-role'] })

    await ensurePairedAddMenu({
      allMenus: [search], searchMenu: search, formId: 'form-1',
      permissionMode: 'role', requiredRoleIds: ['admin-role'],
      createMutation: { mutateAsync } as never,
    })

    const payload = mutateAsync.mock.calls[0][0]
    expect(payload.permission_mode).toBe('role')
    expect(payload.required_role_ids).toEqual(['admin-role'])
  })
})

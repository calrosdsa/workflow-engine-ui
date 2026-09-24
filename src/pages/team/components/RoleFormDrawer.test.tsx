// @vitest-environment jsdom
//
// "App design permissions" used to be savable on its own. A role like that got
// the Edit design button and then a blank screen: the design shell loads the
// application first, and GET /application needs "View application settings"
// (application:read). These pin that the role editor now saves read whenever
// design is on -- including for a role saved before this rule, and when the
// admin unticks the whole "application" group.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { en } from '@/features/i18n/locales/en'
import type { PermissionDef } from '@/features/permissions/types'
import type { Role } from '@/features/roles/types'
import { RoleFormDrawer } from './RoleFormDrawer'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

const CATALOG: PermissionDef[] = [
  { resource: 'application', action: 'read', key: 'application:read', label: 'View application settings' },
  { resource: 'application', action: 'write', key: 'application:write', label: 'Edit application settings and theme' },
  { resource: 'application', action: 'publish', key: 'application:publish', label: 'Publish the application' },
  { resource: 'application', action: 'design', key: 'application:design', label: 'Access design tools' },
  { resource: 'workflows', action: 'read', key: 'workflows:read', label: 'View workflows' },
]

const createMock = vi.fn()
const updateMock = vi.fn()
vi.mock('@/features/permissions/hooks', () => ({
  usePermissionsCatalog: () => ({ data: CATALOG }),
}))
vi.mock('@/features/roles/hooks', () => ({
  useCreateRole: () => ({ mutateAsync: (...args: unknown[]) => createMock(...args), isPending: false }),
  useUpdateRole: () => ({ mutateAsync: (...args: unknown[]) => updateMock(...args), isPending: false }),
}))

beforeEach(() => {
  createMock.mockResolvedValue({})
  updateMock.mockResolvedValue({})
})

afterEach(() => {
  cleanup()
  createMock.mockReset()
  updateMock.mockReset()
})

function renderDrawer(role: Role | null = null) {
  render(
    <I18nProvider>
      <RoleFormDrawer appId="app-1" role={role} onClose={vi.fn()} />
    </I18nProvider>,
  )
}

function readCheckbox(): HTMLElement {
  const label = screen.getByText('View application settings').closest('label')
  const box = label?.querySelector('[role=checkbox]')
  if (!box) throw new Error('no checkbox for View application settings')
  return box as HTMLElement
}

function applicationGroupCheckbox(): HTMLElement {
  const trigger = screen.getByRole('button', { name: 'application' })
  const box = trigger.parentElement?.parentElement?.querySelector('[role=checkbox]')
  if (!box) throw new Error('no group checkbox for application')
  return box as HTMLElement
}

function savedPermissions(mock: typeof createMock): string[] {
  expect(mock).toHaveBeenCalledTimes(1)
  return (mock.mock.calls[0][0] as { permissions: string[] }).permissions
}

describe('RoleFormDrawer and app design', () => {
  it('switching design on ticks and locks "View application settings", and saves it', async () => {
    renderDrawer()
    fireEvent.change(screen.getByPlaceholderText(en['team.role_name_placeholder']), { target: { value: 'Designer' } })

    expect(readCheckbox().getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByRole('switch'))

    expect(readCheckbox().getAttribute('aria-checked')).toBe('true')
    expect(readCheckbox()).toHaveProperty('disabled', true)
    expect(screen.getByText(en['team.required_for_app_design'])).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: en['team.save'] }))
    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(savedPermissions(createMock)).toEqual(expect.arrayContaining(['application:design', 'application:read']))
  })

  it('saves read for a role that was stored with design alone', async () => {
    renderDrawer({
      id: 'r1', client_id: 'c1', app_id: 'app-1', name: 'Old designer',
      permissions: ['application:design', 'workflows:read'], is_builtin: false, created_at: '',
    })

    expect(readCheckbox().getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: en['team.save'] }))
    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    expect(savedPermissions(updateMock)).toEqual(
      expect.arrayContaining(['application:design', 'application:read', 'workflows:read']),
    )
  })

  it('keeps read when the whole "application" group is unticked while design is on', async () => {
    renderDrawer()
    fireEvent.change(screen.getByPlaceholderText(en['team.role_name_placeholder']), { target: { value: 'Designer' } })
    fireEvent.click(screen.getByRole('switch'))

    // Tick the whole group, then untick it: write and publish go, read stays.
    fireEvent.click(applicationGroupCheckbox())
    fireEvent.click(applicationGroupCheckbox())

    fireEvent.click(screen.getByRole('button', { name: en['team.save'] }))
    await waitFor(() => expect(createMock).toHaveBeenCalled())
    const saved = savedPermissions(createMock)
    expect(saved).toContain('application:read')
    expect(saved).not.toContain('application:write')
    expect(saved).not.toContain('application:publish')
  })

  it('leaves read alone without design: a plain role is saved as ticked', async () => {
    renderDrawer()
    fireEvent.change(screen.getByPlaceholderText(en['team.role_name_placeholder']), { target: { value: 'Viewer' } })

    expect(readCheckbox()).toHaveProperty('disabled', false)
    fireEvent.click(screen.getByRole('button', { name: en['team.save'] }))
    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(savedPermissions(createMock)).not.toContain('application:read')
  })
})

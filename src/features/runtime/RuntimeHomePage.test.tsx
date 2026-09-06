// @vitest-environment jsdom
//
// The home/launcher grid's core behavior: a tile with module-type children
// opens the drilldown popup (and only shows those module children, not any
// non-module siblings); a tile with none — a leaf module, or a legacy
// non-module root menu in a mixed app — is a plain link straight to its own
// route. `session` is left at the auth store's default `null`, which skips
// the top bar's NotificationBell/ProfileMenu (real network/theme
// dependencies neither this component nor this test cares about) without
// needing to mock either.
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { RuntimeHomePage } from './RuntimeHomePage'
import type { AppSnapshot } from './types'
import type { MenuTreeNode } from '@/features/menus/types'

afterEach(cleanup)

function renderHome(props: Parameters<typeof RuntimeHomePage>[0]) {
  return render(
    <I18nProvider>
      <RuntimeHomePage {...props} />
    </I18nProvider>,
  )
}

function node(over: Partial<MenuTreeNode> & Pick<MenuTreeNode, 'id' | 'menu_type' | 'name' | 'slug'>): MenuTreeNode {
  return {
    app_id: '', parent_id: null, icon: undefined, sort_order: 0,
    config: {} as MenuTreeNode['config'], permission_mode: 'all', required_role_ids: [],
    hidden_from_nav: false, created_at: '', updated_at: '', children: [],
    ...over,
  } as MenuTreeNode
}

const snapshot: AppSnapshot = {
  app: { id: 'app-1', name: 'Test App', slug: 'test-app', settings: {} },
  menus: [],
  theme: {},
}

describe('RuntimeHomePage tile behavior', () => {
  it('renders a leaf module as a direct link to its own route', () => {
    const leaf = node({ id: 'm1', menu_type: 'module', name: 'Assets', slug: 'assets' })
    renderHome({ snapshot, clientId: 'c1', appId: 'app-1', homeTiles: [leaf] })

    const link = screen.getByRole('link', { name: /assets/i })
    expect(link.getAttribute('href')).toBe('/c1/app-1/assets')
  })

  it('renders a legacy non-module root tile as a direct link too (mixed-app case)', () => {
    const legacy = node({ id: 'm1', menu_type: 'search', name: 'Legacy Search', slug: 'legacy' })
    renderHome({ snapshot, clientId: 'c1', appId: 'app-1', homeTiles: [legacy] })

    expect(screen.getByRole('link', { name: /legacy search/i })).toBeTruthy()
  })

  it('renders a module with module-type children as a button that opens the drilldown showing only those children', () => {
    const child1 = node({ id: 'c1', menu_type: 'module', name: 'Invoicing', slug: 'invoicing' })
    const child2 = node({ id: 'c2', menu_type: 'module', name: 'Payments', slug: 'payments' })
    const nonModuleChild = node({ id: 'c3', menu_type: 'dashboard', name: 'Overview', slug: 'overview' })
    const group = node({ id: 'g1', menu_type: 'module', name: 'Accounting', slug: 'accounting', children: [child1, child2, nonModuleChild] })

    renderHome({ snapshot, clientId: 'c1', appId: 'app-1', homeTiles: [group] })

    // Not a link — a button, since it must open the popup rather than navigate.
    expect(screen.queryByRole('link', { name: /accounting/i })).toBeNull()
    const tile = screen.getByRole('button', { name: /accounting/i })
    fireEvent.click(tile)

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Invoicing')).toBeTruthy()
    expect(screen.getByText('Payments')).toBeTruthy()
    expect(screen.queryByText('Overview')).toBeNull()
  })
})

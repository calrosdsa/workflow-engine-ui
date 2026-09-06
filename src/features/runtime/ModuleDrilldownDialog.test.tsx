// @vitest-environment jsdom
//
// The home-page drilldown popup: clicking a child that itself has module
// children drills one level deeper (replacing the dialog's content in
// place, not stacking a second dialog); clicking a leaf child navigates and
// closes; the back control pops exactly one level.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { ModuleDrilldownDialog } from './ModuleDrilldownDialog'
import type { MenuTreeNode } from '@/features/menus/types'

afterEach(cleanup)

function renderDialog(props: Parameters<typeof ModuleDrilldownDialog>[0]) {
  return render(
    <I18nProvider>
      <ModuleDrilldownDialog {...props} />
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

describe('ModuleDrilldownDialog', () => {
  it('navigates and closes when a leaf module child is clicked', () => {
    const leaf = node({ id: 'c1', menu_type: 'module', name: 'Invoicing', slug: 'invoicing' })
    const root = node({ id: 'g1', menu_type: 'module', name: 'Accounting', slug: 'accounting', children: [leaf] })
    const onNavigate = vi.fn()
    const onClose = vi.fn()

    renderDialog({ open: true, root, onClose, onNavigate })
    fireEvent.click(screen.getByText('Invoicing'))

    expect(onNavigate).toHaveBeenCalledWith('invoicing')
  })

  it('drills one level deeper in place when a child itself has module children', () => {
    const grandchild = node({ id: 'gc1', menu_type: 'module', name: 'Sales Tax', slug: 'sales-tax' })
    const child = node({ id: 'c1', menu_type: 'module', name: 'Taxes', slug: 'taxes', children: [grandchild] })
    const root = node({ id: 'g1', menu_type: 'module', name: 'Accounting', slug: 'accounting', children: [child] })
    const onNavigate = vi.fn()

    renderDialog({ open: true, root, onClose: () => {}, onNavigate })
    expect(screen.getByText('Accounting')).toBeTruthy()

    fireEvent.click(screen.getByText('Taxes'))

    // Replaced in place: the dialog title now reads "Taxes" (the new
    // current level), but its tile button is gone — Accounting's other
    // children are gone too, only the new level's own children show, and no
    // navigation happened.
    expect(screen.queryByRole('button', { name: 'Taxes' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Taxes' })).toBeTruthy()
    expect(screen.getByText('Sales Tax')).toBeTruthy()
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('the back control pops exactly one level', () => {
    const grandchild = node({ id: 'gc1', menu_type: 'module', name: 'Sales Tax', slug: 'sales-tax' })
    const child = node({ id: 'c1', menu_type: 'module', name: 'Taxes', slug: 'taxes', children: [grandchild] })
    const root = node({ id: 'g1', menu_type: 'module', name: 'Accounting', slug: 'accounting', children: [child] })

    renderDialog({ open: true, root, onClose: () => {}, onNavigate: () => {} })
    fireEvent.click(screen.getByText('Taxes'))
    expect(screen.getByText('Sales Tax')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /back/i }))

    expect(screen.getByText('Taxes')).toBeTruthy()
    expect(screen.queryByText('Sales Tax')).toBeNull()
  })
})

// @vitest-environment jsdom
//
// A Parent menu's child-picker grid draws each child with an icon looked up by
// menu type. That lookup table is a hand-maintained mirror of
// MENU_TYPE_REGISTRY[type].icon (it can't import the registry — the registry
// imports this module as the `parent` type's runtimeRenderer), and when the
// `html` menu type shipped it was never added.
//
// The consequence was worse than a missing icon: the JSX is `<Icon size={18}/>`,
// so an unlisted type resolves to undefined and React throws "Element type is
// invalid" — one HTML child menu blanked the whole parent page. This suite
// covers every menu type so the next type added fails here too, not only in a
// typecheck someone has to remember to run.
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { ParentMenuRuntime } from './ParentMenuRuntime'
import { MENU_TYPE_REGISTRY } from '../menu-registry'
import type { Menu, MenuType } from '../types'

afterEach(cleanup)

function menu(over: Partial<Menu> & Pick<Menu, 'id' | 'menu_type' | 'name'>): Menu {
  return {
    app_id: 'a-1',
    parent_id: null,
    slug: over.name.toLowerCase().replace(/\s+/g, '-'),
    icon: undefined,
    sort_order: 0,
    config: {} as Menu['config'],
    permission_mode: 'all',
    required_role_ids: [],
    hidden_from_nav: false,
    created_at: '',
    updated_at: '',
    ...over,
  } as Menu
}

const parent = menu({ id: 'p-1', menu_type: 'parent', name: 'Operations' })

describe('ParentMenuRuntime child icons', () => {
  it('renders an HTML child menu instead of throwing', () => {
    const htmlChild = menu({ id: 'c-1', menu_type: 'html', name: 'Ops Console', parent_id: 'p-1' })

    render(<ParentMenuRuntime menu={parent} clientId="c" appId="a-1" menus={[parent, htmlChild]} />)

    const card = screen.getByRole('button', { name: /ops console/i })
    expect(card).toBeTruthy()
    // The icon is a real rendered lucide glyph, not an empty slot.
    expect(card.querySelector('svg')).toBeTruthy()
  })

  it('renders a card with an icon for every registered menu type', () => {
    // Drives the assertion off the registry itself, so a newly registered type
    // is covered the moment it exists rather than when someone remembers to
    // extend this list.
    const types = Object.keys(MENU_TYPE_REGISTRY) as MenuType[]
    const children = types.map((type, i) =>
      menu({ id: `c-${i}`, menu_type: type, name: `${type} child`, parent_id: 'p-1' }),
    )

    render(<ParentMenuRuntime menu={parent} clientId="c" appId="a-1" menus={[parent, ...children]} />)

    for (const type of types) {
      const card = screen.getByRole('button', { name: new RegExp(`${type} child`, 'i') })
      expect(card.querySelector('svg'), `${type} child should render an icon`).toBeTruthy()
    }
  })

  it('still shows the empty state when a parent has no children', () => {
    render(<ParentMenuRuntime menu={parent} clientId="c" appId="a-1" menus={[parent]} />)
    expect(screen.getByText(/has no sections yet/i)).toBeTruthy()
  })
})

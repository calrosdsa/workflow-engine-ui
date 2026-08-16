// @vitest-environment jsdom
//
// Covers the Hidden-tray drag interaction: dropping a visible menu onto the
// Hidden zone sets hidden_from_nav; dragging a hidden menu back onto the
// tree/root zone unhides it and lands it at root. dnd-kit's pointer/keyboard
// event simulation is unreliable to drive via browser automation (confirmed
// live this session) and via jsdom fireEvent — its DragEndEvent shape is
// synthesized internally from low-level pointer state, not a single DOM
// event fireEvent can replay — so this tests MenuTree's actual
// handleDragEnd logic directly: mock @dnd-kit/core's DndContext to capture
// the onDragEnd callback MenuTree passes it, then invoke that callback with
// a hand-built DragEndEvent, exactly like a real drag-and-drop completion
// would. useSortable/useDroppable are stubbed to no-ops since nothing here
// exercises the actual pointer sensors.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MenuTree } from './MenusSection'
import type { Menu, MenuTreeNode } from '@/features/menus/types'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

let capturedOnDragEnd: ((e: unknown) => void) | null = null

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    DndContext: (props: { onDragEnd?: (e: unknown) => void; children?: React.ReactNode }) => {
      capturedOnDragEnd = props.onDragEnd ?? null
      return props.children
    },
    useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  }
})

vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/sortable')>()
  return {
    ...actual,
    useSortable: () => ({
      attributes: {}, listeners: {}, setNodeRef: () => {},
      transform: null, transition: undefined, isDragging: false, isOver: false, active: null,
    }),
  }
})

const patchCalls: { id: string; body: Record<string, unknown> }[] = []
const reorderCalls: string[][] = []

vi.mock('@/features/menus/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/menus/hooks')>()
  return {
    ...actual,
    useReorderMenus: () => ({
      mutate: (p: { ordered_ids: string[] }) => { reorderCalls.push(p.ordered_ids) },
    }),
    useMoveMenu: () => ({ mutate: () => {} }),
    useSetHiddenFromNav: () => ({
      mutate: (p: { menu: Menu; hidden_from_nav: boolean }, opts?: { onSuccess?: () => void }) => {
        patchCalls.push({ id: p.menu.id, body: { hidden_from_nav: p.hidden_from_nav } })
        opts?.onSuccess?.()
      },
    }),
  }
})

function menu(overrides: Partial<Menu> = {}): Menu {
  return {
    id: 'm1', app_id: 'app-1', parent_id: null, menu_type: 'search',
    slug: 'search-1', name: 'Users', sort_order: 0,
    config: { form_id: 'form-1', columns: [], page_size: 25 },
    permission_mode: 'all', required_role_ids: [], hidden_from_nav: false,
    created_at: '', updated_at: '',
    ...overrides,
  }
}

function node(m: Menu): MenuTreeNode {
  return { ...m, children: [] }
}

const HIDDEN_ZONE_ID = '__menu-tree-hidden-drop-zone__'
const ROOT_DROP_ZONE_ID = '__menu-tree-root-drop-zone__'

describe('MenuTree Hidden-tray drag interaction', () => {
  it('dropping a visible menu onto the Hidden zone sets hidden_from_nav: true', () => {
    const visible = menu({ id: 'm1', name: 'Users' })
    patchCalls.length = 0

    render(
      <MenuTree
        tree={[node(visible)]}
        hiddenMenus={[]}
        allMenus={[visible]}
        selectedId={null}
        onSelect={() => {}}
        onAddChild={() => {}}
      />,
    )

    expect(capturedOnDragEnd).not.toBeNull()
    capturedOnDragEnd!({
      active: { id: 'm1' },
      over: { id: HIDDEN_ZONE_ID },
    })

    expect(patchCalls).toEqual([{ id: 'm1', body: { hidden_from_nav: true } }])
    // Hiding doesn't reorder anything — only the flag flips.
    expect(reorderCalls).toEqual([])
  })

  it('dragging a hidden menu onto the root drop zone unhides it and appends it at root', () => {
    const hidden = menu({ id: 'm2', name: 'Add Users', menu_type: 'add', hidden_from_nav: true })
    const rootSibling = menu({ id: 'm1', name: 'Users' })
    patchCalls.length = 0
    reorderCalls.length = 0

    render(
      <MenuTree
        tree={[node(rootSibling)]}
        hiddenMenus={[hidden]}
        allMenus={[rootSibling, hidden]}
        selectedId={null}
        onSelect={() => {}}
        onAddChild={() => {}}
      />,
    )

    capturedOnDragEnd!({
      active: { id: 'm2' },
      over: { id: ROOT_DROP_ZONE_ID },
    })

    expect(patchCalls).toEqual([{ id: 'm2', body: { hidden_from_nav: false } }])
    // Restoring lands it at root, appended after existing root siblings.
    expect(reorderCalls).toEqual([['m1', 'm2']])
  })

  it('dragging a hidden menu back onto a visible tree row also unhides it (not just the root zone)', () => {
    const hidden = menu({ id: 'm2', name: 'Add Users', menu_type: 'add', hidden_from_nav: true })
    const visible = menu({ id: 'm1', name: 'Users' })
    patchCalls.length = 0
    reorderCalls.length = 0

    render(
      <MenuTree
        tree={[node(visible)]}
        hiddenMenus={[hidden]}
        allMenus={[visible, hidden]}
        selectedId={null}
        onSelect={() => {}}
        onAddChild={() => {}}
      />,
    )

    capturedOnDragEnd!({
      active: { id: 'm2' },
      over: { id: 'm1' }, // dropped directly on the visible "Users" row
    })

    expect(patchCalls).toEqual([{ id: 'm2', body: { hidden_from_nav: false } }])
  })

  it('dropping a hidden menu back onto the Hidden zone itself is a no-op', () => {
    const hidden = menu({ id: 'm2', hidden_from_nav: true })
    patchCalls.length = 0
    reorderCalls.length = 0

    render(
      <MenuTree
        tree={[]}
        hiddenMenus={[hidden]}
        allMenus={[hidden]}
        selectedId={null}
        onSelect={() => {}}
        onAddChild={() => {}}
      />,
    )

    capturedOnDragEnd!({
      active: { id: 'm2' },
      over: { id: HIDDEN_ZONE_ID },
    })

    expect(patchCalls).toEqual([])
    expect(reorderCalls).toEqual([])
  })

  it('dropping a menu onto itself is a no-op', () => {
    const visible = menu({ id: 'm1' })
    patchCalls.length = 0

    render(
      <MenuTree
        tree={[node(visible)]}
        hiddenMenus={[]}
        allMenus={[visible]}
        selectedId={null}
        onSelect={() => {}}
        onAddChild={() => {}}
      />,
    )

    capturedOnDragEnd!({ active: { id: 'm1' }, over: { id: 'm1' } })

    expect(patchCalls).toEqual([])
  })
})

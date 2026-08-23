import { useState } from 'react'
import { Plus, ChevronRight, ChevronDown, ArrowUp, ArrowDown, GripVertical, Trash2, Loader2, AlertCircle, EyeOff, Eye } from 'lucide-react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, pointerWithin, rectIntersection,
  useDroppable,
  type DragStartEvent, type DragEndEvent, type CollisionDetection,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { useMenus, useCreateMenu, useUpdateMenu, useDeleteMenu, useReorderMenus, useMoveMenu, useSetHiddenFromNav } from '@/features/menus/hooks'
import { buildMenuTree } from '@/features/menus/tree'
import { MENU_TYPE_REGISTRY } from '@/features/menus/menu-registry'
import { usePermission } from '@/features/auth/permissions'
import { usePermissionsCatalog } from '@/features/permissions/hooks'
import { useRoles } from '@/features/roles/hooks'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { cn } from '@/lib/utils'
import type { Menu, MenuType, MenuTreeNode, PermissionMode } from '@/features/menus/types'
import type { SearchMenuConfig, AddMenuConfig } from '@/features/menus/types'

const ROOT_DROP_ZONE_ID = '__menu-tree-root-drop-zone__'
const HIDDEN_ZONE_ID = '__menu-tree-hidden-drop-zone__'

interface MenusSectionProps {
  appId: string
}

export function MenusSection({ appId }: MenusSectionProps) {
  const { data: menus, isLoading } = useMenus()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerParentId, setPickerParentId] = useState<string | null>(null)

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  // Menus flagged hidden_from_nav (dropped into the Hidden tray below, or an
  // auto-paired Add menu — see ensurePairedAddMenu) never appear in the main
  // tree; buildMenuTree itself stays unfiltered (it's also reused by the
  // runtime's nav-tree builder, which needs the raw structure to still find
  // hidden nodes when navigated to directly), so the split happens here,
  // once, right before handing each half to its own section of the panel.
  const visibleMenus = (menus ?? []).filter((m) => !m.hidden_from_nav)
  const hiddenMenus = (menus ?? []).filter((m) => m.hidden_from_nav)
  const tree = buildMenuTree(visibleMenus)
  const selected = (menus ?? []).find((m) => m.id === selectedId) ?? null

  return (
    <div className="flex h-full">
      <div className="w-72 shrink-0 space-y-3 overflow-y-auto border-r border-[hsl(var(--border))] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Menus</h3>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setPickerParentId(null); setPickerOpen(true) }}>
            <Plus size={12} />Add
          </Button>
        </div>

        <MenuTree
          tree={tree}
          hiddenMenus={hiddenMenus}
          allMenus={menus ?? []}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAddChild={(parentId) => { setPickerParentId(parentId); setPickerOpen(true) }}
        />
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        {selected ? (
          <MenuDetail key={selected.id} menu={selected} appId={appId} onDeleted={() => setSelectedId(null)} />
        ) : (
          <div className="p-6 text-sm text-[hsl(var(--muted-foreground))]">Select a menu to configure it.</div>
        )}
      </div>

      <MenuTypePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        parentId={pickerParentId}
        onCreated={(id) => { setPickerOpen(false); setSelectedId(id) }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tree view
// ---------------------------------------------------------------------------

function groupByParent(menus: Menu[]): Map<string | null, Menu[]> {
  const map = new Map<string | null, Menu[]>()
  for (const m of menus) {
    // See buildMenuTree's identical normalisation note — omitempty means a
    // root-level menu's parent_id arrives as undefined, not null.
    const key = m.parent_id ?? null
    const list = map.get(key) ?? []
    list.push(m)
    map.set(key, list)
  }
  for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order)
  return map
}

/** A flattened row: one entry per visible node (respecting collapsed
 *  parents), depth-first, carrying its depth for indentation. Flat because
 *  cross-parent drag needs ONE DndContext/SortableContext spanning the whole
 *  tree — dnd-kit can't detect collisions across separate contexts, which is
 *  exactly why the previous per-level-DndContext version couldn't support
 *  dragging a node out of its parent. */
interface FlatRow {
  node: MenuTreeNode
  depth: number
  hasChildren: boolean
}

function flattenVisible(tree: MenuTreeNode[], collapsed: Set<string>, depth = 0): FlatRow[] {
  const out: FlatRow[] = []
  for (const node of tree) {
    const hasChildren = node.children.length > 0
    out.push({ node, depth, hasChildren })
    if (hasChildren && !collapsed.has(node.id)) {
      out.push(...flattenVisible(node.children, collapsed, depth + 1))
    }
  }
  return out
}

/** True if `maybeAncestorId` is `nodeId` itself or any ancestor of it —
 *  used to block dragging a parent onto its own descendant, which would
 *  otherwise silently create a cycle the backend only catches at publish
 *  time (internal/appbuilder/validate.go's findParentCycle). */
function isNodeOrDescendant(root: MenuTreeNode, targetId: string): boolean {
  if (root.id === targetId) return true
  return root.children.some((c) => isNodeOrDescendant(c, targetId))
}

function findNode(tree: MenuTreeNode[], id: string): MenuTreeNode | null {
  for (const n of tree) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

export function MenuTree({ tree, hiddenMenus, allMenus, selectedId, onSelect, onAddChild }: {
  tree: MenuTreeNode[]
  hiddenMenus: Menu[]
  allMenus: Menu[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAddChild: (parentId: string) => void
}) {
  const reorderMutation = useReorderMenus()
  const moveMutation = useMoveMenu()
  const hideMutation = useSetHiddenFromNav()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)

  const siblingGroups = groupByParent(allMenus)
  const rows = flattenVisible(tree, collapsed)
  const rowIds = [...rows.map((r) => r.node.id), ROOT_DROP_ZONE_ID, ...hiddenMenus.map((m) => m.id), HIDDEN_ZONE_ID]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Prefer whatever's directly under the pointer (needed to distinguish
  // "drop onto this row" from "drop onto the row below it") and only fall
  // back to rectangle intersection — same strategy the form-builder's
  // FormBuilderDnd.tsx uses for the same reason.
  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) return pointerCollisions
    return rectIntersection(args)
  }

  const move = (node: MenuTreeNode, dir: -1 | 1) => {
    const siblings = siblingGroups.get(node.parent_id) ?? []
    const idx = siblings.findIndex((s) => s.id === node.id)
    const swapWith = idx + dir
    if (swapWith < 0 || swapWith >= siblings.length) return
    const ordered = [...siblings]
    ;[ordered[idx], ordered[swapWith]] = [ordered[swapWith], ordered[idx]]
    reorderMutation.mutate({ ordered_ids: ordered.map((s) => s.id) })
  }

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  // Shared by both the drag-out-of-the-tray case and the tray row's own
  // restore-icon click — unhides a menu and lands it at the root level
  // rather than trying to infer a nested position from wherever it happened
  // to be dropped (or wasn't dropped at all, for the icon-click case).
  // Simplest predictable behavior for "bring this back"; it can be
  // dragged/reordered from there like any other menu afterward.
  const restoreToRoot = (menu: Menu) => {
    hideMutation.mutate(
      { menu, hidden_from_nav: false },
      {
        onSuccess: () => {
          // siblingGroups is built from allMenus (includes hidden ones), and
          // a hidden menu's own parent_id is untouched while hidden — so if
          // it was already root-parented, it can already be sitting in its
          // own "root siblings" group here. Exclude it before appending, or
          // restoring a root-parented hidden menu would send it twice.
          const rootIds = (siblingGroups.get(null) ?? []).map((s) => s.id).filter((id) => id !== menu.id)
          reorderMutation.mutate({ ordered_ids: [...rootIds, menu.id] })
        },
      },
    )
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    const overId = String(over.id)
    const activeId_ = String(active.id)
    const draggedHidden = hiddenMenus.find((m) => m.id === activeId_)

    // A hidden-tray item is a flat Menu, not a MenuTreeNode (it isn't part
    // of `tree` at all — see MenusSection's visibleMenus/hiddenMenus split),
    // so it gets its own short-circuit before the tree-node lookups below,
    // which would otherwise never find it.
    if (draggedHidden) {
      if (overId === HIDDEN_ZONE_ID) return // already hidden; nothing to do
      restoreToRoot(draggedHidden)
      return
    }

    const activeNode = findNode(tree, activeId_)
    if (!activeNode) return

    // Dropped into the Hidden tray → flag it hidden_from_nav, leaving its
    // parent_id/sort_order untouched (restoring it later drops it back at
    // root rather than needing to remember where it used to live, but
    // there's no reason to also churn its other fields here).
    if (overId === HIDDEN_ZONE_ID) {
      hideMutation.mutate({ menu: activeNode, hidden_from_nav: true })
      return
    }

    // Dropped on the root strip → become a root-level sibling, appended last.
    if (overId === ROOT_DROP_ZONE_ID) {
      if (activeNode.parent_id === null) return // already root; nothing to do
      reparentAndAppend(activeNode, null)
      return
    }

    const overNode = findNode(tree, overId)
    if (!overNode) return
    // Never allow dropping a node onto itself or one of its own descendants
    // — would create a cycle.
    if (isNodeOrDescendant(activeNode, overNode.id)) return

    // Dropped ON a Parent-type row → nest INTO it as its child, appended
    // last. Matches the existing "Add child menu" button's own constraint
    // (only 'parent' menus are navigation containers), so drag can't create
    // a parent/child relationship the rest of the UI wouldn't otherwise
    // allow.
    if (overNode.menu_type === 'parent' && overNode.id !== activeNode.parent_id) {
      reparentAndAppend(activeNode, overNode.id)
      return
    }

    // Otherwise: become a sibling in overNode's group, positioned at
    // overNode's slot. Covers both plain same-group reordering (the common
    // case) and moving into a different group by dropping next to one of
    // its existing members.
    const targetParentId = overNode.parent_id
    const sourceSiblings = siblingGroups.get(activeNode.parent_id) ?? []
    const targetSiblings = siblingGroups.get(targetParentId) ?? []
    const sameGroup = activeNode.parent_id === targetParentId

    if (sameGroup) {
      const fromIdx = sourceSiblings.findIndex((s) => s.id === activeNode.id)
      const toIdx = sourceSiblings.findIndex((s) => s.id === overNode.id)
      if (fromIdx === -1 || toIdx === -1) return
      const ordered = arrayMove(sourceSiblings, fromIdx, toIdx)
      reorderMutation.mutate({ ordered_ids: ordered.map((s) => s.id) })
      return
    }

    // Cross-group: re-parent first, then insert into the target group at
    // overNode's position once the re-parent lands (see reparentAndInsert).
    reparentAndInsert(activeNode, targetParentId, targetSiblings, overNode.id)
  }

  const reparentAndAppend = (node: MenuTreeNode, newParentId: string | null) => {
    const { children: _children, ...menu } = node
    moveMutation.mutate(
      { menu, parent_id: newParentId },
      {
        onSuccess: () => {
          const newSiblings = (siblingGroups.get(newParentId) ?? []).map((s) => s.id)
          reorderMutation.mutate({ ordered_ids: [...newSiblings, node.id] })
        },
      },
    )
  }

  const reparentAndInsert = (node: MenuTreeNode, newParentId: string | null, targetSiblings: Menu[], insertBeforeId: string) => {
    const { children: _children, ...menu } = node
    moveMutation.mutate(
      { menu, parent_id: newParentId },
      {
        onSuccess: () => {
          const ids = targetSiblings.map((s) => s.id)
          const insertAt = ids.indexOf(insertBeforeId)
          ids.splice(insertAt === -1 ? ids.length : insertAt, 0, node.id)
          reorderMutation.mutate({ ordered_ids: ids })
        },
      },
    )
  }

  const activeVisible = activeId ? rows.find((r) => r.node.id === activeId) : null
  const activeHidden = activeId ? hiddenMenus.find((m) => m.id === activeId) : null
  const activeOverlay = activeVisible
    ? { name: activeVisible.node.name, menuType: activeVisible.node.menu_type }
    : activeHidden
      ? { name: activeHidden.name, menuType: activeHidden.menu_type }
      : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-0.5">
          {tree.length === 0 ? (
            <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
              No menus yet. Add one to build your navigation.
            </p>
          ) : (
            rows.map(({ node, depth, hasChildren }) => {
              const siblings = siblingGroups.get(node.parent_id) ?? []
              const index = siblings.findIndex((s) => s.id === node.id)
              const isCollapsed = collapsed.has(node.id)
              return (
                <MenuRow
                  key={node.id}
                  node={node}
                  depth={depth}
                  index={index}
                  siblingCount={siblings.length}
                  selected={selectedId === node.id}
                  hasChildren={hasChildren}
                  isCollapsed={isCollapsed}
                  onSelect={() => onSelect(node.id)}
                  onToggleCollapsed={() => setCollapsed((s) => { const n = new Set(s); n.has(node.id) ? n.delete(node.id) : n.add(node.id); return n })}
                  onMove={(dir) => move(node, dir)}
                  onAddChild={() => onAddChild(node.id)}
                />
              )
            })
          )}
          <RootDropZone />
        </div>

        <HiddenTray menus={hiddenMenus} selectedId={selectedId} onSelect={onSelect} onRestore={restoreToRoot} />
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.2,0,0,1)' }}>
        {activeOverlay && (
          <div className="flex items-center gap-1.5 rounded-md border border-[hsl(var(--primary))]/40 bg-[hsl(var(--card))] px-2 py-1 text-[13px] font-medium text-[hsl(var(--foreground))] shadow-lg">
            {(() => { const Icon = MENU_TYPE_REGISTRY[activeOverlay.menuType].icon; return <Icon size={13} className="shrink-0 text-[hsl(var(--primary))]" /> })()}
            {activeOverlay.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/** Drop target for un-nesting a menu back to the root level — dropping
 *  directly on a row only ever produces a sibling-of-that-row or
 *  child-of-that-parent result, so root-level placement needs its own
 *  always-present target rather than being inferred from row geometry. */
function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ZONE_ID })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mt-1 rounded-md border border-dashed px-2 py-1.5 text-center text-[11px] transition-colors',
        isOver ? 'border-[hsl(var(--primary))]/60 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]',
      )}
    >
      Drop here to move to top level
    </div>
  )
}

/** A collapsible "Hidden" section beneath the main tree — drag any menu here
 *  to set hidden_from_nav (excluded from the runtime nav sidebar, but still
 *  reachable by slug and fully editable, per Menu.hidden_from_nav's doc
 *  comment) without deleting it; drag a hidden item back onto the tree or
 *  root zone, or click its restore icon, to bring it back. Always rendered
 *  (not only when non-empty) so the drop target exists whether or not
 *  anything's hidden yet — collapsed by default once something IS hidden,
 *  since an established app will mostly want this out of the way after the
 *  first setup pass. */
function HiddenTray({ menus, selectedId, onSelect, onRestore }: {
  menus: Menu[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRestore: (menu: Menu) => void
}) {
  const [open, setOpen] = useState(false)
  const { setNodeRef, isOver } = useDroppable({ id: HIDDEN_ZONE_ID })

  return (
    <div className="mt-3 border-t border-[hsl(var(--border))] pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <EyeOff size={12} />
        Hidden
        {menus.length > 0 && <span className="font-normal normal-case text-[hsl(var(--muted-foreground))]/70">({menus.length})</span>}
      </button>

      {open && (
        <div
          ref={setNodeRef}
          className={cn(
            'mt-2 min-h-[2.25rem] space-y-0.5 rounded-md border border-dashed p-1 transition-colors',
            isOver ? 'border-[hsl(var(--primary))]/60 bg-[hsl(var(--primary))]/10' : 'border-[hsl(var(--border))]',
          )}
        >
          {menus.length === 0 ? (
            <p className="p-2 text-center text-[11px] text-[hsl(var(--muted-foreground))]/70">Drag a menu here to hide it from the sidebar.</p>
          ) : (
            menus.map((menu) => (
              <HiddenMenuRow
                key={menu.id}
                menu={menu}
                selected={selectedId === menu.id}
                onSelect={() => onSelect(menu.id)}
                onRestore={() => onRestore(menu)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function HiddenMenuRow({ menu, selected, onSelect, onRestore }: {
  menu: Menu
  selected: boolean
  onSelect: () => void
  onRestore: () => void
}) {
  const Icon = MENU_TYPE_REGISTRY[menu.menu_type].icon
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: menu.id })

  const style = { transform: CSS.Translate.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px]',
        selected ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]',
        isDragging && 'opacity-50',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag back onto the tree to restore"
        title="Drag back onto the tree to restore"
        className="shrink-0 cursor-grab touch-none rounded p-0.5 text-[hsl(var(--muted-foreground))]/60 hover:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] active:cursor-grabbing"
      >
        <GripVertical size={12} />
      </button>
      <span className="w-3 shrink-0" />
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]">
        <Icon size={13} className="shrink-0" />
        <span className="truncate">{menu.name}</span>
      </button>
      <button
        aria-label="Restore to the sidebar"
        title="Restore to the sidebar"
        onClick={onRestore}
        className="hidden shrink-0 rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] group-hover:block group-focus-within:block"
      >
        <Eye size={12} />
      </button>
    </div>
  )
}

function MenuRow({ node, depth, index, siblingCount, selected, hasChildren, isCollapsed, onSelect, onToggleCollapsed, onMove, onAddChild }: {
  node: MenuTreeNode
  depth: number
  index: number
  siblingCount: number
  selected: boolean
  hasChildren: boolean
  isCollapsed: boolean
  onSelect: () => void
  onToggleCollapsed: () => void
  onMove: (dir: -1 | 1) => void
  onAddChild: () => void
}) {
  const Icon = MENU_TYPE_REGISTRY[node.menu_type].icon
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver, active } = useSortable({ id: node.id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  // Highlight as a nest-target only while something is being dragged over a
  // Parent-type row that isn't already its dragged-over parent — mirrors
  // handleDragEnd's own "drop ON a parent row nests into it" rule, so the
  // hover state never promises an interaction that won't actually happen.
  const isNestTarget = isOver && node.menu_type === 'parent' && active?.id !== node.id

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, paddingLeft: depth * 14 + 6 }}
      className={cn(
        'group flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px]',
        selected ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]',
        isDragging && 'opacity-50',
        isNestTarget && 'bg-[hsl(var(--primary))]/10 ring-2 ring-inset ring-[hsl(var(--primary))]/60',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder or move to another group"
        title="Drag to reorder or move to another group"
        className="shrink-0 cursor-grab touch-none rounded p-0.5 text-[hsl(var(--muted-foreground))]/60 hover:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] active:cursor-grabbing"
      >
        <GripVertical size={12} />
      </button>
      {hasChildren ? (
        <button
          onClick={onToggleCollapsed}
          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          aria-expanded={!isCollapsed}
          className="shrink-0 rounded text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
      ) : (
        <span className="w-3 shrink-0" />
      )}
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]">
        <Icon size={13} className="shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
      <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex group-focus-within:flex">
        <button title="Move up" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)} className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-30">
          <ArrowUp size={11} />
        </button>
        <button title="Move down" aria-label="Move down" disabled={index === siblingCount - 1} onClick={() => onMove(1)} className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-30">
          <ArrowDown size={11} />
        </button>
        {node.menu_type === 'parent' && (
          <button title="Add child menu" aria-label="Add child menu" onClick={onAddChild} className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]">
            <Plus size={11} />
          </button>
        )}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add-menu type picker
// ---------------------------------------------------------------------------

function MenuTypePickerDialog({ open, onClose, parentId, onCreated }: {
  open: boolean
  onClose: () => void
  parentId: string | null
  onCreated: (id: string) => void
}) {
  const createMutation = useCreateMenu()
  const [error, setError] = useState<string | null>(null)

  const pick = async (type: MenuType) => {
    setError(null)
    const entry = MENU_TYPE_REGISTRY[type]
    try {
      const menu = await createMutation.mutateAsync({
        parent_id: parentId,
        menu_type: type,
        slug: `${type}-${Date.now().toString(36)}`,
        name: `New ${entry.label}`,
        sort_order: 0,
        config: entry.createDefaultConfig(),
        permission_mode: 'all',
        required_role_ids: [],
        hidden_from_nav: false,
      })
      onCreated(menu.id)
    } catch {
      setError('Could not create menu — slug may already exist.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Add a menu</DialogTitle>
          <DialogDescription>Choose what kind of menu to add.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 p-4">
          {Object.values(MENU_TYPE_REGISTRY).map((entry) => {
            const Icon = entry.icon
            return (
              <button
                key={entry.type}
                onClick={() => pick(entry.type)}
                disabled={createMutation.isPending}
                className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-3 text-left transition-colors hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--primary))]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))]">{entry.label}</p>
                  <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{entry.description}</p>
                </div>
              </button>
            )
          })}
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--destructive))]"><AlertCircle size={12} />{error}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Search → Add auto-pairing
// ---------------------------------------------------------------------------

/** A user shouldn't have to manually build a matching Add menu just so a
 *  Search menu's "Create" button has something to link to (previously it
 *  stayed permanently disabled with a "No Add page is configured for this
 *  form" tooltip until someone built one by hand). Called from
 *  MenuDetail.handleSave whenever a Search menu is saved with a form
 *  selected: creates a paired Add menu for that same form if one doesn't
 *  already exist. The pair is matched by form_id, not by any explicit link
 *  field, mirroring SearchMenuRuntime.tsx's own lookup
 *  (`m.menu_type === 'add' && config.form_id === searchConfig.form_id`) —
 *  reusing that exact matching rule means this stays consistent with
 *  whatever "linked" already means at runtime, with nothing new to keep in
 *  sync. The paired menu is created with hidden_from_nav: true (see
 *  Menu.hidden_from_nav's doc comment) so it doesn't clutter the sidebar as
 *  its own nav entry — it's only ever reached via the Search menu's Create
 *  button. Permission/role settings are copied from the Search menu so the
 *  Add menu is gated the same way (a viewer who can't see the Search menu
 *  shouldn't be able to deep-link into creating records for it either). */
export async function ensurePairedAddMenu({ allMenus, searchMenu, formId, permissionMode, requiredRoleIds, createMutation }: {
  allMenus: Menu[]
  searchMenu: Menu
  formId: string
  permissionMode: PermissionMode
  requiredRoleIds: string[]
  createMutation: ReturnType<typeof useCreateMenu>
}) {
  const alreadyPaired = allMenus.some(
    (m) => m.menu_type === 'add' && (m.config as AddMenuConfig).form_id === formId,
  )
  if (alreadyPaired) return

  const addDefaults = MENU_TYPE_REGISTRY.add.createDefaultConfig() as AddMenuConfig
  await createMutation.mutateAsync({
    parent_id: searchMenu.parent_id,
    menu_type: 'add',
    slug: `${searchMenu.slug}-add`,
    name: `Add ${searchMenu.name}`,
    sort_order: searchMenu.sort_order,
    config: { ...addDefaults, form_id: formId },
    required_permission: searchMenu.required_permission,
    permission_mode: permissionMode,
    required_role_ids: permissionMode === 'role' ? requiredRoleIds : [],
    hidden_from_nav: true,
  })
}

// ---------------------------------------------------------------------------
// Detail / config panel
// ---------------------------------------------------------------------------

function MenuDetail({ menu, appId, onDeleted }: { menu: Menu; appId: string; onDeleted: () => void }) {
  const updateMutation = useUpdateMenu(menu.id)
  const createMutation = useCreateMenu()
  const deleteMutation = useDeleteMenu()
  const canWrite = usePermission('menus:write')
  const { data: permissionsCatalog } = usePermissionsCatalog()
  const { data: roles } = useRoles(appId)
  const { data: allMenus } = useMenus()

  const [name, setName] = useState(menu.name)
  const [slug, setSlug] = useState(menu.slug)
  const [requiredPermission, setRequiredPermission] = useState(menu.required_permission ?? '')
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(menu.permission_mode)
  const [requiredRoleIds, setRequiredRoleIds] = useState<string[]>(menu.required_role_ids)
  const [config, setConfig] = useState<Menu['config']>(menu.config)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const ConfigPanel = MENU_TYPE_REGISTRY[menu.menu_type].configPanel
  const isResourceBacked = menu.menu_type === 'search' || menu.menu_type === 'add'
  const resourceFormId = isResourceBacked ? (config as SearchMenuConfig | AddMenuConfig).form_id : undefined
  const { data: resourceForm } = useFormDef(resourceFormId ?? '')

  const toggleRole = (roleId: string) => {
    setRequiredRoleIds((prev) => (prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]))
    setSaved(false)
  }

  const handleSave = async () => {
    setError(null)
    setSaved(false)
    if (permissionMode === 'role' && requiredRoleIds.length === 0) {
      setError('Select at least one role, or switch back to "For All".')
      return
    }
    if (isResourceBacked && !resourceFormId) {
      setError('Select a form before saving.')
      return
    }
    try {
      await updateMutation.mutateAsync({
        parent_id: menu.parent_id,
        menu_type: menu.menu_type,
        slug,
        name,
        icon: menu.icon,
        sort_order: menu.sort_order,
        config,
        required_permission: requiredPermission || undefined,
        permission_mode: permissionMode,
        required_role_ids: permissionMode === 'role' ? requiredRoleIds : [],
      })
      if (menu.menu_type === 'search' && resourceFormId) {
        await ensurePairedAddMenu({
          allMenus: allMenus ?? [], searchMenu: menu, formId: resourceFormId,
          permissionMode, requiredRoleIds, createMutation,
        })
      }
      setSaved(true)
    } catch {
      setError('Could not save — slug may already exist.')
    }
  }

  const handleDelete = async () => {
    setError(null)
    try {
      await deleteMutation.mutateAsync(menu.id)
      onDeleted()
    } catch {
      setError('Could not delete — remove or reparent child menus first.')
    }
  }

  return (
    <div className="max-w-xl space-y-5 p-6">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Name</label>
          <Input value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} disabled={!canWrite} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Slug</label>
          <Input value={slug} onChange={(e) => { setSlug(e.target.value); setSaved(false) }} className="font-mono text-xs" disabled={!canWrite} />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Permission</label>
        <div className="flex items-center gap-4">
          {(['all', 'role'] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-1.5 text-sm text-[hsl(var(--foreground))]">
              <input
                type="radio"
                name={`permission-mode-${menu.id}`}
                checked={permissionMode === mode}
                disabled={!canWrite}
                onChange={() => { setPermissionMode(mode); setSaved(false) }}
                className="text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              />
              {mode === 'all' ? 'For All' : 'Specific Role'}
            </label>
          ))}
        </div>

        {permissionMode === 'role' && (
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md border border-[hsl(var(--border))] p-2">
            {(roles ?? []).map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-[12px] text-[hsl(var(--foreground))]">
                <Checkbox
                  checked={requiredRoleIds.includes(role.id)}
                  onCheckedChange={() => toggleRole(role.id)}
                  disabled={!canWrite}
                />
                {role.name}
              </label>
            ))}
            {(roles ?? []).length === 0 && (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No roles defined for this app yet.</p>
            )}
          </div>
        )}
        <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
          {permissionMode === 'all'
            ? 'Visible to anyone who can view the app.'
            : "Only visible to members whose current role is checked above."}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Required permission (optional)</label>
        <select
          value={requiredPermission}
          onChange={(e) => { setRequiredPermission(e.target.value); setSaved(false) }}
          disabled={!canWrite}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-sm text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">No additional permission required</option>
          {(permissionsCatalog ?? []).map((p) => <option key={p.key} value={p.key}>{p.label} ({p.key})</option>)}
        </select>
        {isResourceBacked && (
          <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
            {MENU_TYPE_REGISTRY[menu.menu_type].label} menus also require the viewer to have{' '}
            {menu.menu_type === 'add' ? 'Create' : 'View'} access on{' '}
            {resourceForm ? `"${resourceForm.name}"` : 'this form'} — enforced automatically on top of the settings above.
          </p>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          {MENU_TYPE_REGISTRY[menu.menu_type].label} settings
        </h4>
        <ConfigPanel menu={{ ...menu, config }} onChange={(c) => { setConfig(c); setSaved(false) }} appId={appId} />
      </div>

      {error && <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--destructive))]"><AlertCircle size={12} />{error}</p>}

      {canWrite && (
        <div className="flex items-center gap-3 border-t border-[hsl(var(--border))] pt-4">
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-1.5">
            {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Save
          </Button>
          {saved && !updateMutation.isPending && <span className="text-xs text-[hsl(var(--success))]">Saved</span>}
          <Button variant="outline" onClick={handleDelete} disabled={deleteMutation.isPending} className="ml-auto gap-1.5 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10">
            <Trash2 size={13} />Delete
          </Button>
        </div>
      )}
    </div>
  )
}

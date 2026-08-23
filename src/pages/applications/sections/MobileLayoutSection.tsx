import { useEffect, useState } from 'react'
import { Save, Loader2, CheckCircle2, AlertCircle, GripVertical, Smartphone } from 'lucide-react'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { useMenus } from '@/features/menus/hooks'
import { MENU_TYPE_REGISTRY } from '@/features/menus/menu-registry'
import { useApplicationMobileNav, useUpdateApplicationMobileNav } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import { emptyMobileNavConfig } from '@/features/menus/mobile-nav-types'
import type { MobileNavConfig, MobileNavItem, MobileNavStyle } from '@/features/menus/mobile-nav-types'
import type { Menu } from '@/features/menus/types'
import { cn } from '@/lib/utils'

/** One row per top-level-eligible menu (root-level, i.e. parent_id === null
 *  — a Parent menu's children are reached by tapping into it on mobile, the
 *  same way ParentMenuRuntime already works, so only root menus are
 *  meaningful entries in the tab bar itself). Menus not yet present in the
 *  saved MobileNavConfig default to visible=true, ordered after the
 *  configured ones, matching the plan's own default-mapping rule so a
 *  newly-added menu doesn't just vanish from mobile until someone remembers
 *  to open this tab. */
function buildRows(menus: Menu[], config: MobileNavConfig): { menu: Menu; visible: boolean }[] {
  const rootMenus = menus.filter((m) => m.parent_id === null)
  const byId = new Map(rootMenus.map((m) => [m.id, m]))
  const configured = config.items
    .map((item) => ({ item, menu: byId.get(item.menu_id) }))
    .filter((x): x is { item: MobileNavItem; menu: Menu } => !!x.menu)
    .sort((a, b) => a.item.sort_order - b.item.sort_order)

  const configuredIds = new Set(configured.map((c) => c.menu.id))
  const unconfigured = rootMenus.filter((m) => !configuredIds.has(m.id))

  return [
    ...configured.map((c) => ({ menu: c.menu, visible: c.item.visible })),
    ...unconfigured.map((m) => ({ menu: m, visible: true })),
  ]
}

function rowsToConfig(rows: { menu: Menu; visible: boolean }[], style: MobileNavStyle): MobileNavConfig {
  return {
    version: 1,
    style,
    items: rows.map((r, i) => ({ menu_id: r.menu.id, visible: r.visible, sort_order: i })),
    max_visible_tabs: 5,
  }
}

export function MobileLayoutSection({ appId: _appId }: { appId: string }) {
  const { data: menus, isLoading: menusLoading } = useMenus()
  const { data: savedConfig, isLoading: configLoading } = useApplicationMobileNav()
  const updateMutation = useUpdateApplicationMobileNav()
  const canWrite = usePermission('application:write')

  const [rows, setRows] = useState<{ menu: Menu; visible: boolean }[]>([])
  const [style, setStyle] = useState<MobileNavStyle>('bottom_tabs')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (menus && savedConfig) {
      setRows(buildRows(menus, savedConfig))
      setStyle(savedConfig.style)
    } else if (menus && !configLoading && !savedConfig) {
      setRows(buildRows(menus, emptyMobileNavConfig()))
    }
  }, [menus, savedConfig, configLoading])

  // Every hook must run on every render, loading or not — dnd-kit's
  // sensors are created unconditionally here, above the loading early
  // return below, so this component never renders a different hook count
  // between its loading and loaded states (React's Rules of Hooks).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (menusLoading || configLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setRows((prev) => {
      const fromIdx = prev.findIndex((r) => r.menu.id === active.id)
      const toIdx = prev.findIndex((r) => r.menu.id === over.id)
      if (fromIdx === -1 || toIdx === -1) return prev
      return arrayMove(prev, fromIdx, toIdx)
    })
    setSaved(false)
  }

  const toggleVisible = (menuId: string) => {
    setRows((prev) => prev.map((r) => (r.menu.id === menuId ? { ...r, visible: !r.visible } : r)))
    setSaved(false)
  }

  const handleSave = async () => {
    await updateMutation.mutateAsync(rowsToConfig(rows, style))
    setSaved(true)
  }

  return (
    <div className="grid h-full grid-cols-2 divide-x">
      <div className="space-y-6 overflow-y-auto p-6">
        <div>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Mobile Layout</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Arrange and show/hide top-level menus in the mobile app's navigation.</p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Navigation style</label>
          <div className="flex items-center gap-4">
            {(['bottom_tabs', 'drawer'] as const).map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm text-[hsl(var(--foreground))]">
                <input
                  type="radio"
                  name="mobile-nav-style"
                  checked={style === s}
                  disabled={!canWrite}
                  onChange={() => { setStyle(s); setSaved(false) }}
                  className="text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                />
                {s === 'bottom_tabs' ? 'Bottom Tabs' : 'Drawer'}
              </label>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
            No top-level menus yet. Add menus in the Menus tab first.
          </p>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={rows.map((r) => r.menu.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {rows.map((row) => (
                  <MobileNavRow key={row.menu.id} menu={row.menu} visible={row.visible} onToggleVisible={() => toggleVisible(row.menu.id)} canWrite={canWrite} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {canWrite && (
          <div className="flex items-center gap-3 border-t border-[hsl(var(--border))] pt-4">
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-1.5">
              {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save mobile layout
            </Button>
            {saved && !updateMutation.isPending && <span className="flex items-center gap-1 text-xs text-[hsl(var(--success))]"><CheckCircle2 size={13} />Saved</span>}
            {updateMutation.isError && <span className="flex items-center gap-1 text-xs text-[hsl(var(--destructive))]"><AlertCircle size={13} />Failed to save</span>}
          </div>
        )}
      </div>

      <div className="overflow-y-auto bg-[hsl(var(--muted))]/40 p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Live preview</p>
        <PhonePreview rows={rows} style={style} />
      </div>
    </div>
  )
}

function MobileNavRow({ menu, visible, onToggleVisible, canWrite }: {
  menu: Menu
  visible: boolean
  onToggleVisible: () => void
  canWrite: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: menu.id })
  const Icon = MENU_TYPE_REGISTRY[menu.menu_type].icon

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-sm',
        isDragging && 'opacity-50',
        !visible && 'opacity-50',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        title="Drag to reorder"
        className="shrink-0 cursor-grab touch-none rounded p-0.5 text-[hsl(var(--muted-foreground))]/60 hover:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>
      <Icon size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
      <span className="min-w-0 flex-1 truncate">{menu.name}</span>
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <Checkbox checked={visible} onCheckedChange={onToggleVisible} disabled={!canWrite} />
        Visible
      </label>
    </div>
  )
}

function PhonePreview({ rows, style }: { rows: { menu: Menu; visible: boolean }[]; style: MobileNavStyle }) {
  const visibleRows = rows.filter((r) => r.visible)
  const tabs = style === 'bottom_tabs' ? visibleRows.slice(0, 5) : visibleRows
  const overflow = style === 'bottom_tabs' ? visibleRows.slice(5) : []

  return (
    <div className="mx-auto w-56 overflow-hidden rounded-[2rem] border-8 border-gray-800 bg-white shadow-lg">
      <div className="flex h-96 flex-col justify-between">
        <div className="flex-1 p-3">
          {visibleRows.length === 0 ? (
            <p className="flex h-full items-center justify-center text-center text-xs text-gray-400">No visible menus</p>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Smartphone size={12} />
              {style === 'bottom_tabs' ? 'App content' : 'Drawer menu'}
            </div>
          )}
        </div>

        {style === 'bottom_tabs' ? (
          <div className="flex border-t border-gray-200 bg-gray-50">
            {tabs.map(({ menu }) => {
              const Icon = MENU_TYPE_REGISTRY[menu.menu_type].icon
              return (
                <div key={menu.id} className="flex flex-1 flex-col items-center gap-0.5 py-2">
                  <Icon size={16} className="text-indigo-600" />
                  <span className="max-w-full truncate px-1 text-[9px] text-gray-600">{menu.name}</span>
                </div>
              )
            })}
            {overflow.length > 0 && (
              <div className="flex flex-1 flex-col items-center gap-0.5 py-2">
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-300 text-[8px] text-gray-700">+{overflow.length}</div>
                <span className="text-[9px] text-gray-600">More</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1 border-t border-gray-200 bg-gray-50 p-2">
            {tabs.map(({ menu }) => {
              const Icon = MENU_TYPE_REGISTRY[menu.menu_type].icon
              return (
                <div key={menu.id} className="flex items-center gap-2 rounded px-2 py-1">
                  <Icon size={13} className="text-indigo-600" />
                  <span className="truncate text-[11px] text-gray-700">{menu.name}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

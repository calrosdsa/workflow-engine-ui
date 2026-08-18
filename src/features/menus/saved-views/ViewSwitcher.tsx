import { useState } from 'react'
import { ChevronDown, LayoutList, LayoutGrid, CalendarDays, Columns3, Plus, Pencil, Trash2, Star } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuGroup, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useCreateSavedView, useUpdateSavedView, useDeleteSavedView } from './hooks'
import { SaveViewDialog } from './SaveViewDialog'
import type { SavedView, SavedViewConfig, ViewLayout } from './types'
import type { FieldDef } from '@/features/forms/types'

const LAYOUT_ICON: Record<ViewLayout, typeof LayoutList> = {
  list: LayoutList, card: LayoutGrid, calendar: CalendarDays, kanban: Columns3,
}

interface ViewSwitcherProps {
  appId: string
  menuId: string
  fields: FieldDef[]
  views: SavedView[]
  /** The view currently being displayed — undefined means "ad hoc / the
   *  menu's own static default", not any saved view. */
  activeView: SavedView | undefined
  onSelect: (view: SavedView | undefined) => void
  /** The live filter/sort/columns/layout state to persist when the user
   *  chooses "Save current as new view" or updates the active view's
   *  config (not its name/visibility) via "Update this view". */
  currentConfig: SavedViewConfig
}

// FR-D2-014 §3's "View-switcher UI" element — a dropdown listing every view
// visible to this viewer (grouped My Views / Shared Views, mirroring the
// private/public split), plus Save/Update/Rename/Delete. Slots into
// SearchMenuRuntime's toolbar alongside the existing Filter toggle/Create
// button (RecordsTable.tsx's headerActions region).
export function ViewSwitcher({ appId, menuId, fields, views, activeView, onSelect, currentConfig }: ViewSwitcherProps) {
  const [dialogMode, setDialogMode] = useState<'closed' | 'create' | 'edit'>('closed')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const create = useCreateSavedView(menuId)
  const update = useUpdateSavedView(menuId)
  const del = useDeleteSavedView(menuId)

  const myViews = views.filter((v) => v.visibility === 'private')
  const sharedViews = views.filter((v) => v.visibility !== 'private')

  const ActiveIcon = activeView ? LAYOUT_ICON[activeView.config.layout] : LayoutList

  const closeDialog = () => setDialogMode('closed')

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ActiveIcon size={14} />
            {activeView?.name ?? 'Default view'}
            <ChevronDown size={12} className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64" container={document.getElementById('runtime-root')}>
          <DropdownMenuItem onSelect={() => onSelect(undefined)}>
            <LayoutList size={13} />Default view
          </DropdownMenuItem>

          {myViews.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">My Views</div>
              <DropdownMenuGroup>
                {myViews.map((v) => (
                  <ViewRow key={v.id} view={v} active={activeView?.id === v.id} onSelect={() => onSelect(v)}
                    onEdit={() => { onSelect(v); setDialogMode('edit') }}
                    onDelete={() => setConfirmDeleteId(v.id)} />
                ))}
              </DropdownMenuGroup>
            </>
          )}

          {sharedViews.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Shared Views</div>
              <DropdownMenuGroup>
                {sharedViews.map((v) => (
                  <ViewRow key={v.id} view={v} active={activeView?.id === v.id} onSelect={() => onSelect(v)}
                    onEdit={() => { onSelect(v); setDialogMode('edit') }}
                    onDelete={() => setConfirmDeleteId(v.id)} />
                ))}
              </DropdownMenuGroup>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialogMode('create')}>
            <Plus size={13} />Save current as new view
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogMode !== 'closed' && (
        <SaveViewDialog
          open
          onClose={closeDialog}
          appId={appId}
          fields={fields}
          config={currentConfig}
          editing={dialogMode === 'edit' ? activeView : undefined}
          saving={create.isPending || update.isPending}
          onSave={(payload) => {
            if (dialogMode === 'edit' && activeView) {
              update.mutate({ id: activeView.id, payload }, { onSuccess: closeDialog })
            } else {
              create.mutate(payload, { onSuccess: (created) => { onSelect(created); closeDialog() } })
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
        title="Delete this view?"
        description="This can't be undone. Anyone this view is shared with will lose access to it."
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        container={document.getElementById('runtime-root')}
        onConfirm={() => {
          if (!confirmDeleteId) return
          del.mutate(confirmDeleteId, {
            onSuccess: () => {
              if (activeView?.id === confirmDeleteId) onSelect(undefined)
              setConfirmDeleteId(null)
            },
          })
        }}
      />
    </>
  )
}

function ViewRow({ view, active, onSelect, onEdit, onDelete }: {
  view: SavedView
  active: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const Icon = LAYOUT_ICON[view.config.layout]
  return (
    <div className="group flex items-center gap-1 rounded-md px-1 hover:bg-[hsl(var(--accent))]">
      <DropdownMenuItem onSelect={onSelect} className="flex-1 justify-between hover:bg-transparent focus:bg-transparent">
        <span className="flex items-center gap-2 truncate">
          <Icon size={13} className="shrink-0" />
          <span className="truncate">{view.name}</span>
          {active && <span className="text-[10px] text-slate-400">(current)</span>}
        </span>
        {view.is_default && <Star size={11} className="shrink-0 fill-current text-amber-400" />}
      </DropdownMenuItem>
      {view.can_manage && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button onClick={(e) => { e.stopPropagation(); onEdit() }} className="rounded p-1 hover:bg-[hsl(var(--muted))]" title="Edit view">
            <Pencil size={11} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="rounded p-1 text-red-500 hover:bg-red-50" title="Delete view">
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

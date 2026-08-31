import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, ArrowLeft, Check, Redo2, Save, Undo2 } from 'lucide-react'
import '@/features/dashboard/widgets'
import { useMenu, useUpdateMenu } from '@/features/menus/hooks'
import { useDashboardStore } from '@/features/dashboard/store'
import { parseDashboardSchema } from '@/features/dashboard/serialize'
import { DashboardBuilderDnd } from '@/features/dashboard/canvas/DashboardBuilderDnd'
import { GridCanvas } from '@/features/dashboard/canvas/GridCanvas'
import { DashboardToolbox } from '@/features/dashboard/Toolbox'
import { WidgetSettingsDrawer } from '@/features/dashboard/WidgetSettingsDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { DashboardMenuConfig } from '@/features/menus/types'

interface DashboardEditorPageProps {
  appId: string
  menuId: string
}

// FR-C3-009: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z must not hijack the browser's
// own native undo/redo while the user is actually typing in a text field
// (e.g. a widget title input, or a config panel's text input) — that would
// discard the field's own edit history in favor of a dashboard-level jump,
// a materially worse experience than just not having a shortcut at all.
// Checked against the event's real target, not assumed from context, since
// focus can be anywhere when the shortcut fires.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

// Full-screen dashboard editor — the same GridCanvas/DashboardToolbox/
// WidgetSettingsDrawer trio DashboardMenuConfigPanel wires into
// MenusSection's cramped max-w-xl panel, but given the whole viewport
// instead of a squeezed inline strip. Structurally a sibling of
// WorkflowBuilderPage.tsx (header: back/name/dirty/save, Ctrl+S,
// beforeunload guard; body: toolbox | canvas | settings side-by-side) rather
// than a new pattern — dashboards are the one menu type whose builder
// (drag/resize grid + a real settings panel) needs room the inline config
// panel can't give it.
//
// The inline config panel (DashboardMenuConfigPanel, still reachable from
// MenusSection) is left as-is: a compact quick-glance/quick-add view. This
// page is the place for actually laying a dashboard out.
export function DashboardEditorPage({ appId, menuId }: DashboardEditorPageProps) {
  const navigate = useNavigate()
  const { data: menu, isLoading } = useMenu(menuId)
  const updateMutation = useUpdateMenu(menuId)

  const schema = useDashboardStore((s) => s.schema)
  const loadSchema = useDashboardStore((s) => s.loadSchema)
  const markSaved = useDashboardStore((s) => s.markSaved)
  const dirty = useDashboardStore((s) => s.dirty)
  const addWidget = useDashboardStore((s) => s.addWidget)
  const undo = useDashboardStore((s) => s.undo)
  const redo = useDashboardStore((s) => s.redo)
  const canUndo = useDashboardStore((s) => s.canUndo)
  const canRedo = useDashboardStore((s) => s.canRedo)

  const [initialised, setInitialised] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    if (menu && !initialised) {
      loadSchema(parseDashboardSchema((menu.config as DashboardMenuConfig).schema))
      setInitialised(true)
    }
  }, [menu, initialised, loadSchema])

  const isSaving = updateMutation.isPending

  const handleSave = async (): Promise<boolean> => {
    if (!menu) return false
    setSaveError(null)
    try {
      await updateMutation.mutateAsync({
        parent_id: menu.parent_id,
        menu_type: menu.menu_type,
        slug: menu.slug,
        name: menu.name,
        icon: menu.icon,
        sort_order: menu.sort_order,
        config: { ...(menu.config as DashboardMenuConfig), schema },
        required_permission: menu.required_permission,
        permission_mode: menu.permission_mode,
        required_role_ids: menu.required_role_ids,
      })
      markSaved()
      setJustSaved(true)
      return true
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
      return false
    }
  }

  const saveRef = useRef(handleSave)
  saveRef.current = handleSave

  // FR-C3-009: Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z, alongside the existing Ctrl+S
  // handler — bound once via refs to undo/redo (not included in this
  // effect's dependency array) so the listener doesn't re-bind every time
  // the undo/redo stacks change, same pattern saveRef already uses for
  // handleSave. Guarded by isEditableTarget so the browser's own native
  // undo inside a text field isn't hijacked.
  const undoRef = useRef(undo)
  undoRef.current = undo
  const redoRef = useRef(redo)
  redoRef.current = redo

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveRef.current()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (isEditableTarget(e.target)) return
        e.preventDefault()
        if (e.shiftKey) {
          redoRef.current()
        } else {
          undoRef.current()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(false), 1600)
    return () => clearTimeout(t)
  }, [justSaved])

  const handleBack = () => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return
    navigate({ to: '/applications/$appId/design', params: { appId }, search: { tab: 'menus' } })
  }

  if (isLoading || !initialised) {
    return <div className="flex h-screen items-center justify-center"><Spinner /></div>
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[hsl(var(--background))]">
      <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3">
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          onClick={handleBack}
          aria-label="Back to menus"
          title="Back to menus"
        >
          <ArrowLeft size={16} />
        </Button>

        <div className="h-5 w-px bg-[hsl(var(--border))]" />

        <div className="flex items-center gap-2">
          <Input
            value={menu?.name ?? ''}
            readOnly
            className="h-8 w-60 border-0 bg-transparent px-1.5 text-[15px] font-semibold text-[hsl(var(--foreground))] shadow-none focus-visible:ring-0"
          />
          {dirty && (
            <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--warning))]/10 px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--warning))]">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))]" />
              Unsaved
            </span>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} />
          </Button>
        </div>

        <div className="h-5 w-px bg-[hsl(var(--border))]" />

        {saveError && (
          <span className="flex items-center gap-1 rounded-md bg-[hsl(var(--destructive))]/10 px-2 py-1 text-xs text-[hsl(var(--destructive))]">
            <AlertCircle size={13} />{saveError}
          </span>
        )}

        <Button size="sm" onClick={handleSave} disabled={isSaving} title="Save (Ctrl+S)">
          {isSaving ? <Spinner className="h-4 w-4" /> : justSaved ? <Check size={13} /> : <Save size={13} />}
          {justSaved ? 'Saved' : 'Save'}
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <DashboardBuilderDnd>
          <DashboardToolbox />
          <GridCanvas clientId={appId} appId={appId} onAddFirstWidget={() => addWidget('paragraph')} />
          <WidgetSettingsDrawer clientId={appId} appId={appId} />
        </DashboardBuilderDnd>
      </div>
    </div>
  )
}

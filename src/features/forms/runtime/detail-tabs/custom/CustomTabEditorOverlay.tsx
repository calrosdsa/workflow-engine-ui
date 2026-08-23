// Full-screen visual editor for a 'custom' detail tab's widget grid — the
// Form-detail-tab equivalent of pages/applications/DashboardEditorPage.tsx,
// named explicitly as unbuilt scope in FR-D2-015 v0.3's correction #2 and in
// this tab type's own ConfigPanel comment until now. Structurally the same
// header (back/undo/redo/save) and the same
// DashboardBuilderDnd/GridCanvas/DashboardToolbox/WidgetSettingsDrawer trio
// DashboardEditorPage composes — this tab type's config IS a DashboardSchema
// (schema.ts), so the builder canvas needs no changes of its own to host it.
//
// Two differences from DashboardEditorPage, both because this editor has no
// backend endpoint of its own to save against (unlike a Menu, which has
// `PUT /menus/{id}`): (1) it's a Dialog overlay, not a route — matching
// DetailPageBuilderOverlay's own pattern, since the whole Detail Page Builder
// flow is overlay-based inside the already-loaded Form Builder; (2) "Save"
// calls onChange(schema) to patch this tab's config in the Form Builder's
// in-memory store, the same store DetailPageBuilderOverlay's other panels
// already write through — it does NOT round-trip to the backend itself. The
// Form Builder's own page-level Save button is still what ultimately
// persists it, same architecture note DetailPageBuilderOverlay's own header
// comment already documents for detailTabs/detailLayout generally.
import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, Check, LayoutDashboard, Redo2, Save, Undo2 } from 'lucide-react'
import '@/features/dashboard/widgets'
import { useDashboardStore } from '@/features/dashboard/store'
import { DashboardBuilderDnd } from '@/features/dashboard/canvas/DashboardBuilderDnd'
import { GridCanvas } from '@/features/dashboard/canvas/GridCanvas'
import { DashboardToolbox } from '@/features/dashboard/Toolbox'
import { WidgetSettingsDrawer } from '@/features/dashboard/WidgetSettingsDrawer'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuthStore } from '@/stores/auth'
import type { DashboardSchema } from '@/features/dashboard/schema'

interface CustomTabEditorOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabLabel: string
  schema: DashboardSchema
  onChange: (next: DashboardSchema) => void
}

// Same reasoning as DashboardEditorPage's identical helper: Ctrl/Cmd+Z must
// not hijack a text field's own native undo while the user is typing inside
// a widget config input.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function CustomTabEditorOverlay({ open, onOpenChange, tabLabel, schema, onChange }: CustomTabEditorOverlayProps) {
  const activeMembership = useAuthStore((s) => s.activeMembership)
  const clientId = activeMembership?.client_id
  const appId = activeMembership?.app_id

  const storeSchema = useDashboardStore((s) => s.schema)
  const loadSchema = useDashboardStore((s) => s.loadSchema)
  const markSaved = useDashboardStore((s) => s.markSaved)
  const reset = useDashboardStore((s) => s.reset)
  const dirty = useDashboardStore((s) => s.dirty)
  const addWidget = useDashboardStore((s) => s.addWidget)
  const undo = useDashboardStore((s) => s.undo)
  const redo = useDashboardStore((s) => s.redo)
  const canUndo = useDashboardStore((s) => s.canUndo)
  const canRedo = useDashboardStore((s) => s.canRedo)

  const [initialised, setInitialised] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // Loads this tab's own schema into the (module-singleton) dashboard store
  // on open, and resets the store on close — this overlay is the only thing
  // that mounts the dashboard builder canvas at a time (same single-editor
  // assumption DashboardEditorPage itself relies on), but clearing on close
  // still matters: without it, re-opening a DIFFERENT custom tab (or the
  // real DashboardEditorPage, later in the same session) would briefly show
  // this tab's stale schema before its own load effect ran.
  useEffect(() => {
    if (open && !initialised) {
      loadSchema(schema)
      setInitialised(true)
    }
    if (!open && initialised) {
      reset()
      setInitialised(false)
    }
  }, [open, initialised, schema, loadSchema, reset])

  const handleSave = () => {
    onChange(storeSchema)
    markSaved()
    setJustSaved(true)
  }

  const saveRef = useRef(handleSave)
  saveRef.current = handleSave

  const undoRef = useRef(undo)
  undoRef.current = undo
  const redoRef = useRef(redo)
  redoRef.current = redo

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
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
  }, [open])

  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(false), 1600)
    return () => clearTimeout(t)
  }, [justSaved])

  const handleBack = () => {
    if (dirty && !window.confirm('You have unsaved changes to this tab. Leave without saving?')) return
    onOpenChange(false)
  }

  if (!clientId || !appId) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleBack(); else onOpenChange(o) }}>
      <DialogContent
        className="left-0 top-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0"
      >
        <DialogTitle className="sr-only">{tabLabel} — Custom Tab Editor</DialogTitle>
        <DialogDescription className="sr-only">
          Arrange this tab's widget grid — the same widgets a Dashboard menu uses.
        </DialogDescription>

        {!initialised ? (
          <div className="flex h-screen items-center justify-center"><Spinner /></div>
        ) : (
          <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
            <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 shadow-sm">
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 text-slate-500 hover:text-slate-700"
                onClick={handleBack}
                title="Back to Detail Page Builder"
              >
                <ArrowLeft size={16} />
              </Button>

              <div className="h-5 w-px bg-slate-200" />

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
                <LayoutDashboard size={16} className="text-white" />
              </div>

              <div className="flex items-center gap-2">
                <p className="px-1.5 text-[15px] font-semibold text-slate-800">{tabLabel}</p>
                {dirty && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Unsaved
                  </span>
                )}
              </div>

              <div className="flex-1" />

              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-slate-500 hover:text-slate-700 disabled:opacity-30"
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={16} />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-slate-500 hover:text-slate-700 disabled:opacity-30"
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Redo2 size={16} />
                </Button>
              </div>

              <div className="h-5 w-px bg-slate-200" />

              <Button size="sm" onClick={handleSave} title="Apply to this tab (Ctrl+S)">
                {justSaved ? <Check size={13} /> : <Save size={13} />}
                {justSaved ? 'Applied' : 'Apply'}
              </Button>
            </header>

            <div className="flex items-center gap-1.5 border-b border-amber-100 bg-amber-50/60 px-3 py-1.5 text-[11px] text-amber-700">
              <AlertCircle size={12} className="shrink-0" />
              Applying here updates this tab's configuration — use the Form Builder's own Save to persist it.
            </div>

            <div className="flex flex-1 overflow-hidden">
              <DashboardBuilderDnd>
                <DashboardToolbox />
                <GridCanvas clientId={clientId} appId={appId} onAddFirstWidget={() => addWidget('paragraph')} />
                <WidgetSettingsDrawer clientId={clientId} appId={appId} />
              </DashboardBuilderDnd>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, ArrowLeft, Check, Redo2, Save, Undo2 } from 'lucide-react'
import '@/features/reports/blocks'
import { useReport, useUpdateReport } from '@/features/reports/hooks'
import { useReportStore } from '@/features/reports/store'
import { pruneIncompleteFilters } from '@/features/reports/data-sources'
import { UniverWorkbookSurface, type WorkbookSurfaceHandle } from '@/features/reports/workbook/UniverWorkbookSurface'
import { WorkbookRegionsPanel } from '@/features/reports/workbook/WorkbookRegionsPanel'
import { ReportSettingsPanel } from '@/features/reports/ReportSettingsPanel'
import { PreviewButton } from '@/features/reports/PreviewButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

interface ReportBuilderPageProps {
  appId: string
  reportId: string
}

// Direct structural mirror of DashboardEditorPage.tsx (same header/undo-
// redo/beforeunload/Ctrl+S pattern) — see that file's own extensive
// comments for the full rationale, not re-derived here. The one real
// difference: this page's fetch/save goes through useReport/useUpdateReport
// (the minimal report-definitions CRUD API, api/reports/handler.go) instead
// of useMenu/useUpdateMenu, since a report is its own first-class resource,
// not a Menu subtype (FR-J1-003 §8, Assumption 1's resolution).
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

function isWorkbookTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-report-workbook]') !== null
}

export function ReportBuilderPage({ appId, reportId }: ReportBuilderPageProps) {
  const navigate = useNavigate()
  const { data: report, isLoading } = useReport(reportId)
  const updateMutation = useUpdateReport(reportId)

  const definition = useReportStore((s) => s.definition)
  const loadDefinition = useReportStore((s) => s.loadDefinition)
  const markSaved = useReportStore((s) => s.markSaved)
  const markDirty = useReportStore((s) => s.markDirty)
  const dirty = useReportStore((s) => s.dirty)
  const updateName = useReportStore((s) => s.updateName)
  const undo = useReportStore((s) => s.undo)
  const redo = useReportStore((s) => s.redo)
  const syncWorkbookSnapshot = useReportStore((s) => s.syncWorkbookSnapshot)
  const canUndo = useReportStore((s) => s.canUndo)
  const canRedo = useReportStore((s) => s.canRedo)

  const [loadedReportId, setLoadedReportId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const workbookSurfaceRef = useRef<WorkbookSurfaceHandle>(null)
  const workbookNeedsSyncRef = useRef(false)
  const handleWorkbookEdited = useCallback(() => {
    workbookNeedsSyncRef.current = true
    markDirty()
  }, [markDirty])

  useEffect(() => {
    if (report && report.id === reportId && loadedReportId !== reportId) {
      loadDefinition(report.definition)
      workbookNeedsSyncRef.current = false
      setLoadedReportId(reportId)
    }
  }, [report, reportId, loadedReportId, loadDefinition])

  const isSaving = updateMutation.isPending

  const handleSave = async (): Promise<boolean> => {
    if (!report) return false
    setSaveError(null)
    const workbook = workbookSurfaceRef.current?.save()
    // Strips filter conditions whose field is still unset — the state a data
    // source is in between clicking "+ Condition" and choosing the field.
    // The backend rejects those outright, so without this an author cannot
    // save mid-edit (see pruneIncompleteFilters).
    const definitionToSave = pruneIncompleteFilters(workbook ? { ...definition, version: 2, workbook } : definition)
    try {
      await updateMutation.mutateAsync({ name: definitionToSave.name, definition: definitionToSave })
      const latestWorkbook = workbookSurfaceRef.current?.save()
      const latestDefinition = latestWorkbook
        ? { ...useReportStore.getState().definition, version: 2, workbook: latestWorkbook }
        : useReportStore.getState().definition
      if (latestWorkbook) {
        syncWorkbookSnapshot(latestWorkbook)
        workbookNeedsSyncRef.current = false
      }

      if (JSON.stringify(latestDefinition) === JSON.stringify(definitionToSave)) {
        markSaved()
        setJustSaved(true)
      } else {
        // The request succeeded for its original snapshot, but newer edits
        // still need another Save and must retain unload protection.
        markDirty()
        setJustSaved(false)
      }
      return true
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
      return false
    }
  }

  // Definition edits refresh the workbook adapter. Capture author-owned cells
  // first so a name, setting, or semantic-region change cannot replace an
  // unsaved formula, merge, or formatting change with the older store copy.
  const synchronizeWorkbookBeforeDefinitionChange = () => {
    if (!workbookNeedsSyncRef.current) return
    const workbook = workbookSurfaceRef.current?.save()
    if (!workbook) return
    syncWorkbookSnapshot(workbook)
    workbookNeedsSyncRef.current = false
  }

  const runHistoryActionPreservingWorkbook = (action: () => void) => {
    const workbook = workbookSurfaceRef.current?.save()
    action()
    if (workbook) {
      syncWorkbookSnapshot(workbook)
      workbookNeedsSyncRef.current = false
    }
  }

  const handleUndo = () => runHistoryActionPreservingWorkbook(undo)
  const handleRedo = () => runHistoryActionPreservingWorkbook(redo)

  const saveRef = useRef(handleSave)
  saveRef.current = handleSave

  const undoRef = useRef(handleUndo)
  undoRef.current = handleUndo
  const redoRef = useRef(handleRedo)
  redoRef.current = handleRedo

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveRef.current()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        // Univer owns spreadsheet history while focus is inside its surface.
        // Report history remains available from the header buttons.
        if (isWorkbookTarget(e.target)) return
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
    navigate({ to: '/applications/$appId/configuration', params: { appId }, search: { tab: 'reports' } })
  }

  if (isLoading || loadedReportId !== reportId) {
    return <div className="flex h-screen items-center justify-center"><Spinner /></div>
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[hsl(var(--background))]">
      <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3">
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          onClick={handleBack}
          aria-label="Back to reports"
          title="Back to reports"
        >
          <ArrowLeft size={16} />
        </Button>

        <div className="h-5 w-px bg-[hsl(var(--border))]" />

        <div className="flex items-center gap-2">
          <Input
            value={definition.name}
            onChange={(e) => {
              synchronizeWorkbookBeforeDefinitionChange()
              updateName(e.target.value)
            }}
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
            onClick={handleUndo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30"
            onClick={handleRedo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} />
          </Button>
        </div>

        <div className="h-5 w-px bg-[hsl(var(--border))]" />

        <PreviewButton />

        <ReportSettingsPanel onBeforeChange={synchronizeWorkbookBeforeDefinitionChange} />

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
        <UniverWorkbookSurface
          key={reportId}
          ref={workbookSurfaceRef}
          definition={definition}
          onEdited={handleWorkbookEdited}
          onBeforeChange={synchronizeWorkbookBeforeDefinitionChange}
        />
        <WorkbookRegionsPanel
          getSelection={() => workbookSurfaceRef.current?.getSelection()}
          onBeforeChange={synchronizeWorkbookBeforeDefinitionChange}
        />
      </div>
    </div>
  )
}

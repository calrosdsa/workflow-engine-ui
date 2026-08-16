import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { AlertCircle, AlertTriangle, ArrowLeft, Braces, Check, CheckCircle, History, Play, Save, Workflow, X } from 'lucide-react'
import { useWorkflow, useCreateWorkflow, useUpdateWorkflow } from '@/features/workflows/hooks'
import { useTriggerExecution, useExecution } from '@/features/executions/hooks'
import { useBuilderStore } from '@/features/workflows/builder/store'
import { useExecutionOverlayStore } from '@/features/workflows/builder/execution-overlay-store'
import { nodeSetupIssue } from '@/features/workflows/builder/node-validation'
import { VariablesPanel } from '@/features/workflows/builder/VariablesPanel'
import { NodeConfigPanel } from '@/features/workflows/builder/NodeConfigPanel'
import { ExecutionsSidebar, statusDot } from '@/features/workflows/builder/ExecutionsSidebar'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { FlowLayout } from '../test/Layout'

// True when the event originates inside a text-entry control.
function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return (
    t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.tagName === 'SELECT' ||
    t.isContentEditable
  )
}

export type BuilderMode = 'new' | 'edit'

interface WorkflowBuilderPageProps {
  mode: BuilderMode
}

export function WorkflowBuilderPage({ mode }: WorkflowBuilderPageProps) {
  const navigate = useNavigate()
  const params   = useParams({ strict: false }) as { appId?: string; workflowId?: string }
  const appId    = params.appId ?? ''
  const id       = mode === 'edit' ? (params.workflowId ?? '') : ''

  const { data: existing, isLoading } = useWorkflow(id)

  const {
    loadDefinition, seedNew, toDefinition, name, setName,
    isDirty, markSaved, nodes, selectNode,
    executionsPanelOpen, toggleExecutionsPanel,
    varsPanelOpen, toggleVarsPanel,
  } = useBuilderStore()

  const createMutation  = useCreateWorkflow()
  const updateMutation  = useUpdateWorkflow(id)
  const triggerMutation = useTriggerExecution()

  const [saveError,   setSaveError]   = useState<string | null>(null)
  const [triggeredId, setTriggeredId] = useState<string | null>(null)
  const [initialised, setInitialised] = useState(false)
  const [justSaved,   setJustSaved]   = useState(false)

  const clearOverlay = useExecutionOverlayStore((s) => s.select)
  const selectedExecutionId = useExecutionOverlayStore((s) => s.selectedExecutionId)
  const setOverlayData = useExecutionOverlayStore((s) => s.setData)

  // Selecting a different workflow (or leaving edit mode) must not carry a
  // stale overlay selection over — it would silently reference node IDs on
  // whatever graph happens to load next (FR-C5-007, edge case).
  useEffect(() => {
    clearOverlay(null)
  }, [id, clearOverlay])

  // Single fetch for whichever execution the sidebar has selected — resolved
  // centrally here and pushed into the overlay store so every BaseNode/
  // CustomEdge instance reads the same object instead of each independently
  // polling the same endpoint (existing 2s-poll-until-terminal hook, unchanged).
  const { data: overlayExecution } = useExecution(selectedExecutionId ?? '')
  useEffect(() => {
    // Defensive check (FR-C5-007 edge case): an execution belonging to a
    // different workflow than the one currently open must never overlay
    // mismatched node IDs onto this canvas.
    if (selectedExecutionId && overlayExecution?.workflow_definition_id === id) {
      setOverlayData(overlayExecution)
    } else if (!selectedExecutionId) {
      setOverlayData(null)
    }
  }, [selectedExecutionId, overlayExecution, id, setOverlayData])

  // Load existing definition into the store once
  useEffect(() => {
    if (mode === 'new' && !initialised) {
      seedNew()
      setInitialised(true)
    }
    if (mode === 'edit' && existing && !initialised) {
      loadDefinition(existing.id, existing.name, existing.definition)
      setInitialised(true)
    }
  }, [mode, existing, initialised, loadDefinition, seedNew])

  // Nodes that still need configuration before the workflow can run.
  const setupIssues = useMemo(
    () => nodes
      .map((n) => ({ id: n.id, label: n.data.label, issue: nodeSetupIssue(n.data) }))
      .filter((x): x is { id: string; label: string; issue: string } => x.issue !== null),
    [nodes],
  )

  const isSaving = createMutation.isPending || updateMutation.isPending

  // Returns true on success so Run can chain off it.
  const handleSave = async (): Promise<boolean> => {
    setSaveError(null)
    const def = toDefinition()
    const payload = { name, definition: def }
    try {
      if (mode === 'new') {
        const created = await createMutation.mutateAsync(payload)
        markSaved()
        navigate({ to: '/applications/$appId/workflows/$workflowId', params: { appId, workflowId: created.id } })
      } else {
        await updateMutation.mutateAsync(payload)
        markSaved()
      }
      setJustSaved(true)
      return true
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
      return false
    }
  }

  // Latest save handler behind a stable ref so the window-level Ctrl+S
  // listener binds once instead of re-binding every render.
  const saveRef = useRef(handleSave)
  saveRef.current = handleSave

  // Ctrl+S / Cmd+S saves from anywhere in the builder. Still intercepts the
  // browser's native save-page shortcut even while typing (that dialog is
  // more disruptive than a no-op keystroke), but only triggers our own save
  // outside editable targets, matching the sibling undo/redo/delete handler's
  // guard (Layout.tsx) instead of firing mid-keystroke in a text field.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (isEditableTarget(e.target)) return
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Warn before the tab closes with unsaved changes.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Clear the transient "Saved" state after a moment.
  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(false), 1600)
    return () => clearTimeout(t)
  }, [justSaved])

  if (mode === 'edit' && isLoading) {
    return <div className="flex h-screen items-center justify-center"><Spinner /></div>
  }

  // Run executes the SAVED definition, so unsaved edits are saved first.
  const handleRun = async () => {
    if (!id) return
    if (isDirty) {
      const ok = await handleSave()
      if (!ok) return
    }
    triggerMutation.mutate(id, { onSuccess: (r) => setTriggeredId(r.execution_id) })
  }

  const handleBack = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Leave without saving?')) return
    navigate({ to: '/applications/$appId/workflows', params: { appId } })
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 shadow-sm">
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 text-slate-500 hover:text-slate-700"
          onClick={handleBack}
          title="Back to workflows"
        >
          <ArrowLeft size={16} />
        </Button>

        <div className="h-5 w-px bg-slate-200" />

        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
          <Workflow size={16} className="text-white" />
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-60 border-0 bg-transparent px-1.5 text-[15px] font-semibold text-slate-800 shadow-none focus-visible:bg-slate-50 focus-visible:ring-0"
            placeholder="Workflow name…"
          />
          {isDirty && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Unsaved
            </span>
          )}
        </div>

        <div className="flex-1" />

        {saveError && (
          <span className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-600">
            <AlertCircle size={13} />{saveError}
          </span>
        )}

        {setupIssues.length > 0 && (
          <button
            onClick={() => selectNode(setupIssues[0].id)}
            className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 transition-colors hover:bg-amber-100"
            title={`${setupIssues[0].label}: ${setupIssues[0].issue} — click to open`}
          >
            <AlertTriangle size={12} />
            {setupIssues.length} to set up
          </button>
        )}

        {triggeredId && (
          <button
            onClick={() => navigate({ to: '/applications/$appId/executions/$executionId', params: { appId, executionId: triggeredId } })}
            className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <CheckCircle size={13} />Execution running
          </button>
        )}

        {mode === 'edit' && (
          <Button variant="outline" size="sm" onClick={handleRun} disabled={triggerMutation.isPending || isSaving}>
            {triggerMutation.isPending ? <Spinner className="h-4 w-4" /> : <Play size={13} />}
            {isDirty ? 'Save & Run' : 'Run'}
          </Button>
        )}

        <Button
          variant={varsPanelOpen ? 'secondary' : 'outline'}
          size="sm"
          onClick={toggleVarsPanel}
          title="View workflow variables"
        >
          <Braces size={13} />Variables
        </Button>

        {mode === 'edit' && (
          <div className="flex items-center gap-1">
            <Button
              variant={executionsPanelOpen ? 'secondary' : 'outline'}
              size="sm"
              onClick={toggleExecutionsPanel}
              title="View execution history"
            >
              <History size={13} />Executions
            </Button>

            {/* Selected-execution chip — shows which run is overlaid on the
                canvas even while the Executions sidebar itself is closed
                (FR-C5-007's overlay deliberately survives the sidebar
                closing, per FR-C5-008), with a one-click way to clear it
                without reopening the sidebar. */}
            {selectedExecutionId && (
              <span className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2 pr-1 text-[11px] font-medium text-slate-600">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', overlayExecution ? statusDot[overlayExecution.status] : 'bg-slate-300')} />
                <span className="font-mono">{selectedExecutionId.slice(0, 8)}</span>
                <button
                  onClick={() => clearOverlay(null)}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                  title="Clear selected execution"
                >
                  <X size={10} strokeWidth={2.75} />
                </button>
              </span>
            )}
          </div>
        )}

        <Button size="sm" onClick={handleSave} disabled={isSaving} title="Save (Ctrl+S)">
          {isSaving ? <Spinner className="h-4 w-4" /> : justSaved ? <Check size={13} /> : <Save size={13} />}
          {mode === 'new' ? 'Create' : justSaved ? 'Saved' : 'Save'}
        </Button>
      </header>

      {/* ── Main layout ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <VariablesPanel />
        <FlowLayout />
        <NodeConfigPanel />
        {mode === 'edit' && <ExecutionsSidebar workflowId={id} />}
      </div>
    </div>
  )
}

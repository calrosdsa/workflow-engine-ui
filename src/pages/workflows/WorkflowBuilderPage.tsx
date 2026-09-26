import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, ArrowLeft, Check, GitCommitHorizontal, Play, Save, Settings2, X } from 'lucide-react'
import { useWorkflow, useCreateWorkflow, useUpdateWorkflow } from '@/features/workflows/hooks'
import { useTriggerExecution, useExecution, useExecutionLogs } from '@/features/executions/hooks'
import { useBuilderStore } from '@/features/workflows/builder/store'
import { useExecutionOverlayStore } from '@/features/workflows/builder/execution-overlay-store'
import { computeLogOrder } from '@/features/workflows/builder/executionOrder'
import { nodeSetupIssue } from '@/features/workflows/builder/node-validation'
import { VariablesPanel } from '@/features/workflows/builder/VariablesPanel'
import { OutlinePanel } from '@/features/workflows/builder/OutlinePanel'
import { NodeConfigPanel } from '@/features/workflows/builder/NodeConfigPanel'
import { ExecutionsSidebar } from '@/features/workflows/builder/ExecutionsSidebar'
import { EvaluationsSidebar } from '@/features/workflows/builder/EvaluationsSidebar'
import { ExecutionLogsDock, DOCK_LOGS_PAGE_SIZE } from '@/features/workflows/builder/ExecutionLogsDock'
import { CanvasOverlayContext } from '@/features/workflows/builder/canvas-overlay'
import { WorkflowSetupDrawer } from '@/features/workflows/builder/WorkflowSetupDrawer'
import { WorkflowLifecycleDrawer } from '@/features/workflows/builder/WorkflowLifecycleDrawer'
import { TriggerOnboardingModal } from '@/features/workflows/builder/TriggerOnboardingModal'
import { WORKFLOW_COMMAND_EVENT, type WorkflowCommandId } from '@/features/workflows/builder/workflow-command-model'
import { useEnvironmentLinkStatus } from '@/features/environment/hooks'
import { useApplication } from '@/features/applications/hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { ExecutionStatus } from '@/features/executions/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { FlowLayout } from '../test/Layout'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/b612-mono/400.css'
import '@fontsource/b612-mono/700.css'
import './workflow-builder.css'

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

// The header's run chip shows the selected run's outcome on the same lamp
// the plates use (workflow-builder.css `.workflow-node-lamp`).
const runChipLamp: Record<ExecutionStatus, string> = {
  PENDING: 'running', RUNNING: 'running', COMPLETED: 'completed', FAILED: 'failed', CANCELLED: 'off',
}

export type BuilderMode = 'new' | 'edit'

interface WorkflowBuilderPageProps {
  mode: BuilderMode
}

export function WorkflowBuilderPage({ mode }: WorkflowBuilderPageProps) {
  const t = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const params   = useParams({ strict: false }) as { appId?: string; workflowId?: string }
  const appId    = params.appId ?? ''
  const id       = mode === 'edit' ? (params.workflowId ?? '') : ''

  const { data: existing, isLoading } = useWorkflow(id)

  // Marks <html> while the editor is open so the Signal box palette and type
  // (index.css `[data-surface='workflow-editor']`) also reach popovers,
  // menus and selects, which portal to <body> outside this component.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.surface = 'workflow-editor'
    return () => { delete root.dataset.surface }
  }, [])
  const { data: application } = useApplication()
  const { data: envStatus } = useEnvironmentLinkStatus()
  const isLockedProduction = envStatus?.linked && envStatus.role === 'production'

  const {
    loadDefinition, seedNew, toDefinition, name, setName,
    isDirty, markSaved, nodes,
    outlinePanelOpen, toggleOutlinePanel,
    executionsPanelOpen, toggleExecutionsPanel,
    evaluationsPanelOpen, toggleEvaluationsPanel,
    varsPanelOpen, toggleVarsPanel, closeActiveSidebar,
  } = useBuilderStore()

  const createMutation  = useCreateWorkflow()
  const updateMutation  = useUpdateWorkflow(id)
  const triggerMutation = useTriggerExecution()

  const [saveError,   setSaveError]   = useState<string | null>(null)
  const [triggeredId, setTriggeredId] = useState<string | null>(null)
  const [initialised, setInitialised] = useState(false)
  const [justSaved,   setJustSaved]   = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [lifecycleOpen, setLifecycleOpen] = useState(false)
  // Shown once for a brand-new workflow only — never for an existing one
  // reopened via mode 'edit'. seedNew() below leaves the canvas genuinely
  // empty; this modal's own choice is what creates the singleton Trigger
  // node (store.ts's applyTriggerConfig) — it also overlays the canvas so
  // none of its "add a step" affordances are reachable before that happens.
  const [onboardingOpen, setOnboardingOpen] = useState(false)

  const clearOverlay = useExecutionOverlayStore((s) => s.select)
  const selectOverlay = useExecutionOverlayStore((s) => s.setSelected)
  const selectedExecutionId = useExecutionOverlayStore((s) => s.selectedExecutionId)
  const setOverlayData = useExecutionOverlayStore((s) => s.setData)
  const setLogOrder = useExecutionOverlayStore((s) => s.setLogOrder)
  const setLogsDockOpen = useExecutionOverlayStore((s) => s.setLogsDockOpen)

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

  // Real chronological node order for the canvas's per-execution mode switch
  // (FR-C5-007). Enabled only while the canvas overlay is actively showing a
  // selected execution — this is the one other place besides a mounted Logs
  // panel allowed to call useExecutionLogs (see that hook's own doc comment
  // on why it's opt-in). pageSize: 200 (the endpoint's cap) so ordering
  // covers the whole run, not just its first page; no mid-run polling
  // because this is a "compute the order" fetch, not a live view — the
  // badge's own duration text still updates live via useExecution's
  // existing 2s poll above.
  const overlayLogsEnabled = !!selectedExecutionId && overlayExecution?.workflow_definition_id === id
  const { data: overlayLogs } = useExecutionLogs(
    selectedExecutionId ?? undefined,
    // page: 1 spelled out so these params match the Logs dock's first page
    // exactly — same query key, one shared fetch.
    { page: 1, pageSize: DOCK_LOGS_PAGE_SIZE },
    // No polling mid-run (pollWhileRunning: false), but status/finishedAt
    // still let it settle once the run ends — a run selected while in flight
    // ends up ordered from its complete rows — and then mark those rows
    // immutable, so a window refocus never re-downloads up to 200
    // payload-carrying rows.
    {
      enabled: overlayLogsEnabled,
      executionStatus: overlayExecution?.status,
      finishedAt: overlayExecution?.finished_at,
      pollWhileRunning: false,
    },
  )
  useEffect(() => {
    if (overlayLogsEnabled && overlayLogs) {
      setLogOrder(computeLogOrder(overlayLogs.logs))
    } else if (!selectedExecutionId) {
      setLogOrder(null)
    }
  }, [overlayLogsEnabled, overlayLogs, selectedExecutionId, setLogOrder])

  // The bottom Logs dock only ever shows a run confirmed to belong to this
  // workflow (same FR-C5-007 guard as the overlay above).
  const [canvasOverlay, setCanvasOverlay] = useState<HTMLDivElement | null>(null)
  const dockExecution = overlayLogsEnabled ? overlayExecution ?? null : null
  const dockLoading = !!selectedExecutionId && !overlayExecution
  const nodeLabels = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, n.data.label])),
    [nodes],
  )

  // Tracks the run just triggered from this page's own Run button —
  // independent of selectedExecutionId (the sidebar/overlay's own, possibly
  // unrelated, selection). Polls in the background (useExecution's existing
  // 2s-until-terminal behavior) without blocking the canvas; only once it
  // reaches COMPLETED or FAILED does the Logs dock expand, selected on that
  // run (n8n's behavior after a manual run), so a long-running workflow never
  // traps the user behind a loader — they keep editing, and the dock
  // surfaces the result when it's actually ready.
  const { data: triggeredExecution } = useExecution(triggeredId ?? '')
  const isTriggeredRunning = !!triggeredId && (!triggeredExecution || triggeredExecution.status === 'PENDING' || triggeredExecution.status === 'RUNNING')
  useEffect(() => {
    if (!triggeredId || !triggeredExecution) return
    if (triggeredExecution.status === 'COMPLETED' || triggeredExecution.status === 'FAILED') {
      // The sidebar's own row list (useExecutions) isn't on a poll — it was
      // last fetched when the run started (still PENDING/RUNNING then), so
      // without this it would keep showing this row as running indefinitely
      // even though the individual useExecution(triggeredId) poll above
      // already knows the real terminal status.
      qc.invalidateQueries({ queryKey: ['executions'] })
      selectOverlay(triggeredId)
      setLogsDockOpen(true)
      setTriggeredId(null)
    }
  }, [triggeredId, triggeredExecution, selectOverlay, setLogsDockOpen, qc])

  // Load existing definition into the store once
  useEffect(() => {
    if (mode === 'new' && !initialised) {
      seedNew()
      setInitialised(true)
      setOnboardingOpen(true)
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

  // Run executes the SAVED definition, so unsaved edits are saved first.
  const handleRun = async () => {
    if (!id) return
    if (isDirty) {
      const ok = await handleSave()
      if (!ok) return
    }
    triggerMutation.mutate(id, { onSuccess: (r) => setTriggeredId(r.execution_id) })
  }
  const runRef = useRef(handleRun)
  runRef.current = handleRun

  const handleBack = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Leave without saving?')) return
    navigate({ to: '/applications/$appId/workflows', params: { appId } })
  }

  // Canvas-level commands are registered in FlowLayout, while workflow
  // mutations live here with the real save/run lifecycle. A small DOM event
  // bridge keeps one searchable command vocabulary without prop-drilling page
  // mutations through React Flow's renderer.
  useEffect(() => {
    const handler = (event: Event) => {
      const id = (event as CustomEvent<WorkflowCommandId>).detail
      if (id === 'save-workflow') void saveRef.current()
      if (id === 'run-workflow') void runRef.current()
      if (id === 'open-setup') setSetupOpen(true)
      if (id === 'open-lifecycle' || id === 'checkpoint') setLifecycleOpen(true)
    }
    window.addEventListener(WORKFLOW_COMMAND_EVENT, handler)
    return () => window.removeEventListener(WORKFLOW_COMMAND_EVENT, handler)
  }, [])

  if (mode === 'edit' && isLoading) {
    return <div className="flex h-screen items-center justify-center"><Spinner /></div>
  }

  return (
    <div className="workflow-builder-shell flex h-screen flex-col overflow-hidden bg-[hsl(var(--background))]">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="workflow-builder-header sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 px-3">
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          onClick={handleBack}
          title={t('workflows.builder.header.back')}
          aria-label={t('workflows.builder.header.back')}
        >
          <ArrowLeft size={16} />
        </Button>

        <div className="h-5 w-px bg-[hsl(var(--border))]" />

        <div className="flex min-w-0 items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="workflow-builder-name-input h-8 border-0 bg-transparent px-1.5 shadow-none focus-visible:bg-[hsl(var(--muted))] focus-visible:ring-0"
            placeholder={t('workflows.builder.header.name_placeholder')}
            aria-label={t('workflows.builder.header.name_label')}
          />
          {isDirty && (
            <span className="workflow-builder-unsaved">
              <span aria-hidden="true" />
              {t('common.unsaved')}
            </span>
          )}
        </div>

        <nav className="workflow-builder-tabs" aria-label={t('workflows.builder.header.views')}>
          <button
            type="button"
            className="workflow-builder-tab"
            data-active={!outlinePanelOpen && !executionsPanelOpen && !varsPanelOpen && !evaluationsPanelOpen}
            onClick={closeActiveSidebar}
          >
            {t('workflows.builder.header.editor')}
          </button>
          <button
            type="button"
            className="workflow-builder-tab"
            data-active={outlinePanelOpen}
            onClick={toggleOutlinePanel}
            title={t('workflows.builder.header.outline_hint')}
          >
            {t('workflows.outline.title')}
          </button>
          <button
            type="button"
            className="workflow-builder-tab"
            data-active={executionsPanelOpen}
            onClick={toggleExecutionsPanel}
            disabled={mode !== 'edit'}
            title={mode === 'edit' ? t('workflows.builder.header.executions_hint') : t('workflows.builder.header.executions_unsaved')}
          >
            {t('executions.title')}
          </button>
          <button
            type="button"
            className="workflow-builder-tab"
            data-active={varsPanelOpen}
            onClick={toggleVarsPanel}
          >
            {t('workflows.variables.title')}
          </button>
          <button
            type="button"
            className="workflow-builder-tab"
            data-active={evaluationsPanelOpen}
            onClick={toggleEvaluationsPanel}
            disabled={mode !== 'edit'}
            title={mode === 'edit' ? t('workflows.builder.header.evaluations_hint') : t('workflows.builder.header.evaluations_unsaved')}
          >
            {t('workflows.evaluations.sidebar.title')}
          </button>
        </nav>

        <div className="workflow-builder-header-actions flex min-w-0 flex-1 items-center justify-end gap-2">

        {saveError && (
          <span className="flex items-center gap-1 rounded-md bg-[hsl(var(--destructive))]/10 px-2 py-1 text-xs text-[hsl(var(--destructive))]">
            <AlertCircle size={13} />{saveError}
          </span>
        )}

        {mode === 'edit' && (
          <Button variant="outline" size="sm" onClick={() => setSetupOpen(true)} title={t('workflows.builder.header.setup_hint')}>
            <Settings2 size={13} />
            <span className="hidden xl:inline">{t('workflows.builder.header.setup')}</span>
          </Button>
        )}

        {mode === 'edit' && (
          <Button variant="outline" size="sm" onClick={() => setLifecycleOpen(true)} title={t('workflows.builder.header.lifecycle_hint')}>
            <GitCommitHorizontal size={13} />
            <span className="hidden xl:inline">
              {isDirty
                ? t('workflows.builder.header.draft')
                : application?.published_version != null
                  ? t('workflows.builder.header.live_version', { version: application.published_version })
                  : t('workflows.builder.header.lifecycle')}
            </span>
          </Button>
        )}

        {setupIssues.length > 0 && (
          <button
            onClick={() => setSetupOpen(true)}
            className="workflow-builder-setup-count"
            title={`${setupIssues[0].label}: ${setupIssues[0].issue}`}
          >
            <AlertTriangle size={12} />
            {t('workflows.builder.header.to_set_up', { count: setupIssues.length })}
          </button>
        )}

        {/* Small, dismissible, non-blocking — the canvas stays fully
            editable while this run is in flight. It clears itself once the
            run reaches COMPLETED/FAILED (the effect above expands the Logs
            dock at that point instead), so this chip only shows for
            genuinely in-progress runs, not finished ones. */}
        {isTriggeredRunning && (
          <span className="workflow-builder-running">
            <span className="workflow-node-lamp" data-lamp="running" aria-hidden="true" />
            {t('workflows.builder.header.running')}
            <button
              onClick={() => setTriggeredId(null)}
              className="flex h-4 w-4 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
              title={t('common.dismiss')}
              aria-label={t('common.dismiss')}
            >
              <X size={10} strokeWidth={2.75} />
            </button>
          </span>
        )}

        {mode === 'edit' && (
          <Button variant="outline" size="sm" onClick={handleRun} disabled={triggerMutation.isPending || isSaving}>
            {triggerMutation.isPending ? <Spinner className="h-4 w-4" /> : <Play size={13} />}
            {isDirty ? t('workflows.builder.header.save_and_run') : t('common.run')}
          </Button>
        )}

        {mode === 'edit' && (
          <div className="flex items-center gap-1">
            {/* Selected-execution chip — shows which run is overlaid on the
                canvas even while the Executions sidebar itself is closed
                (FR-C5-007's overlay deliberately survives the sidebar
                closing, per FR-C5-008), with a one-click way to clear it
                without reopening the sidebar. */}
            {selectedExecutionId && (
              <span className="workflow-builder-run-chip">
                <span
                  className="workflow-node-lamp"
                  data-lamp={overlayExecution ? runChipLamp[overlayExecution.status] : 'off'}
                  aria-hidden="true"
                />
                <span className="font-mono">{selectedExecutionId.slice(0, 8)}</span>
                <button
                  onClick={() => clearOverlay(null)}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted-foreground))]/20 hover:text-[hsl(var(--foreground))]"
                  title={t('workflows.builder.header.clear_run')}
                  aria-label={t('workflows.builder.header.clear_run')}
                >
                  <X size={10} strokeWidth={2.75} />
                </button>
              </span>
            )}
          </div>
        )}

        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || isLockedProduction}
          title={isLockedProduction ? t('workflows.builder.header.locked_production') : t('workflows.builder.header.save_hint')}
        >
          {isSaving ? <Spinner className="h-4 w-4" /> : justSaved ? <Check size={13} /> : <Save size={13} />}
          {mode === 'new' ? t('common.create') : justSaved ? t('common.saved') : t('common.save')}
        </Button>
        </div>
      </header>

      {/* ── Main layout ──────────────────────────────────────────────── */}
      {/* n8n's arrangement: the executions list sits left of the canvas, and
          the Logs dock sits under the canvas only (not under the side
          panels). Every level of the canvas column carries min-h-0 so React
          Flow gets a definite, shrinkable height as the dock grows. */}
      <div className="workflow-builder-main relative flex flex-1 overflow-hidden">
        <OutlinePanel open={outlinePanelOpen} onToggle={toggleOutlinePanel} />
        <VariablesPanel />
        {mode === 'edit' && <ExecutionsSidebar workflowId={id} />}
        {mode === 'edit' && <EvaluationsSidebar workflowId={id} />}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <CanvasOverlayContext.Provider value={canvasOverlay}>
            <div className="relative flex min-h-0 flex-1">
              <FlowLayout />
            </div>
          </CanvasOverlayContext.Provider>
          {mode === 'edit' && <ExecutionLogsDock execution={dockExecution} loading={dockLoading} nodeLabels={nodeLabels} />}
          {/* Where the canvas's own overlays (node picker, Ctrl+K command bar)
              mount, spanning canvas AND dock. z-[15]: above the dock, still
              under the page header (z-20) — where those overlays sat before
              the dock existed. Click-through while empty. */}
          <div ref={setCanvasOverlay} className="pointer-events-none absolute inset-0 z-[15] [&>*]:pointer-events-auto" />
        </div>
        <NodeConfigPanel />
        {onboardingOpen && <TriggerOnboardingModal onClose={() => setOnboardingOpen(false)} />}
      </div>
      <WorkflowSetupDrawer open={setupOpen} onClose={() => setSetupOpen(false)} issues={setupIssues} environment={envStatus} />
      {mode === 'edit' && (
        <WorkflowLifecycleDrawer
          open={lifecycleOpen}
          onClose={() => setLifecycleOpen(false)}
          workflowName={name}
          isDirty={isDirty}
          savedDefinition={existing?.definition}
          currentDefinition={toDefinition()}
          onSaveWorkflow={handleSave}
        />
      )}
    </div>
  )
}

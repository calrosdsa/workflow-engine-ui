import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Copy,
  Download,
  FileCode2,
  Loader2,
  Maximize2,
  Minimize2,
  PanelLeft,
  Pin,
  Play,
  Plug,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Square,
  Table2,
  Unplug,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { testHttpRequest } from '@/lib/api'
import { useForms } from '@/features/forms/hooks'
import type { FormDefinition } from '@/features/forms/types'
import { useNodeTaxonomy, findPackageNode } from './node-taxonomy'
import { iconFor } from './icon-hints'
import { NODE_REGISTRY } from './node-registry'
import { SchemaForm, defaultsForSchema, type JSONSchema } from './SchemaForm'
import { computeAncestors } from './executionOrder'
import { buildNodeOutputSchema, iteratorItemSchema, type NodeOutputSchema } from './node-output-schema'
import { nodeSetupIssue } from './node-validation'
import { useBuilderStore, type FlowEdge, type FlowNode } from './store'
import {
  countDataItems,
  configurationFingerprint,
  findDataPaths,
  isConfigurationStale,
  readNodeWorkbench,
  redactSensitiveData,
  selectWorkbenchOutput,
  validateNodeExecutionSettings,
  validateSchemaConfiguration,
  type FieldValidationIssue,
  type NodeExecutionSettings,
} from './configuration-workbench'
import type { GraphNode, IteratorConfig, NodeType } from '../types'

type CompactPane = 'input' | 'parameters' | 'output'
type ConfigurationTab = 'parameters' | 'settings'

interface StepRun {
  phase: 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  source?: 'live' | 'draft'
  output?: unknown
  error?: string
  durationMs?: number
  requestId?: string
  configurationFingerprint?: string
  completedAt?: number
}

const EMPTY_RUN: StepRun = { phase: 'idle' }

// ---------------------------------------------------------------------------
// Node configuration workbench
// ---------------------------------------------------------------------------
//
// Built-in node forms remain the source of truth for Parameters. The shell
// composes them with input/output context, draft-only settings, test execution,
// and safe data handling instead of folding those concerns into each form.

export function NodeConfigPanel() {
  const {
    nodes, edges, selectedNodeId, variables, updateNodeConfig, updateNodeLabel,
    updateNodeWorkbench, configPanelOpen, toggleConfigPanel, configPanelWide,
    toggleConfigPanelWide, selectNode, isDirty,
  } = useBuilderStore()
  const node = nodes.find((candidate) => candidate.id === selectedNodeId)
  const [compactPane, setCompactPane] = useState<CompactPane>('parameters')
  const [configurationTab, setConfigurationTab] = useState<ConfigurationTab>('parameters')
  const [helpOpen, setHelpOpen] = useState(false)
  const [runs, setRuns] = useState<Record<string, StepRun>>({})
  const [inputPaneWidth, setInputPaneWidth] = useState(24)
  const [outputPaneWidth, setOutputPaneWidth] = useState(24)
  const [mockDraft, setMockDraft] = useState('')
  const [mockError, setMockError] = useState<string | null>(null)
  const abortControllers = useRef(new Map<string, AbortController>())
  const previewTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const workbenchColumnsRef = useRef<HTMLDivElement>(null)
  const selectedNodeData = node?.data
  const selectedNodeDataRef = useRef<GraphNode | undefined>(selectedNodeData)

  useEffect(() => () => {
    abortControllers.current.forEach((controller) => controller.abort())
    previewTimers.current.forEach((timer) => clearTimeout(timer))
  }, [])

  useEffect(() => {
    selectedNodeDataRef.current = selectedNodeData
  }, [selectedNodeData])

  useEffect(() => {
    const currentNode = selectedNodeDataRef.current
    if (!currentNode) return
    const value = readNodeWorkbench(currentNode).mockOutput
    setMockDraft(value === undefined ? '' : JSON.stringify(value, null, 2))
    setMockError(null)
    setConfigurationTab('parameters')
  }, [node?.id]) // selected node is intentionally the reset boundary

  const nodeTypeKey = node ? (node.data.type as string) : null
  const builtIn = nodeTypeKey ? NODE_REGISTRY[nodeTypeKey as NodeType] : null
  const { data: taxonomy } = useNodeTaxonomy()
  const packageEntry = !builtIn && nodeTypeKey
    ? findPackageNode(taxonomy, nodeTypeKey)
    : null
  // undefined (not a resolved icon) when this node's type is registered
  // NOWHERE — a deregistered/orphaned package node — so WorkbenchHeader can
  // still tell that apart from a known package node and render it muted.
  const Icon = builtIn?.icon ?? (packageEntry ? iconFor(nodeTypeKey!, packageEntry.icon_hint) : undefined)

  const { data: forms } = useForms()
  const formsById = useMemo(() => new Map((forms ?? []).map((form) => [form.id, form])), [forms])

  const nodeContext = useMemo<NodeOutputSchema[]>(() => {
    if (!selectedNodeId) return []
    const ancestorIds = computeAncestors(nodes, edges, selectedNodeId)
    const inBodyIterators = new Set<string>()
    const itemSchemas: NodeOutputSchema[] = []
    for (const candidate of nodes) {
      if (candidate.data.type !== 'iterator' || !ancestorIds.has(candidate.id)) continue
      const iteratorConfig = candidate.data.configuration as IteratorConfig | undefined
      if (iteratorConfig?.loop_end_id && !ancestorIds.has(iteratorConfig.loop_end_id)) {
        inBodyIterators.add(candidate.id)
        itemSchemas.push(iteratorItemSchema(candidate, nodes, formsById))
      }
    }
    return [
      ...itemSchemas,
      ...nodes
        .filter((candidate) => ancestorIds.has(candidate.id) && !inBodyIterators.has(candidate.id))
        .flatMap((candidate) => buildNodeOutputSchema(candidate, formsById, nodes)),
    ]
  }, [nodes, edges, selectedNodeId, formsById])

  const workbench = node ? readNodeWorkbench(node.data) : null
  const settingsIssues = workbench ? validateNodeExecutionSettings(workbench.settings) : []
  const parameterIssues = useMemo(() => {
    if (!node) return [] as FieldValidationIssue[]
    const setup = nodeSetupIssue(node.data)
    const setupIssues = setup ? [{ path: setupIssuePath(node.data.type), message: setup }] : []
    const packageIssues = packageEntry?.config_schema
      ? validateSchemaConfiguration(packageEntry.config_schema, node.data.configuration)
      : []
    return [...setupIssues, ...packageIssues]
  }, [node, packageEntry])
  const issues = [...parameterIssues, ...settingsIssues]
  const readiness = !node ? 'idle' : workbench?.settings.disabled ? 'disabled' : issues.length ? 'needs-attention' : 'ready'
  const run = node ? runs[node.id] ?? EMPTY_RUN : EMPTY_RUN
  const liveOutput = run.output
  const displayedOutput = workbench ? selectWorkbenchOutput({
    pinnedOutput: workbench.pinnedOutput,
    mockOutput: workbench.mockOutput,
    runOutput: liveOutput,
    runSource: run.source,
  }) : null
  const resultIsStale = !!node && isConfigurationStale(run.configurationFingerprint, node.data.configuration)

  const inputData = useMemo(() => buildInputData(node, nodes, edges, variables, formsById, runs), [node, nodes, edges, variables, formsById, runs])

  const updateSettings = (patch: Partial<NodeExecutionSettings>) => {
    if (!node) return
    updateNodeWorkbench(node.id, { settings: patch })
  }

  const runStep = async () => {
    if (!node || run.phase === 'running') return
    if (issues.length > 0) {
      setRuns((current) => ({ ...current, [node.id]: { phase: 'failed', error: 'Fix the highlighted configuration before running this step.' } }))
      return
    }
    if (workbench?.settings.disabled) {
      setRuns((current) => ({ ...current, [node.id]: { phase: 'cancelled', error: 'This node is disabled in Settings.' } }))
      return
    }

    const startedAt = Date.now()
    const configurationFingerprint = configurationFingerprintFor(node.data.configuration)
    setRuns((current) => ({ ...current, [node.id]: { phase: 'running', configurationFingerprint } }))

    if (node.data.type === 'http_request') {
      const controller = new AbortController()
      abortControllers.current.set(node.id, controller)
      try {
        const result = await testHttpRequest({ configuration: node.data.configuration as never, variables }, controller.signal)
        if (result.error) {
          setRuns((current) => ({ ...current, [node.id]: {
            phase: 'failed', source: 'live', error: result.error,
            durationMs: Date.now() - startedAt, requestId: previewRequestId(node.id), configurationFingerprint,
          } }))
        } else {
          setRuns((current) => ({ ...current, [node.id]: {
            phase: 'succeeded', source: 'live', output: result,
            durationMs: result.duration_ms || Date.now() - startedAt,
            requestId: previewRequestId(node.id), configurationFingerprint, completedAt: Date.now(),
          } }))
        }
      } catch (error) {
        if (controller.signal.aborted) {
          setRuns((current) => ({ ...current, [node.id]: { phase: 'cancelled', configurationFingerprint } }))
        } else {
          setRuns((current) => ({ ...current, [node.id]: {
            phase: 'failed', source: 'live', error: error instanceof Error ? error.message : 'Step test failed',
            durationMs: Date.now() - startedAt, requestId: previewRequestId(node.id), configurationFingerprint,
          } }))
        }
      } finally {
        abortControllers.current.delete(node.id)
      }
      return
    }

    // Only HTTP currently has a backend test endpoint. Other nodes use a
    // labelled draft preview: it validates the current in-memory definition,
    // makes no network call, and never publishes/saves the workflow.
    const timer = setTimeout(() => {
      previewTimers.current.delete(node.id)
      setRuns((current) => ({ ...current, [node.id]: {
        phase: 'succeeded', source: 'draft',
        output: makeDraftPreview(node.data), durationMs: Date.now() - startedAt,
        requestId: previewRequestId(node.id), configurationFingerprint, completedAt: Date.now(),
      } }))
    }, 350)
    previewTimers.current.set(node.id, timer)
  }

  const cancelStep = () => {
    if (!node) return
    abortControllers.current.get(node.id)?.abort()
    const timer = previewTimers.current.get(node.id)
    if (timer) {
      clearTimeout(timer)
      previewTimers.current.delete(node.id)
      setRuns((current) => ({ ...current, [node.id]: { phase: 'cancelled', configurationFingerprint: configurationFingerprintFor(node.data.configuration) } }))
    }
  }

  const applyMock = () => {
    if (!node) return
    if (!mockDraft.trim()) {
      updateNodeWorkbench(node.id, { mockOutput: undefined })
      setMockError(null)
      return
    }
    try {
      updateNodeWorkbench(node.id, { mockOutput: JSON.parse(mockDraft) })
      setMockError(null)
    } catch {
      setMockError('Mock data must be valid JSON.')
    }
  }

  const pinCapturedOutput = () => {
    if (!node || liveOutput === undefined) return
    updateNodeWorkbench(node.id, { pinnedOutput: liveOutput })
  }

  const beginResize = (pane: 'input' | 'output') => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!configPanelWide || !workbenchColumnsRef.current) return
    event.preventDefault()
    const columns = workbenchColumnsRef.current
    const bounds = columns.getBoundingClientRect()
    const startX = event.clientX
    const startWidth = pane === 'input' ? inputPaneWidth : outputPaneWidth
    const move = (moveEvent: PointerEvent) => {
      const deltaPercent = ((moveEvent.clientX - startX) / bounds.width) * 100
      const next = pane === 'input' ? startWidth + deltaPercent : startWidth - deltaPercent
      const clamped = Math.max(18, Math.min(38, next))
      if (pane === 'input') setInputPaneWidth(clamped)
      else setOutputPaneWidth(clamped)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <aside
      className={cn(
        'node-workbench absolute inset-y-0 right-0 z-30 flex flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[-16px_0_36px_hsl(var(--background)/0.34)] transition-[width] duration-200',
        !configPanelOpen ? 'w-10' : configPanelWide ? 'node-workbench-wide w-[min(1120px,calc(100vw-3rem))]' : 'node-workbench-compact w-[26rem]',
      )}
      aria-label="Node configuration workbench"
    >
      <button
        onClick={toggleConfigPanel}
        className="absolute -left-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] shadow-sm transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        title={configPanelOpen ? 'Close node workbench' : 'Open node workbench'}
      >
        {configPanelOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {configPanelOpen && (
        <button
          onClick={toggleConfigPanelWide}
          className="absolute -left-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] shadow-sm transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          title={configPanelWide ? 'Use compact inspector' : 'Use three-pane workbench'}
        >
          {configPanelWide ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      )}

      {!configPanelOpen && (
        <div className="flex flex-1 flex-col items-center gap-2 pt-4">
          <SlidersHorizontal size={15} className="text-[hsl(var(--muted-foreground))]" />
          <span className="rotate-90 select-none whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Configure</span>
        </div>
      )}

      {configPanelOpen && !node && (
        <EmptyWorkbench onClose={toggleConfigPanel} />
      )}

      {configPanelOpen && node && (
        <>
          <WorkbenchHeader
            node={node.data}
            icon={Icon}
            kind={packageEntry?.kind}
            readiness={readiness}
            issueCount={issues.length}
            running={run.phase === 'running'}
            resultIsStale={resultIsStale}
            helpOpen={helpOpen}
            unsaved={isDirty}
            onLabelChange={(label) => updateNodeLabel(node.id, label)}
            onToggleHelp={() => setHelpOpen((open) => !open)}
            onClose={() => selectNode(null)}
            onPin={pinCapturedOutput}
            canPin={liveOutput !== undefined}
          />

          {helpOpen && (
            <div id="node-workbench-help" className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 px-4 py-3 text-[12px] text-[hsl(var(--muted-foreground))]">
              <p className="font-medium text-[hsl(var(--foreground))]">{builtIn?.label ?? packageEntry?.display_name ?? node.data.type}</p>
              <p className="mt-1 leading-relaxed">{builtIn?.description ?? packageEntry?.summary ?? 'This saved node type is not installed locally. Its existing configuration remains available read-only.'}</p>
              <p className="mt-2 text-[11px]">Parameters configure this node. Settings are design-time metadata until matching execution policies are enabled by the server.</p>
            </div>
          )}

          <div className="node-workbench-compact-tabs flex border-b border-[hsl(var(--border))] px-3 py-2">
            {(['input', 'parameters', 'output'] as CompactPane[]).map((pane) => (
              <button
                key={pane}
                type="button"
                onClick={() => setCompactPane(pane)}
                data-active={compactPane === pane}
                className="node-workbench-pane-tab flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize"
              >
                {pane}
              </button>
            ))}
          </div>

          <div ref={workbenchColumnsRef} className="node-workbench-columns flex min-h-0 flex-1">
            <section style={{ flexBasis: `${inputPaneWidth}%` }} className={cn('node-workbench-pane node-workbench-input min-w-0 border-r border-[hsl(var(--border))]', compactPane !== 'input' && 'node-workbench-hidden-compact')} aria-label="Input context">
              <DataPane
                title="Input"
                subtitle="Captured values and design-time context"
                value={inputData}
                emptyMessage="No upstream data is available yet."
                onInsertPath={(path) => insertExpressionPath(path)}
              />
            </section>

            <button type="button" aria-label="Resize input pane" onPointerDown={beginResize('input')} onKeyDown={(event) => { if (event.key === 'ArrowLeft') setInputPaneWidth((width) => Math.max(18, width - 2)); if (event.key === 'ArrowRight') setInputPaneWidth((width) => Math.min(38, width + 2)) }} className="node-workbench-splitter" />

            <section className={cn('node-workbench-pane node-workbench-parameters min-w-0', compactPane !== 'parameters' && 'node-workbench-hidden-compact')} aria-label="Node parameters and settings">
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex shrink-0 items-center gap-1 border-b border-[hsl(var(--border))] px-4 py-2">
                  <button type="button" onClick={() => setConfigurationTab('parameters')} data-active={configurationTab === 'parameters'} className="node-workbench-tab rounded-md px-2.5 py-1.5 text-xs font-semibold">Parameters</button>
                  <button type="button" onClick={() => setConfigurationTab('settings')} data-active={configurationTab === 'settings'} className="node-workbench-tab rounded-md px-2.5 py-1.5 text-xs font-semibold">Settings</button>
                  {issues.length > 0 && <span className="ml-auto rounded-full bg-[hsl(var(--destructive))]/10 px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--destructive))]">{issues.length} issue{issues.length === 1 ? '' : 's'}</span>}
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-5 p-4">
                    {configurationTab === 'parameters' ? (
                      <ParametersPane
                        node={node.data}
                        builtIn={builtIn}
                        packageEntry={packageEntry}
                        variables={variables}
                        nodeContext={nodeContext}
                        issues={parameterIssues}
                        onChange={(configuration) => updateNodeConfig(node.id, configuration)}
                      />
                    ) : (
                      <SettingsPane settings={workbench!.settings} issues={settingsIssues} onChange={updateSettings} />
                    )}
                    <ValidationSummary issues={issues} onSelect={(issue) => {
                      setConfigurationTab(issue.path.startsWith('settings.') ? 'settings' : 'parameters')
                      requestAnimationFrame(() => document.getElementById(`node-workbench-${issue.path}`)?.focus())
                    }} />
                  </div>
                </ScrollArea>
              </div>
            </section>

            <button type="button" aria-label="Resize output pane" onPointerDown={beginResize('output')} onKeyDown={(event) => { if (event.key === 'ArrowLeft') setOutputPaneWidth((width) => Math.min(38, width + 2)); if (event.key === 'ArrowRight') setOutputPaneWidth((width) => Math.max(18, width - 2)) }} className="node-workbench-splitter" />

            <section style={{ flexBasis: `${outputPaneWidth}%` }} className={cn('node-workbench-pane node-workbench-output min-w-0 border-l border-[hsl(var(--border))]', compactPane !== 'output' && 'node-workbench-hidden-compact')} aria-label="Node output">
              <OutputPane
                displayedOutput={displayedOutput}
                run={run}
                resultIsStale={resultIsStale}
                mockDraft={mockDraft}
                mockError={mockError}
                onMockChange={setMockDraft}
                onApplyMock={applyMock}
                onClearMock={() => { updateNodeWorkbench(node.id, { mockOutput: undefined }); setMockDraft(''); setMockError(null) }}
                onClearPin={() => updateNodeWorkbench(node.id, { pinnedOutput: undefined })}
              />
            </section>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5">
            <p className="min-w-0 text-[11px] text-[hsl(var(--muted-foreground))]">
              {node.data.type === 'http_request' ? 'Tests the current draft request; it does not save or publish this workflow.' : 'Draft preview only — server-side per-step execution is not available yet.'}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {run.phase === 'running' ? (
                <Button variant="outline" size="sm" onClick={cancelStep} className="h-8 gap-1.5 rounded-full text-xs"><Square size={12} />Cancel</Button>
              ) : (
                <Button size="sm" onClick={runStep} className="h-8 gap-1.5 rounded-full bg-[hsl(var(--foreground))] text-xs text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground))]/90">
                  {run.phase === 'failed' || run.phase === 'cancelled' ? <RotateCcw size={12} /> : <Play size={12} />}
                  {node.data.type === 'http_request' ? 'Execute step' : 'Preview step'}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  )
}

function EmptyWorkbench({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--muted))]"><Settings2 size={22} className="text-[hsl(var(--muted-foreground))]" /></div>
      <div><p className="text-sm font-medium text-[hsl(var(--foreground))]">Select a node to configure it</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Input, parameters, and output stay together here.</p></div>
      <Button variant="outline" size="sm" onClick={onClose} className="rounded-full">Close workbench</Button>
    </div>
  )
}

function WorkbenchHeader({ node, icon: Icon, kind, readiness, issueCount, running, resultIsStale, helpOpen, unsaved, onLabelChange, onToggleHelp, onClose, onPin, canPin }: {
  node: GraphNode
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  kind?: string
  readiness: 'idle' | 'disabled' | 'needs-attention' | 'ready'
  issueCount: number
  running: boolean
  resultIsStale: boolean
  helpOpen: boolean
  unsaved: boolean
  onLabelChange: (label: string) => void
  onToggleHelp: () => void
  onClose: () => void
  onPin: () => void
  canPin: boolean
}) {
  const state = readiness === 'ready'
    ? { label: 'Ready', className: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' }
    : readiness === 'disabled'
      ? { label: 'Disabled', className: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]' }
      : { label: `${issueCount || 1} to set up`, className: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' }
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-[hsl(var(--border))] px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--muted))] ring-1 ring-[hsl(var(--border))]">
        {Icon ? <Icon size={17} strokeWidth={2.25} className="text-[hsl(var(--primary))]" /> : <Plug size={17} className="text-[hsl(var(--muted-foreground))]" />}
      </div>
      <div className="min-w-0 flex-1">
        <Input value={node.label} onChange={(event) => onLabelChange(event.target.value)} aria-label="Node label" className="h-7 border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-1" />
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
          <code className="truncate">{node.type}</code>{kind && <span className="rounded border border-[hsl(var(--border))] px-1 py-px uppercase">{kind}</span>}
          <span className={cn('rounded-full px-1.5 py-0.5 font-semibold', state.className)}>{state.label}</span>
          {unsaved && <span className="rounded-full bg-[hsl(var(--warning))]/10 px-1.5 py-0.5 font-semibold text-[hsl(var(--warning))]">Unsaved edits</span>}
          {resultIsStale && <span className="rounded-full bg-[hsl(var(--warning))]/10 px-1.5 py-0.5 font-semibold text-[hsl(var(--warning))]">Result stale</span>}
          {running && <span className="flex items-center gap-1 text-[hsl(var(--primary))]"><Loader2 size={10} className="animate-spin" />Running</span>}
        </div>
      </div>
      <button type="button" onClick={onPin} disabled={!canPin} title={canPin ? 'Pin the captured output for design-time work' : 'Run or preview this node before pinning its output'} className="node-workbench-icon-button disabled:cursor-not-allowed disabled:opacity-40"><Pin size={14} /></button>
      <button type="button" onClick={onToggleHelp} aria-expanded={helpOpen} title="Show node guidance" className="node-workbench-icon-button"><CircleHelp size={15} /></button>
      <a href="https://github.com/jorge/workflow-engine/blob/main/internal/graph/catalog.go" target="_blank" rel="noreferrer" title="Open node catalog documentation" className="text-[10px] font-semibold text-[hsl(var(--primary))] underline-offset-2 hover:underline">Docs</a>
      <button type="button" onClick={onClose} title="Close node editor" className="node-workbench-icon-button"><X size={16} /></button>
    </header>
  )
}

function ParametersPane({ node, builtIn, packageEntry, variables, nodeContext, issues, onChange }: {
  node: GraphNode
  builtIn: typeof NODE_REGISTRY[NodeType] | null
  packageEntry: { config_schema?: JSONSchema; kind: string } | null | undefined
  variables: Parameters<typeof SchemaForm>[0]['value'] extends never ? never : import('../types').VariableDecl[]
  nodeContext: NodeOutputSchema[]
  issues: FieldValidationIssue[]
  onChange: (configuration: unknown) => void
}) {
  if (builtIn) {
    const Form = builtIn.form
    return <Form config={builtIn.normalise(node.configuration)} variables={variables} nodeContext={nodeContext} onChange={onChange} />
  }
  if (packageEntry?.config_schema) {
    // A length check, not a plain truthy/typeof check: defaultConfig() seeds
    // a freshly-dropped package node's configuration with `{}` (see
    // node-registry.ts — it has no schema to read real defaults from at that
    // point), and `{}` is itself a truthy object. A truthy/typeof check
    // alone would keep that empty object forever and never reach
    // defaultsForSchema, so a fresh node would silently render with an empty
    // config instead of the schema's declared defaults.
    const hasStoredValue = node.configuration && typeof node.configuration === 'object' && Object.keys(node.configuration).length > 0
    const value = hasStoredValue ? node.configuration : defaultsForSchema(packageEntry.config_schema)
    return <SchemaForm schema={packageEntry.config_schema} value={value} onChange={onChange} issues={issues} />
  }
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 p-3"><Unplug size={15} className="mt-0.5 shrink-0 text-[hsl(var(--warning))]" /><p className="text-xs leading-relaxed text-[hsl(var(--warning))]">This node type is not currently registered. Its stored configuration is kept read-only so it can be recovered safely.</p></div>
      <pre className="max-h-80 overflow-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-[11px] text-[hsl(var(--muted-foreground))]">{JSON.stringify(redactSensitiveData(node.configuration), null, 2)}</pre>
    </div>
  )
}

function SettingsPane({ settings, issues, onChange }: { settings: NodeExecutionSettings; issues: FieldValidationIssue[]; onChange: (patch: Partial<NodeExecutionSettings>) => void }) {
  const issueFor = (path: string) => issues.find((issue) => issue.path === path)?.message
  const updateRetry = (patch: Partial<NodeExecutionSettings['retry']>) => onChange({ retry: { ...settings.retry, ...patch } })
  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 px-3 py-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">These are saved design-time settings. They do not change the existing server execution contract until policy support is available.</p>
      <ToggleSetting label="Disable this node" description="Keep its configuration without using it in draft previews." checked={settings.disabled} onCheckedChange={(disabled) => onChange({ disabled })} />
      <div className="space-y-2"><Label className="text-xs font-semibold">Retry policy</Label><div className="grid grid-cols-2 gap-3"><Field label="Attempts" issue={issueFor('settings.retry.maxAttempts')}><Input id="node-workbench-settings.retry.maxAttempts" type="number" min={0} max={10} value={settings.retry.maxAttempts} onChange={(event) => updateRetry({ maxAttempts: Number(event.target.value) })} aria-invalid={!!issueFor('settings.retry.maxAttempts')} /></Field><Field label="Delay (ms)" issue={issueFor('settings.retry.delayMs')}><Input id="node-workbench-settings.retry.delayMs" type="number" min={0} value={settings.retry.delayMs} onChange={(event) => updateRetry({ delayMs: Number(event.target.value) })} aria-invalid={!!issueFor('settings.retry.delayMs')} /></Field></div></div>
      <Field label="Timeout (ms)" issue={issueFor('settings.timeoutMs')}><Input id="node-workbench-settings.timeoutMs" type="number" min={100} max={3600000} value={settings.timeoutMs ?? ''} placeholder="Use node default" onChange={(event) => onChange({ timeoutMs: event.target.value === '' ? undefined : Number(event.target.value) })} aria-invalid={!!issueFor('settings.timeoutMs')} /></Field>
      <ToggleSetting label="Continue on error" description="Record a local preview error without blocking the rest of the draft session." checked={settings.continueOnError} onCheckedChange={(continueOnError) => onChange({ continueOnError })} />
      <ToggleSetting label="Always output data" description="Keep an empty output shape available to downstream design-time work." checked={settings.alwaysOutputData} onCheckedChange={(alwaysOutputData) => onChange({ alwaysOutputData })} />
      <div className="space-y-1.5"><Label htmlFor="node-workbench-settings.errorRouting" className="text-xs font-semibold">Error routing</Label><Select id="node-workbench-settings.errorRouting" value={settings.errorRouting} onChange={(event) => onChange({ errorRouting: event.target.value as NodeExecutionSettings['errorRouting'] })} className="h-8 text-xs"><option value="stop">Stop workflow</option><option value="continue">Continue</option><option value="route">Route to error branch</option></Select></div>
      <Field label="Notes" issue={issueFor('settings.notes')}><Textarea id="node-workbench-settings.notes" value={settings.notes} maxLength={1001} onChange={(event) => onChange({ notes: event.target.value })} placeholder="Explain why this node exists or how to run it." className="min-h-20 text-xs" aria-invalid={!!issueFor('settings.notes')} /></Field>
    </div>
  )
}

function ToggleSetting({ label, description, checked, onCheckedChange }: { label: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-[hsl(var(--foreground))]">{label}</p><p className="mt-0.5 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">{description}</p></div><Switch checked={checked} onCheckedChange={onCheckedChange} /></div>
}

function Field({ label, issue, children }: { label: string; issue?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}{issue && <p className="text-[11px] text-[hsl(var(--destructive))]">{issue}</p>}</div>
}

function ValidationSummary({ issues, onSelect }: { issues: FieldValidationIssue[]; onSelect: (issue: FieldValidationIssue) => void }) {
  if (issues.length === 0) return <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--success))]/10 px-3 py-2 text-[11px] text-[hsl(var(--success))]"><CheckCircle2 size={13} />Configuration is ready for a preview.</div>
  return <div className="rounded-lg border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 p-3"><div className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--destructive))]"><AlertCircle size={13} />Before you run</div><ul className="mt-2 space-y-1.5">{issues.map((issue, index) => <li key={`${issue.path}-${index}`}><button type="button" onClick={() => onSelect(issue)} className="text-left text-[11px] text-[hsl(var(--muted-foreground))] underline decoration-[hsl(var(--destructive))]/40 underline-offset-2 hover:text-[hsl(var(--foreground))]"><code className="mr-1 text-[hsl(var(--destructive))]">{issue.path.replace(/^(parameters|settings)\./, '')}</code>{issue.message}</button></li>)}</ul></div>
}

function OutputPane({ displayedOutput, run, resultIsStale, mockDraft, mockError, onMockChange, onApplyMock, onClearMock, onClearPin }: {
  displayedOutput: { value: unknown; source: string } | null
  run: StepRun
  resultIsStale: boolean
  mockDraft: string
  mockError: string | null
  onMockChange: (value: string) => void
  onApplyMock: () => void
  onClearMock: () => void
  onClearPin: () => void
}) {
  return <div className="flex h-full min-h-0 flex-col"><DataPane title="Output" subtitle={displayedOutput ? `${sourceLabel(displayedOutput.source)} · ${countDataItems(displayedOutput.value)} item${countDataItems(displayedOutput.value) === 1 ? '' : 's'}` : 'No output captured'} value={displayedOutput?.value} emptyMessage={run.phase === 'failed' ? run.error ?? 'The step failed.' : run.phase === 'running' ? 'Step is running…' : 'Run or preview this node to inspect its output.'} status={run} stale={resultIsStale} allowDownload />
    <ScrollArea className="max-h-52 shrink-0 border-t border-[hsl(var(--border))]"><div className="space-y-2 p-3"><div className="flex items-center justify-between gap-2"><Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Mock output</Label><div className="flex gap-1"><button type="button" onClick={onApplyMock} className="text-[11px] font-semibold text-[hsl(var(--primary))]">Apply</button>{mockDraft && <button type="button" onClick={onClearMock} className="text-[11px] text-[hsl(var(--muted-foreground))]">Clear</button>}{displayedOutput?.source === 'pinned' && <button type="button" onClick={onClearPin} className="text-[11px] text-[hsl(var(--muted-foreground))]">Unpin</button>}</div></div><Textarea value={mockDraft} onChange={(event) => onMockChange(event.target.value)} placeholder={'{\n  "example": true\n}'} className="min-h-20 font-mono text-[11px]" aria-invalid={!!mockError} />{mockError && <p className="text-[11px] text-[hsl(var(--destructive))]">{mockError}</p>}<p className="text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">Mock and pinned data are saved as UI metadata. Sensitive values are redacted in viewers and copied output.</p></div></ScrollArea></div>
}

function DataPane({ title, subtitle, value, emptyMessage, onInsertPath, status, stale, allowDownload = false }: {
  title: string
  subtitle: string
  value: unknown
  emptyMessage: string
  onInsertPath?: (path: string) => void
  status?: StepRun
  stale?: boolean
  allowDownload?: boolean
}) {
  const [view, setView] = useState<'schema' | 'table' | 'json'>('schema')
  const [query, setQuery] = useState('')
  const safeValue = redactSensitiveData(value)
  const matches = value === undefined ? [] : findDataPaths(safeValue, query)
  const copy = async () => { if (value !== undefined && navigator.clipboard) await navigator.clipboard.writeText(JSON.stringify(safeValue, null, 2)) }
  const download = () => {
    if (value === undefined) return
    const blob = new Blob([JSON.stringify(safeValue, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = 'node-output.json'; link.click(); URL.revokeObjectURL(url)
  }
  return <div className="flex min-h-0 flex-1 flex-col"><div className="shrink-0 border-b border-[hsl(var(--border))] px-3 py-2.5"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-[hsl(var(--foreground))]">{title}</p><p className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{subtitle}</p></div><div className="flex gap-1"><button type="button" onClick={() => void copy()} disabled={value === undefined} title="Copy redacted data" className="node-workbench-icon-button disabled:opacity-40"><Copy size={13} /></button>{allowDownload && <button type="button" onClick={download} disabled={value === undefined} title="Download redacted JSON" className="node-workbench-icon-button disabled:opacity-40"><Download size={13} /></button>}</div></div>{status && status.phase !== 'idle' && <RunStatus run={status} stale={stale} />}</div>{value === undefined ? <div className="flex flex-1 items-center justify-center p-5 text-center text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">{emptyMessage}</div> : <><div className="flex shrink-0 items-center gap-1 border-b border-[hsl(var(--border))] px-3 py-2"><div className="flex rounded-md bg-[hsl(var(--muted))] p-0.5">{([['schema', PanelLeft], ['table', Table2], ['json', FileCode2]] as const).map(([name, ViewIcon]) => <button key={name} type="button" onClick={() => setView(name)} data-active={view === name} className="node-workbench-view-tab" title={`${name} view`}><ViewIcon size={12} /><span>{name}</span></button>)}</div><div className="relative min-w-0 flex-1"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fields" className="h-7 pr-7 text-[11px]" />{query && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[hsl(var(--muted-foreground))]">{matches.length}</span>}</div></div><ScrollArea className="min-h-0 flex-1"><div className="p-3">{view === 'json' ? <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">{JSON.stringify(safeValue, null, 2)}</pre> : view === 'table' ? <DataTable value={safeValue} query={query} /> : <SchemaRows value={safeValue} query={query} onInsertPath={onInsertPath} />}</div></ScrollArea></>}</div>
}

function RunStatus({ run, stale }: { run: StepRun; stale?: boolean }) {
  const state = run.phase === 'succeeded' ? 'Succeeded' : run.phase === 'failed' ? 'Failed' : run.phase === 'cancelled' ? 'Cancelled' : 'Running'
  const tone = run.phase === 'succeeded' ? 'text-[hsl(var(--success))]' : run.phase === 'failed' ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--warning))]'
  return <div className={cn('mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]', tone)}><span className="font-semibold">{state}</span>{run.source && <span>{sourceLabel(run.source)}</span>}{run.durationMs !== undefined && <span>{run.durationMs}ms</span>}{run.requestId && <code>{run.requestId}</code>}{stale && <span>Stale after config change</span>}{run.error && <span className="w-full leading-relaxed">{run.error}</span>}</div>
}

function DataTable({ value, query }: { value: unknown; query: string }) {
  const rows = Array.isArray(value) ? value : typeof value === 'object' && value !== null ? Object.entries(value).map(([key, val]) => ({ field: key, value: val })) : [{ field: 'value', value }]
  const filtered = rows.filter((row) => !query || `${'field' in row ? row.field : ''} ${JSON.stringify(row)}`.toLowerCase().includes(query.toLowerCase()))
  if (filtered.length === 0) return <p className="py-4 text-center text-[11px] text-[hsl(var(--muted-foreground))]">No matching fields.</p>
  return <div className="overflow-auto rounded-md border border-[hsl(var(--border))]"><table className="w-full text-left text-[11px]"><thead className="bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><tr>{Array.isArray(value) ? <><th className="px-2 py-1.5">#</th><th className="px-2 py-1.5">Value</th></> : <><th className="px-2 py-1.5">Field</th><th className="px-2 py-1.5">Value</th></>}</tr></thead><tbody>{filtered.slice(0, 100).map((row, index) => <tr key={index} className="border-t border-[hsl(var(--border))]"><td className="px-2 py-1.5 font-mono text-[hsl(var(--muted-foreground))]">{Array.isArray(value) ? index : (row as { field: string }).field}</td><td className="max-w-52 truncate px-2 py-1.5 font-mono text-[hsl(var(--foreground))]">{formatData((row as { value?: unknown }).value ?? row)}</td></tr>)}</tbody></table></div>
}

function SchemaRows({ value, query, onInsertPath, path = '' }: { value: unknown; query: string; onInsertPath?: (path: string) => void; path?: string }) {
  if (Array.isArray(value)) return <div className="space-y-1">{value.slice(0, 20).map((item, index) => <SchemaRows key={index} value={item} query={query} onInsertPath={onInsertPath} path={`${path}[${index}]`} />)}</div>
  if (typeof value === 'object' && value !== null) return <div className="space-y-1">{Object.entries(value as Record<string, unknown>).map(([key, child]) => { const childPath = path ? `${path}.${key}` : key; const visible = !query || `${childPath} ${formatData(child)}`.toLowerCase().includes(query.toLowerCase()); return <div key={childPath}>{visible && <div className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-[hsl(var(--muted))]"><code className="min-w-0 flex-1 truncate text-[11px] text-[hsl(var(--foreground))]">{childPath}</code><span className="rounded bg-[hsl(var(--muted))] px-1 text-[9px] text-[hsl(var(--muted-foreground))]">{dataType(child)}</span>{onInsertPath && <button type="button" onClick={() => onInsertPath(childPath)} title="Insert expression path" className="node-workbench-icon-button h-5 w-5"><Clipboard size={10} /></button>}</div>}{typeof child === 'object' && child !== null && <div className="ml-2 border-l border-[hsl(var(--border))] pl-2"><SchemaRows value={child} query={query} onInsertPath={onInsertPath} path={childPath} /></div>}</div> })}</div>
  return <div className="flex items-center gap-2 rounded px-1.5 py-1"><code className="min-w-0 flex-1 truncate text-[11px] text-[hsl(var(--muted-foreground))]">{path || '$'}</code><span className="rounded bg-[hsl(var(--muted))] px-1 text-[9px] text-[hsl(var(--muted-foreground))]">{dataType(value)}</span></div>
}

function buildInputData(node: FlowNode | undefined, nodes: FlowNode[], edges: FlowEdge[], variables: import('../types').VariableDecl[], formsById: Map<string, FormDefinition>, runs: Record<string, StepRun>) {
  if (!node) return undefined
  const ancestorIds = computeAncestors(nodes, edges, node.id)
  const upstream = Object.fromEntries(nodes.filter((candidate) => ancestorIds.has(candidate.id)).map((candidate) => {
    const captured = readNodeWorkbench(candidate.data)
    const output = captured.pinnedOutput ?? captured.mockOutput ?? runs[candidate.id]?.output
    const schema = buildNodeOutputSchema(candidate, formsById, nodes)
    return [candidate.id, output ?? {
      label: candidate.data.label,
      outputShape: schema.map((item) => ({
        label: item.nodeLabel,
        fields: item.fields.map((field) => ({ key: field.key, label: field.label ?? field.key, type: field.type })),
      })),
    }]
  }))
  const triggerConfiguration = nodes.find((candidate) => candidate.data.type === 'trigger')?.data.configuration ?? { available: 'Trigger payload is available only when the workflow is invoked.' }
  return {
    triggerContext: { payload: 'No captured trigger payload. Run the workflow to inspect a live payload.', configuration: redactSensitiveData(triggerConfiguration) },
    upstream,
    variables: Object.fromEntries(variables.map((variable) => [variable.name, variable.default ?? { type: variable.type, value: 'Available at execution time' }])),
    environment: { context: 'Tenant, current user, and trigger metadata are resolved at execution time.' },
  }
}

function insertExpressionPath(path: string) {
  const expression = path.startsWith('upstream.')
    ? path.replace(/^upstream\.([^.[\]]+)/, 'NodeOutputs["$1"]')
    : path.startsWith('variables.')
      ? path.replace(/^variables\.([^.[\]]+)/, 'Vars["$1"]')
      : path.startsWith('trigger.')
        ? path.replace(/^trigger\.([^.[\]]+)/, 'TriggerRecord["$1"]')
        : path
  window.dispatchEvent(new CustomEvent('workflow-expression-insert', { detail: { expression } }))
}

function makeDraftPreview(node: GraphNode) {
  return { preview: { nodeType: node.type, label: node.label, configuration: redactSensitiveData(node.configuration), message: 'Draft configuration passed local readiness checks. No saved workflow was changed.' } }
}

function setupIssuePath(type: string): string {
  const pathByType: Record<string, string> = { trigger: 'parameters.mode', set_variable: 'parameters.assignments', condition: 'parameters.expression', subflow: 'parameters.definition_id', fetch_records: 'parameters.form_id', upsert_records: 'parameters.form_id', update_records: 'parameters.form_id', delete_records: 'parameters.form_id', iterator: 'parameters.source_expr', transform: 'parameters.source_expr', save_records: 'parameters.source_expr', http_request: 'parameters.url', show_message: 'parameters.message', notification: 'parameters.title' }
  return pathByType[type] ?? 'parameters'
}

function configurationFingerprintFor(value: unknown) { return configurationFingerprint(value) }
function previewRequestId(nodeId: string) { return `preview-${nodeId.slice(0, 6)}-${Date.now().toString(36)}` }
function sourceLabel(source: string) { return source === 'live' ? 'Live test' : source === 'draft' ? 'Draft preview' : source === 'mock' ? 'Mock data' : 'Pinned data' }
function dataType(value: unknown) { return Array.isArray(value) ? `array(${value.length})` : value === null ? 'null' : typeof value }
function formatData(value: unknown) { const text = typeof value === 'string' ? value : JSON.stringify(value); return text.length > 100 ? `${text.slice(0, 100)}…` : text }

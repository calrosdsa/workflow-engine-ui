import { useMemo, useState } from 'react'
import { Handle, Position, type NodeProps, useStore } from '@xyflow/react'
import { Plus, GripVertical, ArrowLeftRight, Trash2, GitBranchPlus, Copy, Check, AlertTriangle, AlertCircle, CheckCircle2, XCircle, MinusCircle, Loader2, MessageCircle, Bug, PanelRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NODE_REGISTRY, fallbackCategory } from '../node-registry'
import { useNodeTaxonomy, findPackageNode, findTriggerPreset } from '../node-taxonomy'
import { iconFor, iconForHint } from '../icon-hints'
import { useBuilderStore, DUPLICABLE_NODE_TYPES, type FlowNode, type DropPosition } from '../store'
import { computeExecutionOrder } from '../executionOrder'
import { nodeSetupIssue } from '../node-validation'
import { useExecutionOverlayStore } from '../execution-overlay-store'
import type { NodeExecutionStatus } from '@/features/executions/types'
import { DropZone } from './DropZone'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuLabel } from '@/components/ui/context-menu'
import type { SetVariableConfig, ConditionConfig, VariableAssignment, FetchRecordsConfig, FilterGroup, IteratorConfig, HttpRequestConfig, TriggerConfig, ShowMessageConfig, NotificationConfig, DebugConfig } from '../../types'

const DRAG_TRANSFER_KEY = 'application/workflow-node-reorder'

// Execution overlay styling (FR-C5-007) — mirrors ExecutionDetailPage's own
// statusVariant color family so the canvas and the execution detail view
// read as one consistent system. RUNNING/PENDING never appear per-node here
// (a node only enters node_statuses once it's reached a terminal outcome or
// is actively running), but are included for completeness against the full
// NodeExecutionStatus union.
const overlayStatusStyle: Record<NodeExecutionStatus, string> = {
  PENDING:                'workflow-node-status--pending',
  RUNNING:                'workflow-node-status--running',
  COMPLETED:              'workflow-node-status--completed',
  FAILED:                 'workflow-node-status--failed',
  SKIPPED:                'workflow-node-status--skipped',
  // An iterator with continue_on_error that ran every item but had failures
  // (FR-B2-015) — amber, distinct from both a clean COMPLETED and a FAILED.
  COMPLETED_WITH_ERRORS:  'workflow-node-status--completed-with-errors',
}

const overlayStatusIcon: Record<NodeExecutionStatus, React.ReactNode> = {
  PENDING:               <Loader2 size={10} strokeWidth={3} />,
  RUNNING:               <Loader2 size={10} strokeWidth={3} className="animate-spin" />,
  COMPLETED:             <CheckCircle2 size={10} strokeWidth={3} />,
  FAILED:                <XCircle size={10} strokeWidth={3} />,
  SKIPPED:               <MinusCircle size={10} strokeWidth={3} />,
  COMPLETED_WITH_ERRORS: <AlertTriangle size={10} strokeWidth={3} />,
}

// No per-node duration is shown here — none is persisted anywhere (FR-B2-012's
// own confirmed scope boundary; only the execution-level total is real data,
// shown once in the Executions sidebar row instead of fabricated per node).
function overlayStatusLabel(status: NodeExecutionStatus): string {
  return status === 'COMPLETED_WITH_ERRORS'
    ? 'Completed with errors'
    : status.charAt(0) + status.slice(1).toLowerCase()
}

function nodeCategoryLabel(category: string): string {
  return category === 'ai'
    ? 'AI'
    : category.charAt(0).toUpperCase() + category.slice(1)
}

export function BaseNode({ id, data, selected }: NodeProps<FlowNode>) {
  // Two-step lookup, same pattern as NodeConfigPanel.tsx's — NODE_REGISTRY
  // only has the built-in NodeType keys, so a package-typed node (e.g.
  // "whatsapp_send") resolves to undefined there at RUNTIME, even though
  // FlowNode['data']['type'] is statically typed as NodeType (a package type
  // only ever reaches this field via store.ts's addNode/addConnectedNode/
  // insertNodeOnEdge, whose signatures were widened to NodeType | (string &
  // {}) specifically to allow this — see store.ts's own comment on why).
  // Without the cast below, TS believes NODE_REGISTRY[data.type] can never
  // be undefined and would flag builtInReg?. as needless — the cast is what
  // makes the compiler agree with what's actually true at runtime.
  // Previously this file read NODE_REGISTRY[data.type].icon unconditionally,
  // which crashed with "Cannot read properties of undefined" the first time
  // a real package node reached this component — this two-step lookup is
  // that fix. NodeBody's own switch already has a safe `default: return
  // null` for body content, so only the header (icon/label) needed
  // it. A type in NEITHER registry (a deregistered package node) gets a
  // neutral fallback too (iconFor's own Plug default), rather than crashing
  // a third time on some future edge case.
  const builtInReg = NODE_REGISTRY[data.type as keyof typeof NODE_REGISTRY]
  const { data: taxonomy } = useNodeTaxonomy()
  const packageEntry = !builtInReg ? findPackageNode(taxonomy, data.type) : undefined
  // A trigger preset (e.g. "WhatsApp — On Message") isn't a node entry — it's
  // package data naming a webhook provider/default events, applied to the
  // one singleton trigger every workflow already has — so findTriggerPreset
  // matches it by the trigger's own saved webhook_preset, not through
  // findPackageNode (which only searches taxonomy.nodes). undefined for
  // every non-trigger node, a trigger with no preset applied, or a preset
  // name this build doesn't recognize — every case falling back to the
  // plain trigger icon/label below, same as an unrecognized package
  // icon_hint already does.
  const triggerPreset = data.type === 'trigger'
    ? findTriggerPreset(taxonomy, (data.configuration as TriggerConfig | undefined)?.webhook_preset)
    : undefined
  // iconForHint, not iconFor: iconFor would short-circuit to the built-in
  // trigger icon before ever consulting the preset's icon_hint (see
  // icon-hints.ts's own doc comment on why iconFor can't do this).
  const Icon      = (triggerPreset && iconForHint(triggerPreset.icon_hint)) || iconFor(data.type, packageEntry?.icon_hint)
  const headerLabel = triggerPreset?.display_name ?? builtInReg?.label ?? packageEntry?.display_name ?? data.type
  const nodeCategory = packageEntry?.category
    ?? builtInReg?.category
    ?? fallbackCategory(data.type as keyof typeof NODE_REGISTRY)
  const usesDefaultLabel = data.label.trim().toLocaleLowerCase() === headerLabel.trim().toLocaleLowerCase()
  const nodeMeta = usesDefaultLabel ? nodeCategoryLabel(nodeCategory) : headerLabel
  const hasInputs  = data.inputs?.length  > 0
  const hasOutputs = data.outputs?.length > 0

  // Show + button beside this node only if it's a leaf (no outgoing edges) and not exit
  const outgoingEdges   = useStore((s) => s.edges.filter((e) => e.source === id))
  const hasOutgoingEdge = outgoingEdges.length > 0

  // A node is "at the tail of a loop body" when its one outgoing edge points
  // straight at a Loop End it doesn't itself own — true for a freshly-made,
  // empty-bodied Iterator (wired straight to its own loop_end by
  // makeIteratorPair) AND for whatever node currently sits last inside a
  // non-empty body (its edge points at that same loop_end). Both cases need
  // identical treatment: the node LOOKS like a leaf's plain "+" case, not a
  // branch point, even though it technically has an outgoing edge — clicking
  // "+" here means "extend the loop body," which addConnectedNode now
  // splices onto the tail→loop_end edge rather than forking a sibling. A
  // node with 2+ children (a real second branch, deliberately added via the
  // branch toolbar) is excluded — that's a genuine fork, handled normally.
  const allNodes  = useStore((s) => s.nodes)
  const loopEndIds = useMemo(
    () => new Set(allNodes.filter((n) => n.data.type === 'loop_end').map((n) => n.id)),
    [allNodes],
  )
  const isLoopBodyTail = outgoingEdges.length === 1 && loopEndIds.has(outgoingEdges[0].target) && !loopEndIds.has(id)
  const showAddButton  = hasOutputs && data.type !== 'exit' && (!hasOutgoingEdge || isLoopBodyTail)

  // This node is a "branch point" once it fans out to 2+ children off the same
  // handle (parallel siblings) — matches the reference builder's fork toolbar.
  // A loop-body-tail node's single edge to its loop_end doesn't count as a
  // branch (see isLoopBodyTail above) — it needs the plain leaf "+" instead.
  const branchChildIds = useMemo(
    () => Array.from(new Set(outgoingEdges.map((e) => e.target))),
    [outgoingEdges],
  )
  const isBranchPoint = !isLoopBodyTail && branchChildIds.length > 1
  const [branchToolbarOpen, setBranchToolbarOpen] = useState(false)

  const openPicker          = useBuilderStore((s) => s.openPicker)
  const selectNode          = useBuilderStore((s) => s.selectNode)
  const draggingNodeId      = useBuilderStore((s) => s.draggingNodeId)
  const activeDropTarget    = useBuilderStore((s) => s.activeDropTarget)
  const setDraggingNode     = useBuilderStore((s) => s.setDraggingNode)
  const setActiveDropTarget = useBuilderStore((s) => s.setActiveDropTarget)
  const reorderNode         = useBuilderStore((s) => s.reorderNode)
  const applyDagreLayout    = useBuilderStore((s) => s.applyDagreLayout)
  const deleteBranch        = useBuilderStore((s) => s.deleteBranch)
  const swapLastTwoBranches = useBuilderStore((s) => s.swapLastTwoBranches)
  const deleteNode          = useBuilderStore((s) => s.deleteNode)
  const duplicateNode       = useBuilderStore((s) => s.duplicateNode)

  // Quick actions: entry points are protected (the picker can't re-add one);
  // duplicate only where an insert-after copy keeps the graph valid.
  const canDelete    = data.type !== 'trigger' && data.type !== 'entry'
  const canDuplicate = DUPLICABLE_NODE_TYPES.has(data.type)
  const setupIssue   = nodeSetupIssue(data)

  // Execution order badge
  const nodes    = useBuilderStore((s) => s.nodes)
  const edges    = useBuilderStore((s) => s.edges)
  const execInfo = useMemo(() => computeExecutionOrder(nodes, edges), [nodes, edges])
  const info     = execInfo.get(id)

  // Execution overlay (FR-C5-007) — status/duration/message for this node in
  // whichever past run is selected in the Executions sidebar. undefined
  // means "no overlay active"; a node key absent from node_statuses means
  // "overlay active, but this node was never reached" (dimmed, no badge).
  const overlayExecution = useExecutionOverlayStore((s) => s.data)
  const showCompletedSteps = useBuilderStore((s) => s.showCompletedSteps)
  const overlayActive    = overlayExecution != null
  const nodeStatus: NodeExecutionStatus | undefined = overlayExecution?.node_statuses?.[id]
  const nodeError                                   = overlayExecution?.node_errors?.[id]
  const nodeMessage                                 = overlayExecution?.messages?.find((m) => m.node_id === id)
  const failedItems                                 = overlayExecution?.iterator_failed_items?.[id]
  const debugSnapshot                               = overlayExecution?.debug_snapshots?.[id]
  const nodeWarning                                 = overlayExecution?.node_warnings?.[id]
  const reached          = overlayActive && nodeStatus !== undefined
  const showStatusBadge  = reached && nodeStatus !== undefined && (showCompletedSteps || nodeStatus !== 'COMPLETED')
  const dimUnreached     = overlayActive && !reached
  const [overlayNoteOpen, setOverlayNoteOpen] = useState(false)
  const [debugPopoverOpen, setDebugPopoverOpen] = useState(false)
  const [warningPopoverOpen, setWarningPopoverOpen] = useState(false)
  const [errorCopied, setErrorCopied] = useState(false)

  const copyOverlayText = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setErrorCopied(true)
        setTimeout(() => setErrorCopied(false), 1500)
      })
      .catch(() => {
        // Clipboard access can be denied by the browser (permissions,
        // an unfocused document) — fail silently rather than leaving an
        // unhandled rejection; the popover's own selectable text is the
        // fallback copy path in that case.
      })
  }

  const isDraggingThis = draggingNodeId === id
  const showDropZones  = draggingNodeId !== null && draggingNodeId !== id

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_TRANSFER_KEY, id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingNode(id)
  }

  const handleDragEnd = () => {
    setDraggingNode(null)
    setActiveDropTarget(null)
  }

  const handleDropZoneOver = (_e: React.DragEvent, position: DropPosition) => {
    setActiveDropTarget({ nodeId: id, position })
  }

  const handleDropZoneLeave = () => {
    setActiveDropTarget(null)
  }

  const handleDrop = (e: React.DragEvent, position: DropPosition) => {
    const srcId = e.dataTransfer.getData(DRAG_TRANSFER_KEY)
    if (!srcId || srcId === id) return
    reorderNode(srcId, id, position)
    setDraggingNode(null)
    setActiveDropTarget(null)
    setTimeout(() => applyDagreLayout('LR'), 0)
  }

  const handleAddClick = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation()
    openPicker({ kind: 'node', sourceNodeId: id, sourceHandle: handle })
  }

  const dropAt = (pos: DropPosition) =>
    activeDropTarget?.nodeId === id && activeDropTarget.position === pos

  // While a reorder drag is in flight, dim every node that isn't the one
  // being dragged and isn't the currently-hovered drop target — keeps focus
  // on the drag/drop pair, matching the reference builder's fade-out.
  const isActiveDropTarget = activeDropTarget?.nodeId === id
  const dimForDrag = draggingNodeId !== null && !isDraggingThis && !isActiveDropTarget

  const deleteLabel = data.type === 'iterator' || data.type === 'loop_end'
    ? 'Delete loop (keeps body steps)'
    : 'Delete node'

  return (
    <ContextMenu>
    <ContextMenuTrigger asChild>
    <div
      data-node-category={nodeCategory}
      data-selected={selected ? 'true' : 'false'}
      data-execution-state={nodeStatus?.toLowerCase()}
      className={cn(
        'workflow-node group relative',
        isDraggingThis ? 'workflow-node--dragging' : '',
        dimForDrag ? 'workflow-node--dimmed' : '',
        // A node the selected execution never reached (e.g. a condition's
        // untaken branch) recedes rather than showing a misleading badge.
        dimUnreached ? 'workflow-node--unreached' : '',
      )}
    >
      {/* Drop zones — appear around the node while another node is dragged */}
      {showDropZones && (
        <>
          <DropZone position="before" active={dropAt('before')} onDragOver={handleDropZoneOver} onDrop={handleDrop} onDragLeave={handleDropZoneLeave} />
          <DropZone position="after"  active={dropAt('after')}  onDragOver={handleDropZoneOver} onDrop={handleDrop} onDragLeave={handleDropZoneLeave} />
          <DropZone position="left"   active={dropAt('left')}   onDragOver={handleDropZoneOver} onDrop={handleDrop} onDragLeave={handleDropZoneLeave} />
          <DropZone position="right"  active={dropAt('right')}  onDragOver={handleDropZoneOver} onDrop={handleDrop} onDragLeave={handleDropZoneLeave} />
        </>
      )}

      {/* Input handles — left edge */}
      {hasInputs && data.inputs.map((port, i) => (
        <Handle
          key={port.id}
          id={port.id}
          type="target"
          position={Position.Left}
          className="workflow-node-handle workflow-node-handle--input"
          style={{ top: `${((i + 1) / (data.inputs.length + 1)) * 100}%` }}
        />
      ))}

      {/* Execution overlay: status + duration badge (FR-C5-007) — bottom-right,
          a corner distinct from the execution-order badge (top-left) and the
          setup-issue badge (top-right). Only rendered for a node the
          selected execution actually reached. */}
      {showStatusBadge && nodeStatus && (
        <div
          className={cn(
            'workflow-node-status absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            overlayStatusStyle[nodeStatus],
          )}
          title={overlayStatusLabel(nodeStatus)}
        >
          {overlayStatusIcon[nodeStatus]}
          <span>{overlayStatusLabel(nodeStatus)}</span>
        </div>
      )}

      {/* Execution overlay: message/error popover (FR-C5-007) — bottom-left.
          A show_message node's own published message, or a FAILED node's
          captured error text (FR-B2-012/FR-B2-014). Uses the shared Popover
          component (Radix, portalled) rather than a hand-positioned div so
          long error text never clips against the canvas's zoom/pan
          transform, gets its own scroll region, and closes on outside-click/
          Escape for free. */}
      {reached && (nodeMessage || nodeError) && (
        <Popover open={overlayNoteOpen} onOpenChange={setOverlayNoteOpen}>
          <PopoverTrigger asChild>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'workflow-node-overlay-button absolute bottom-2 left-2 z-20 flex h-6 w-6 items-center justify-center rounded-full shadow-md ring-2 ring-[hsl(var(--card))] nodrag nopan',
                nodeStatus === 'COMPLETED_WITH_ERRORS' ? 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] shadow-[hsl(var(--warning))]/30'
                  : nodeError || nodeMessage?.message_type === 'error' ? 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] shadow-[hsl(var(--destructive))]/30'
                  : nodeMessage?.message_type === 'info' ? 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] shadow-[hsl(var(--warning))]/30'
                  : 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] shadow-[hsl(var(--success))]/30',
              )}
              title={failedItems?.length ? 'View failed items' : nodeError ? 'View error details' : 'View message'}
            >
              {nodeError ? <AlertCircle size={12} strokeWidth={2.5} /> : <MessageCircle size={12} strokeWidth={2.5} />}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="nodrag nopan w-80 p-0"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn(
              'flex items-center justify-between gap-2 rounded-t-xl border-b px-3 py-2',
              nodeStatus === 'COMPLETED_WITH_ERRORS' ? 'border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))]/10'
                : nodeError ? 'border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/10'
                : nodeMessage?.message_type === 'info' ? 'border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))]/10'
                : 'border-[hsl(var(--success))]/20 bg-[hsl(var(--success))]/10',
            )}>
              <span className={cn(
                'text-[11px] font-semibold uppercase tracking-wide',
                nodeStatus === 'COMPLETED_WITH_ERRORS' ? 'text-[hsl(var(--warning))]'
                  : nodeError ? 'text-[hsl(var(--destructive))]'
                  : nodeMessage?.message_type === 'info' ? 'text-[hsl(var(--warning))]'
                  : 'text-[hsl(var(--success))]',
              )}>
                {failedItems?.length ? `${failedItems.length} item${failedItems.length > 1 ? 's' : ''} failed` : nodeError ? 'Node error' : nodeMessage?.message_type}
              </span>
              <button
                onClick={() => copyOverlayText(nodeError ?? nodeMessage?.message ?? '')}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--card))]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
                title="Copy to clipboard"
              >
                {errorCopied ? <Check size={11} /> : <Copy size={11} />}
                {errorCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto px-3 py-2.5">
              {failedItems && failedItems.length > 0 ? (
                <ul className="space-y-2">
                  {failedItems.map((fi) => (
                    <li key={fi.index} className="rounded-lg bg-[hsl(var(--warning))]/10 px-2 py-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[hsl(var(--warning))]">
                        <span className="rounded bg-[hsl(var(--warning))]/20 px-1 py-0.5">index {fi.index}</span>
                        {fi.item !== undefined && (
                          <code className="truncate font-mono text-[10px] font-normal text-[hsl(var(--muted-foreground))]">
                            {typeof fi.item === 'string' ? fi.item : JSON.stringify(fi.item)}
                          </code>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[hsl(var(--destructive))]">{fi.error}</p>
                    </li>
                  ))}
                </ul>
              ) : nodeError ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[hsl(var(--destructive))]">{nodeError}</pre>
              ) : nodeMessage ? (
                <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[hsl(var(--foreground))]">{nodeMessage.message}</p>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Execution overlay: debug snapshot popover (FR-B2-013) — right edge,
          a corner none of the other overlay badges occupy. Only rendered for
          a debug node the selected execution actually reached, since that's
          the only node type that ever populates debug_snapshots. */}
      {reached && debugSnapshot && (
        <Popover open={debugPopoverOpen} onOpenChange={setDebugPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="workflow-node-overlay-button absolute -right-2 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] shadow-md shadow-[hsl(var(--success))]/30 ring-2 ring-[hsl(var(--card))] nodrag nopan"
              title="View captured snapshot"
            >
              <Bug size={12} strokeWidth={2.5} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="nodrag nopan w-80 p-0"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-[hsl(var(--success))]/20 bg-[hsl(var(--success))]/10 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--success))]">
                {debugSnapshot.label || 'Debug snapshot'}
              </span>
              <button
                onClick={() => copyOverlayText(JSON.stringify(debugSnapshot.variables ?? {}, null, 2))}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--card))]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
                title="Copy to clipboard"
              >
                {errorCopied ? <Check size={11} /> : <Copy size={11} />}
                {errorCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto px-3 py-2.5">
              {debugSnapshot.watches && debugSnapshot.watches.length > 0 && (
                <div className="mb-2.5 space-y-1.5 border-b border-[hsl(var(--border))] pb-2.5">
                  {debugSnapshot.watches.map((w, i) => (
                    <div key={i} className="text-[11px]">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-semibold text-[hsl(var(--foreground))]/80">{w.name || `watch ${i + 1}`}</span>
                        <code className="truncate font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{w.expression}</code>
                      </div>
                      {w.error ? (
                        <pre className="mt-0.5 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[hsl(var(--destructive))]">{w.error}</pre>
                      ) : (
                        <pre className="mt-0.5 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[hsl(var(--foreground))]">{JSON.stringify(w.value, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {debugSnapshot.variables && Object.keys(debugSnapshot.variables).length > 0 ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[hsl(var(--foreground))]">
                  {JSON.stringify(debugSnapshot.variables, null, 2)}
                </pre>
              ) : (
                <p className="text-[11px] italic text-[hsl(var(--muted-foreground))]">No workflow variables declared.</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Execution overlay: node warning popover — top-left, the one corner
          none of the other overlay badges occupy (bottom-left: message/
          error; bottom-right: status; right-middle: debug snapshot). A
          warning is non-fatal and doesn't change NodeStatus (still
          COMPLETED here) — today populated only by an Iterator that
          processed zero items, so it needs its own visible signal or it's
          silently indistinguishable from a loop that ran normally. */}
      {reached && nodeWarning && (
        <Popover open={warningPopoverOpen} onOpenChange={setWarningPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="workflow-node-overlay-button absolute -left-2 -top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] shadow-md shadow-[hsl(var(--warning))]/30 ring-2 ring-[hsl(var(--card))] nodrag nopan"
              title="View warning"
            >
              <AlertTriangle size={12} strokeWidth={2.5} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="nodrag nopan w-80 p-0"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))]/10 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--warning))]">Warning</span>
              <button
                onClick={() => copyOverlayText(nodeWarning)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--card))]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
                title="Copy to clipboard"
              >
                {errorCopied ? <Check size={11} /> : <Copy size={11} />}
                {errorCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto px-3 py-2.5">
              <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[hsl(var(--foreground))]">{nodeWarning}</p>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Quick-action toolbar — floats above the node on hover / selection */}
      {(canDelete || canDuplicate) && !draggingNodeId && (
        <div
          className={cn(
            'workflow-node-quick-actions absolute -top-8 right-0 z-20 flex items-center gap-0.5 rounded-full bg-[hsl(var(--card))] p-0.5 shadow-lg shadow-[hsl(var(--background))]/40 ring-1 ring-[hsl(var(--border))] nodrag nopan',
            selected
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-90 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto',
          )}
        >
          {canDuplicate && (
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                duplicateNode(id)
                setTimeout(() => applyDagreLayout('LR'), 0)
              }}
              title="Duplicate node"
            >
              <Copy size={12} strokeWidth={2.5} />
            </button>
          )}
          {canDelete && (
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                deleteNode(id)
                setTimeout(() => applyDagreLayout('LR'), 0)
              }}
              title={data.type === 'iterator' || data.type === 'loop_end'
                ? 'Delete loop (keeps body steps)'
                : 'Delete node (reconnects the chain)'}
            >
              <Trash2 size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="workflow-node-header relative flex items-center gap-2 px-2.5 py-2">
        {/* Drag grip — initiates reorder drag (only this is draggable).
            Native HTML5 `draggable`, unlike dnd-kit elsewhere in this app
            (see ElementCard.tsx's "Space to drag, arrows to move" grip),
            has no built-in keyboard-operable equivalent, and there's no
            separate non-drag path to the same reorder outcome the way
            NodePalette's click-to-add has for its own drag/click pair.
            Known, tracked gap — not fixed here; a real fix means replacing
            this with a dnd-kit-style keyboard sensor, which is a materially
            bigger change than adding a role to it would honestly imply. */}
        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className="workflow-node-drag-handle flex h-7 w-4 shrink-0 cursor-grab items-center justify-center rounded nodrag nopan"
          title="Drag to reorder"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} strokeWidth={2.25} />
        </div>
        <div className="workflow-node-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
          <Icon size={15} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="workflow-node-title truncate">{data.label}</p>
          <p className="workflow-node-meta truncate">{nodeMeta}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {setupIssue && (
            <span className="workflow-node-setup-flag flex h-6 w-6 items-center justify-center rounded-md" title={`Needs setup: ${setupIssue}`}>
              <AlertTriangle size={12} strokeWidth={2.5} aria-hidden="true" />
              <span className="sr-only">Needs setup: {setupIssue}</span>
            </span>
          )}
          {info && (
            <span className="workflow-node-step" title={`Execution step ${info.step}${info.wave > 0 ? `, wave ${info.wave}` : ''}`}>
              {info.step}{info.wave > 0 ? <small>W{info.wave}</small> : null}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="workflow-node-body px-3 py-2.5">
        <NodeBody data={data} triggerPresetLabel={triggerPreset?.display_name} />
      </div>

      {/* Output handles — right edge */}
      {hasOutputs && data.outputs.map((port, i) => {
        const top = `${((i + 1) / (data.outputs.length + 1)) * 100}%`
        const isTrue  = port.id === 'true'
        const isFalse = port.id === 'false'
        return (
          <div key={port.id}>
            <Handle
              id={port.id}
              type="source"
              position={Position.Right}
              className={cn(
                'workflow-node-handle workflow-node-handle--output',
                isTrue ? 'workflow-node-handle--true' : isFalse ? 'workflow-node-handle--false' : '',
              )}
              style={{ top }}
            />
            {data.outputs.length > 1 && (
              <span
                className={cn(
                  'workflow-node-port-label absolute -right-14 -translate-y-1/2 pointer-events-none select-none',
                  isTrue ? 'workflow-node-port-label--true' : isFalse ? 'workflow-node-port-label--false' : '',
                )}
                style={{ top }}
              >
                {port.label}
              </span>
            )}
          </div>
        )
      })}

      {/* + button beside leaf nodes (no outgoing edge, not dragging) */}
      {showAddButton && !draggingNodeId && (
        <div className="absolute -right-9 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          <div className="h-px w-3.5 bg-[hsl(var(--border))]" />
          <button
            className="workflow-node-add pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-md shadow-[hsl(var(--primary))]/30 ring-4 ring-[hsl(var(--card))] nodrag nopan"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => handleAddClick(e, data.outputs[0]?.id ?? 'out')}
            title="Add next node"
          >
            <Plus size={13} strokeWidth={2.75} />
          </button>
        </div>
      )}

      {/* Branch-point hover toolbar — appears where this node fans out into
          2+ parallel siblings. Mirrors the reference builder's fork popover:
          reorder the last two branches, delete the rightmost branch, or add
          a new parallel branch. */}
      {isBranchPoint && !draggingNodeId && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -bottom-9 z-20 flex flex-col items-center"
          onMouseEnter={() => setBranchToolbarOpen(true)}
          onMouseLeave={() => setBranchToolbarOpen(false)}
        >
          <div className="h-3.5 w-px bg-[hsl(var(--border))]" />
          <div
            className={cn(
              'workflow-node-branch-toolbar pointer-events-auto flex items-center gap-0.5 rounded-full bg-[hsl(var(--card))] p-1 shadow-lg shadow-[hsl(var(--background))]/40 ring-1 ring-[hsl(var(--border))] nodrag nopan',
              branchToolbarOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none',
            )}
          >
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                swapLastTwoBranches(id)
                setTimeout(() => applyDagreLayout('LR'), 0)
              }}
              title="Reorder branches"
            >
              <ArrowLeftRight size={12} strokeWidth={2.5} />
            </button>
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--destructive))] transition-colors hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                deleteBranch(id, branchChildIds[branchChildIds.length - 1])
                setTimeout(() => applyDagreLayout('LR'), 0)
              }}
              title="Delete last branch"
            >
              <Trash2 size={12} strokeWidth={2.5} />
            </button>
            <button
              className="workflow-node-branch-add flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => handleAddClick(e, data.outputs[0]?.id ?? 'out')}
              title="Add node in a new branch"
            >
              <GitBranchPlus size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
    </ContextMenuTrigger>
    {/* nodrag/nopan + stopPropagation: this content is portalled outside the
        canvas pane's own DOM subtree, but React re-dispatches its synthetic
        events through the React tree (which IS still nested under this
        node) — without these, a click inside the menu would bubble to
        ReactFlow's pane handlers the same way the overlay Popovers above
        already guard against. */}
    <ContextMenuContent
      className="nodrag nopan"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onCloseAutoFocus={(e) => e.preventDefault()}
    >
      <ContextMenuLabel>{data.label}</ContextMenuLabel>
      <ContextMenuItem onSelect={() => selectNode(id)}>
        <PanelRight size={13} strokeWidth={2.25} />
        Open
      </ContextMenuItem>
      {(canDuplicate || canDelete) && <ContextMenuSeparator />}
      {canDuplicate && (
        <ContextMenuItem
          onSelect={() => {
            duplicateNode(id)
            setTimeout(() => applyDagreLayout('LR'), 0)
          }}
        >
          <Copy size={13} strokeWidth={2.25} />
          Duplicate
        </ContextMenuItem>
      )}
      {canDelete && (
        <ContextMenuItem
          destructive
          onSelect={() => {
            deleteNode(id)
            setTimeout(() => applyDagreLayout('LR'), 0)
          }}
        >
          <Trash2 size={13} strokeWidth={2.25} />
          {deleteLabel}
        </ContextMenuItem>
      )}
    </ContextMenuContent>
    </ContextMenu>
  )
}

// ---------------------------------------------------------------------------

function NodeBody({ data, triggerPresetLabel }: { data: FlowNode['data']; triggerPresetLabel?: string }) {
  switch (data.type) {
    case 'entry':
      return <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Workflow starts here</p>
    case 'trigger': {
      const cfg = data.configuration as TriggerConfig | undefined
      if (!cfg?.mode) return <p className="text-[11px] italic text-[hsl(var(--muted-foreground))]">Not configured</p>
      const labels: Record<TriggerConfig['mode'], string> = {
        on_demand: 'On demand', scheduled: 'Scheduled',
        before: 'Before write', after: 'After write', after_async: 'After write (async)',
        on_demand_data_driven: 'On demand (with a record)',
        // A plain webhook mode reads generically here — an applied trigger
        // preset (e.g. "WhatsApp — On Message") overrides this flat label
        // below, same as it overrides the header label.
        webhook: 'Webhook',
        executed_by_workflow: 'Executed by workflow',
        on_error: 'On error',
      }
      return (
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center gap-1">
            <code className="rounded bg-[hsl(var(--success))]/10 px-1 py-0.5 font-semibold text-[hsl(var(--success))]">
              {cfg.mode === 'webhook' && triggerPresetLabel ? triggerPresetLabel : labels[cfg.mode]}
            </code>
            {cfg.enabled === false && <span className="rounded bg-[hsl(var(--muted))] px-1 text-[hsl(var(--muted-foreground))]">disabled</span>}
          </div>
          {cfg.mode === 'scheduled' && cfg.cron && (
            <code className="block truncate rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{cfg.cron}</code>
          )}
          {(cfg.mode === 'before' || cfg.mode === 'after' || cfg.mode === 'after_async') && (
            <p className="truncate text-[hsl(var(--muted-foreground))]">{cfg.event_type ?? '…'} on {cfg.form_id ? cfg.form_id.slice(0, 8) + '…' : 'no form'}</p>
          )}
        </div>
      )
    }
    case 'show_message': {
      const cfg = data.configuration as ShowMessageConfig | undefined
      if (!cfg?.message) return <p className="text-[11px] italic text-[hsl(var(--muted-foreground))]">No message set</p>
      const typeColor: Record<ShowMessageConfig['message_type'], string> = {
        success: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]', error: 'bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]', info: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
      }
      return (
        <div className="space-y-1 text-[10px]">
          <code className={cn('rounded px-1 py-0.5 font-semibold', typeColor[cfg.message_type])}>{cfg.message_type}</code>
          <p className="truncate text-[hsl(var(--muted-foreground))]">{cfg.message}</p>
        </div>
      )
    }
    case 'notification': {
      const cfg = data.configuration as NotificationConfig | undefined
      if (!cfg?.title) return <p className="text-[11px] italic text-[hsl(var(--muted-foreground))]">No title set</p>
      const severityColor: Record<NotificationConfig['severity'], string> = {
        success: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]', error: 'bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]',
        warning: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]', info: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
      }
      const recipient = cfg.recipient_mode === 'expression' ? cfg.recipient_expr : cfg.recipient_user_id
      return (
        <div className="space-y-1 text-[10px]">
          <code className={cn('rounded px-1 py-0.5 font-semibold', severityColor[cfg.severity])}>{cfg.severity}</code>
          <p className="truncate text-[hsl(var(--muted-foreground))]">{cfg.title}</p>
          {recipient && <p className="truncate text-[hsl(var(--muted-foreground))]">to: {recipient}</p>}
        </div>
      )
    }
    case 'exit':
      return <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Workflow ends here</p>
    case 'merge':
      return <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Joins parallel branches</p>
    case 'set_variable': {
      const cfg = data.configuration as SetVariableConfig
      const assignments: VariableAssignment[] = cfg?.assignments ?? []
      if (assignments.length === 0) return <p className="text-[11px] italic text-[hsl(var(--muted-foreground))]">Not configured</p>
      return (
        <div className="space-y-1">
          {assignments.slice(0, 3).map((a, i) => (
            <div key={a.id ?? i} className="flex items-center gap-1 text-[10px]">
              <code className="shrink-0 rounded bg-[hsl(var(--primary))]/10 px-1 py-0.5 font-semibold text-[hsl(var(--primary))]">{a.variable_name || '…'}</code>
              <span className="text-[hsl(var(--muted-foreground))]/60">=</span>
              {a.mode === 'literal'
                ? <code className="truncate text-[hsl(var(--muted-foreground))]">{String(a.literal_value ?? '""')}</code>
                : <code className="truncate italic text-[hsl(var(--primary))]/80">{'{'}{'{'}…{'}'}{'}'}</code>
              }
            </div>
          ))}
          {assignments.length > 3 && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">+{assignments.length - 3} more…</p>
          )}
        </div>
      )
    }
    case 'condition': {
      const cfg = data.configuration as ConditionConfig
      if (!cfg?.expression) return <p className="text-[11px] italic text-[hsl(var(--muted-foreground))]">No expression set</p>
      return <code className="block truncate rounded bg-[hsl(var(--muted))] px-1.5 py-1 font-mono text-[10px] text-[hsl(var(--foreground))]">{cfg.expression}</code>
    }
    case 'subflow': {
      const cfg = data.configuration as { definition_id?: string; sync?: boolean }
      if (!cfg?.definition_id) return <p className="text-[11px] italic text-[hsl(var(--muted-foreground))]">No workflow selected</p>
      return (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
          ↳ {cfg.definition_id.slice(0, 8)}… <span className="text-[hsl(var(--muted-foreground))]/70">· {cfg.sync === false ? 'fire and forget' : 'waits for result'}</span>
        </p>
      )
    }
    case 'loop_end':
      return <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Marks the end of the loop body</p>
    case 'iterator': {
      const cfg = data.configuration as IteratorConfig | undefined
      if (!cfg?.source_expr) return <p className="text-[11px] italic text-[hsl(var(--muted-foreground))]">No source list set</p>
      const itemV = cfg.item_var || 'item'
      const idxV = cfg.index_var || 'index'
      return (
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="text-[hsl(var(--muted-foreground))]">for</span>
            <code className="rounded bg-[hsl(var(--warning))]/10 px-1 py-0.5 font-semibold text-[hsl(var(--warning))]">{itemV}</code>
            <span className="text-[hsl(var(--muted-foreground))]/60">,</span>
            <code className="rounded bg-[hsl(var(--warning))]/10 px-1 py-0.5 font-semibold text-[hsl(var(--warning))]">{idxV}</code>
            <span className="text-[hsl(var(--muted-foreground))]">in</span>
          </div>
          <code className="block truncate rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{cfg.source_expr}</code>
          {(cfg.filter_expr || cfg.stop_expr || cfg.continue_on_error) && (
            <div className="flex gap-1 text-[hsl(var(--muted-foreground))]">
              {cfg.filter_expr && <span className="rounded bg-[hsl(var(--muted))] px-1">filter</span>}
              {cfg.stop_expr && <span className="rounded bg-[hsl(var(--muted))] px-1">stop</span>}
              {cfg.continue_on_error && <span className="rounded bg-[hsl(var(--warning))]/10 px-1 text-[hsl(var(--warning))]">continue on error</span>}
            </div>
          )}
        </div>
      )
    }
    case 'fetch_records': {
      const cfg = data.configuration as FetchRecordsConfig | undefined
      if (!cfg?.form_id) return <p className="text-[11px] italic text-[hsl(var(--muted-foreground))]">No form selected</p>
      const conds = countConditions(cfg.filter)
      return (
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center gap-1">
            <code className="rounded bg-[hsl(var(--destructive))]/10 px-1 py-0.5 font-semibold text-[hsl(var(--destructive))]">{cfg.mode === 'one' ? 'single' : 'multiple'}</code>
            {conds > 0 && <span className="text-[hsl(var(--muted-foreground))]">· {conds} filter{conds > 1 ? 's' : ''}</span>}
            {cfg.limit ? <span className="text-[hsl(var(--muted-foreground))]">· top {cfg.limit}</span> : null}
          </div>
          {cfg.output_var && (
            <div className="flex items-center gap-1">
              <span className="text-[hsl(var(--muted-foreground))]/60">→</span>
              <code className="truncate font-semibold text-[hsl(var(--primary))]">{cfg.output_var}</code>
            </div>
          )}
        </div>
      )
    }
    case 'http_request': {
      const cfg = data.configuration as HttpRequestConfig | undefined
      const url = cfg?.url_mode === 'expression' ? cfg?.url_expr : cfg?.url
      if (!url) return <p className="text-[11px] italic text-[hsl(var(--muted-foreground))]">No URL set</p>
      return (
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center gap-1.5">
            <code className="shrink-0 rounded bg-[hsl(var(--primary))]/10 px-1 py-0.5 font-semibold text-[hsl(var(--primary))]">{cfg?.method ?? 'GET'}</code>
            <code className="truncate text-[hsl(var(--muted-foreground))]">{url}</code>
          </div>
          {cfg?.auth_type && cfg.auth_type !== 'none' && (
            <span className="rounded bg-[hsl(var(--muted))] px-1 text-[hsl(var(--muted-foreground))]">auth: {cfg.auth_type}</span>
          )}
        </div>
      )
    }
    case 'debug': {
      const cfg = data.configuration as DebugConfig | undefined
      const watchCount = cfg?.watches?.length ?? 0
      return (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
          {cfg?.label ? <span className="text-[hsl(var(--success))]">{cfg.label}</span> : 'Captures a variable snapshot here'}
          {watchCount > 0 && <span className="ml-1.5 text-[hsl(var(--muted-foreground))]">· {watchCount} watch{watchCount === 1 ? '' : 'es'}</span>}
        </p>
      )
    }
    default:
      return null
  }
}

// Counts leaf conditions across a (possibly nested) filter group.
function countConditions(g: FilterGroup | undefined): number {
  if (!g) return 0
  let n = g.conditions?.length ?? 0
  for (const sub of g.groups ?? []) n += countConditions(sub)
  return n
}

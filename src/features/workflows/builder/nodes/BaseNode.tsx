import { useMemo, useState } from 'react'
import { Handle, Position, type NodeProps, useStore } from '@xyflow/react'
import { Plus, GripVertical, ArrowLeftRight, Trash2, GitBranchPlus, Copy, Check, AlertTriangle, AlertCircle, CheckCircle2, XCircle, MinusCircle, Loader2, MessageCircle, Bug } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NODE_REGISTRY } from '../node-registry'
import { useBuilderStore, DUPLICABLE_NODE_TYPES, type FlowNode, type DropPosition } from '../store'
import { computeExecutionOrder } from '../executionOrder'
import { nodeSetupIssue } from '../node-validation'
import { useExecutionOverlayStore } from '../execution-overlay-store'
import type { NodeExecutionStatus } from '@/features/executions/types'
import { DropZone } from './DropZone'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import type { SetVariableConfig, ConditionConfig, VariableAssignment, FetchRecordsConfig, FilterGroup, IteratorConfig, HttpRequestConfig, TriggerConfig, ShowMessageConfig, NotificationConfig, DebugConfig } from '../../types'

const DRAG_TRANSFER_KEY = 'application/workflow-node-reorder'

// Execution overlay styling (FR-C5-007) — mirrors ExecutionDetailPage's own
// statusVariant color family so the canvas and the execution detail view
// read as one consistent system. RUNNING/PENDING never appear per-node here
// (a node only enters node_statuses once it's reached a terminal outcome or
// is actively running), but are included for completeness against the full
// NodeExecutionStatus union.
const overlayStatusStyle: Record<NodeExecutionStatus, string> = {
  PENDING:                'bg-slate-100 text-slate-500',
  RUNNING:                'bg-blue-100 text-blue-700',
  COMPLETED:              'bg-emerald-100 text-emerald-700',
  FAILED:                 'bg-red-100 text-red-700',
  SKIPPED:                'bg-slate-100 text-slate-400',
  // An iterator with continue_on_error that ran every item but had failures
  // (FR-B2-015) — amber, distinct from both a clean COMPLETED and a FAILED.
  COMPLETED_WITH_ERRORS:  'bg-amber-100 text-amber-700',
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
  return status
}

export function BaseNode({ id, data, selected }: NodeProps<FlowNode>) {
  const reg        = NODE_REGISTRY[data.type]
  const Icon       = reg.icon
  const hasInputs  = data.inputs?.length  > 0
  const hasOutputs = data.outputs?.length > 0

  // Show + button below this node only if it's a leaf (no outgoing edges) and not exit
  const outgoingEdges   = useStore((s) => s.edges.filter((e) => e.source === id))
  const hasOutgoingEdge = outgoingEdges.length > 0
  const showAddButton   = hasOutputs && !hasOutgoingEdge && data.type !== 'exit'

  // This node is a "branch point" once it fans out to 2+ children off the same
  // handle (parallel siblings) — matches the reference builder's fork toolbar.
  const branchChildIds = useMemo(
    () => Array.from(new Set(outgoingEdges.map((e) => e.target))),
    [outgoingEdges],
  )
  const isBranchPoint = branchChildIds.length > 1
  const [branchToolbarOpen, setBranchToolbarOpen] = useState(false)

  const openPicker          = useBuilderStore((s) => s.openPicker)
  const draggingNodeId      = useBuilderStore((s) => s.draggingNodeId)
  const activeDropTarget    = useBuilderStore((s) => s.activeDropTarget)
  const setDraggingNode     = useBuilderStore((s) => s.setDraggingNode)
  const setActiveDropTarget = useBuilderStore((s) => s.setActiveDropTarget)
  const reorderNode         = useBuilderStore((s) => s.reorderNode)
  const applyDagreLayout    = useBuilderStore((s) => s.applyDagreLayout)
  const addConnectedNode    = useBuilderStore((s) => s.addConnectedNode)
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
  const overlayActive    = overlayExecution != null
  const nodeStatus: NodeExecutionStatus | undefined = overlayExecution?.node_statuses?.[id]
  const nodeError                                   = overlayExecution?.node_errors?.[id]
  const nodeMessage                                 = overlayExecution?.messages?.find((m) => m.node_id === id)
  const failedItems                                 = overlayExecution?.iterator_failed_items?.[id]
  const debugSnapshot                               = overlayExecution?.debug_snapshots?.[id]
  const reached          = overlayActive && nodeStatus !== undefined
  const dimUnreached     = overlayActive && !reached
  const [overlayNoteOpen, setOverlayNoteOpen] = useState(false)
  const [debugPopoverOpen, setDebugPopoverOpen] = useState(false)
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
    setTimeout(() => applyDagreLayout('TB'), 0)
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

  return (
    <div
      className={cn(
        'group relative w-[200px] rounded-2xl border bg-white transition-all duration-150',
        selected
          ? 'border-blue-400 ring-2 ring-blue-400/30 shadow-lg shadow-blue-500/10'
          : 'border-slate-200/80 shadow-sm hover:border-slate-300 hover:shadow-md',
        isDraggingThis ? 'opacity-40 scale-95' : '',
        dimForDrag ? 'opacity-40' : '',
        // A node the selected execution never reached (e.g. a condition's
        // untaken branch) recedes rather than showing a misleading badge.
        dimUnreached ? 'opacity-35' : '',
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

      {/* Input handles — top edge */}
      {hasInputs && data.inputs.map((port, i) => (
        <Handle
          key={port.id}
          id={port.id}
          type="target"
          position={Position.Top}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-400 transition-colors"
          style={{ left: `${((i + 1) / (data.inputs.length + 1)) * 100}%` }}
        />
      ))}

      {/* Execution position badge — floats above-left of the node */}
      {info && (
        <div className="absolute -top-3 -left-3 z-10 flex items-center gap-1">
          <div className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-700 px-1.5 text-[11px] font-bold tabular-nums text-white shadow-md shadow-black/20 ring-2 ring-white">
            {info.step}
          </div>
          {info.wave > 0 && (
            <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-500/90 px-1 text-[9px] font-semibold tabular-nums text-white/90 shadow ring-2 ring-white">
              W{info.wave}
            </div>
          )}
        </div>
      )}

      {/* Needs-setup badge — the node can't run until this is resolved */}
      {setupIssue && (
        <div
          className="absolute -top-2 -right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white shadow-md shadow-amber-500/30 ring-2 ring-white"
          title={setupIssue}
        >
          <AlertTriangle size={11} strokeWidth={2.75} />
        </div>
      )}

      {/* Execution overlay: status + duration badge (FR-C5-007) — bottom-right,
          a corner distinct from the execution-order badge (top-left) and the
          setup-issue badge (top-right). Only rendered for a node the
          selected execution actually reached. */}
      {reached && nodeStatus && (
        <div
          className={cn(
            'absolute -bottom-2 -right-2 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shadow-md ring-2 ring-white',
            overlayStatusStyle[nodeStatus],
          )}
          title={overlayStatusLabel(nodeStatus)}
        >
          {overlayStatusIcon[nodeStatus]}
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
                'absolute -bottom-2 -left-2 z-20 flex h-6 w-6 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white transition-transform hover:scale-110 nodrag nopan',
                nodeStatus === 'COMPLETED_WITH_ERRORS' ? 'bg-amber-500 shadow-amber-500/30'
                  : nodeError || nodeMessage?.message_type === 'error' ? 'bg-red-500 shadow-red-500/30'
                  : nodeMessage?.message_type === 'info' ? 'bg-amber-500 shadow-amber-500/30'
                  : 'bg-emerald-500 shadow-emerald-500/30',
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
              nodeStatus === 'COMPLETED_WITH_ERRORS' ? 'border-amber-100 bg-amber-50'
                : nodeError ? 'border-red-100 bg-red-50'
                : nodeMessage?.message_type === 'info' ? 'border-amber-100 bg-amber-50'
                : 'border-emerald-100 bg-emerald-50',
            )}>
              <span className={cn(
                'text-[11px] font-semibold uppercase tracking-wide',
                nodeStatus === 'COMPLETED_WITH_ERRORS' ? 'text-amber-700'
                  : nodeError ? 'text-red-700'
                  : nodeMessage?.message_type === 'info' ? 'text-amber-700'
                  : 'text-emerald-700',
              )}>
                {failedItems?.length ? `${failedItems.length} item${failedItems.length > 1 ? 's' : ''} failed` : nodeError ? 'Node error' : nodeMessage?.message_type}
              </span>
              <button
                onClick={() => copyOverlayText(nodeError ?? nodeMessage?.message ?? '')}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:bg-white/60"
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
                    <li key={fi.index} className="rounded-lg bg-amber-50/60 px-2 py-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700">
                        <span className="rounded bg-amber-100 px-1 py-0.5">index {fi.index}</span>
                        {fi.item !== undefined && (
                          <code className="truncate font-mono text-[10px] font-normal text-slate-500">
                            {typeof fi.item === 'string' ? fi.item : JSON.stringify(fi.item)}
                          </code>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-red-700">{fi.error}</p>
                    </li>
                  ))}
                </ul>
              ) : nodeError ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-red-700">{nodeError}</pre>
              ) : nodeMessage ? (
                <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-slate-700">{nodeMessage.message}</p>
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
              className="absolute -right-2 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-lime-600 text-white shadow-md shadow-lime-600/30 ring-2 ring-white transition-transform hover:scale-110 nodrag nopan"
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
            <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-lime-100 bg-lime-50 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-lime-700">
                {debugSnapshot.label || 'Debug snapshot'}
              </span>
              <button
                onClick={() => copyOverlayText(JSON.stringify(debugSnapshot.variables ?? {}, null, 2))}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:bg-white/60"
                title="Copy to clipboard"
              >
                {errorCopied ? <Check size={11} /> : <Copy size={11} />}
                {errorCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto px-3 py-2.5">
              {debugSnapshot.variables && Object.keys(debugSnapshot.variables).length > 0 ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-700">
                  {JSON.stringify(debugSnapshot.variables, null, 2)}
                </pre>
              ) : (
                <p className="text-[11px] italic text-slate-400">No workflow variables declared.</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Quick-action toolbar — floats above the node on hover / selection */}
      {(canDelete || canDuplicate) && !draggingNodeId && (
        <div
          className={cn(
            'absolute -top-8 right-0 z-20 flex items-center gap-0.5 rounded-full bg-white p-0.5 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200 transition-all duration-150 nodrag nopan',
            selected
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-90 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto',
          )}
        >
          {canDuplicate && (
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                duplicateNode(id)
                setTimeout(() => applyDagreLayout('TB'), 0)
              }}
              title="Duplicate node"
            >
              <Copy size={12} strokeWidth={2.5} />
            </button>
          )}
          {canDelete && (
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                deleteNode(id)
                setTimeout(() => applyDagreLayout('TB'), 0)
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
      <div className={cn('relative flex items-center gap-2 rounded-t-2xl px-2 py-1.5', reg.gradient)}>
        {/* Drag grip — initiates reorder drag (only this is draggable) */}
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className="flex h-7 w-4 shrink-0 cursor-grab items-center justify-center rounded text-white/40 transition-colors hover:bg-white/15 hover:text-white/80 active:cursor-grabbing nodrag nopan"
          title="Drag to reorder"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} strokeWidth={2.25} />
        </div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/20 ring-1 ring-white/25">
          <Icon size={15} strokeWidth={2.25} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-white">{data.label}</p>
          <p className="text-[9px] font-medium uppercase tracking-wider text-white/70 leading-tight">{reg.label}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        <NodeBody data={data} />
      </div>

      {/* Output handles — bottom edge */}
      {hasOutputs && data.outputs.map((port, i) => {
        const left = `${((i + 1) / (data.outputs.length + 1)) * 100}%`
        const isTrue  = port.id === 'true'
        const isFalse = port.id === 'false'
        return (
          <div key={port.id}>
            <Handle
              id={port.id}
              type="source"
              position={Position.Bottom}
              className={cn(
                '!h-2.5 !w-2.5 !border-2 !border-white transition-colors',
                isTrue ? '!bg-emerald-500' : isFalse ? '!bg-rose-500' : '!bg-blue-500',
              )}
              style={{ left }}
            />
            {data.outputs.length > 1 && (
              <span
                className={cn(
                  'absolute bottom-[-1.15rem] text-[9px] font-semibold pointer-events-none select-none',
                  isTrue ? 'text-emerald-600' : isFalse ? 'text-rose-600' : 'text-slate-400',
                )}
                style={{ left, transform: 'translateX(-50%)' }}
              >
                {port.label}
              </span>
            )}
          </div>
        )
      })}

      {/* + button below leaf nodes (no outgoing edge, not dragging) */}
      {showAddButton && !draggingNodeId && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-9 flex flex-col items-center pointer-events-none">
          <div className="h-3.5 w-px bg-slate-300" />
          <button
            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white shadow-md shadow-blue-500/30 ring-4 ring-white hover:bg-blue-600 hover:scale-110 transition-all nodrag nopan"
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
          <div className="h-3.5 w-px bg-slate-300" />
          <div
            className={cn(
              'pointer-events-auto flex items-center gap-0.5 rounded-full bg-white p-1 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200 transition-all duration-150 nodrag nopan',
              branchToolbarOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none',
            )}
          >
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                swapLastTwoBranches(id)
                setTimeout(() => applyDagreLayout('TB'), 0)
              }}
              title="Reorder branches"
            >
              <ArrowLeftRight size={12} strokeWidth={2.5} />
            </button>
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                deleteBranch(id, branchChildIds[branchChildIds.length - 1])
                setTimeout(() => applyDagreLayout('TB'), 0)
              }}
              title="Delete last branch"
            >
              <Trash2 size={12} strokeWidth={2.5} />
            </button>
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm transition-all hover:bg-blue-600 hover:scale-110"
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
  )
}

// ---------------------------------------------------------------------------

function NodeBody({ data }: { data: FlowNode['data'] }) {
  switch (data.type) {
    case 'entry':
      return <p className="text-[11px] text-slate-400">Workflow starts here</p>
    case 'trigger': {
      const cfg = data.configuration as TriggerConfig | undefined
      if (!cfg?.mode) return <p className="text-[11px] italic text-slate-400">Not configured</p>
      const labels: Record<TriggerConfig['mode'], string> = {
        on_demand: 'On demand', scheduled: 'Scheduled',
        before: 'Before write', after: 'After write', after_async: 'After write (async)',
      }
      return (
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center gap-1">
            <code className="rounded bg-emerald-50 px-1 py-0.5 font-semibold text-emerald-700">{labels[cfg.mode]}</code>
            {cfg.enabled === false && <span className="rounded bg-slate-100 px-1 text-slate-400">disabled</span>}
          </div>
          {cfg.mode === 'scheduled' && cfg.cron && (
            <code className="block truncate rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{cfg.cron}</code>
          )}
          {(cfg.mode === 'before' || cfg.mode === 'after' || cfg.mode === 'after_async') && (
            <p className="truncate text-slate-400">{cfg.event_type ?? '…'} on {cfg.form_id ? cfg.form_id.slice(0, 8) + '…' : 'no form'}</p>
          )}
        </div>
      )
    }
    case 'show_message': {
      const cfg = data.configuration as ShowMessageConfig | undefined
      if (!cfg?.message) return <p className="text-[11px] italic text-slate-400">No message set</p>
      const typeColor: Record<ShowMessageConfig['message_type'], string> = {
        success: 'bg-emerald-50 text-emerald-700', error: 'bg-red-50 text-red-700', info: 'bg-sky-50 text-sky-700',
      }
      return (
        <div className="space-y-1 text-[10px]">
          <code className={cn('rounded px-1 py-0.5 font-semibold', typeColor[cfg.message_type])}>{cfg.message_type}</code>
          <p className="truncate text-slate-500">{cfg.message}</p>
        </div>
      )
    }
    case 'notification': {
      const cfg = data.configuration as NotificationConfig | undefined
      if (!cfg?.title) return <p className="text-[11px] italic text-slate-400">No title set</p>
      const severityColor: Record<NotificationConfig['severity'], string> = {
        success: 'bg-emerald-50 text-emerald-700', error: 'bg-red-50 text-red-700',
        warning: 'bg-amber-50 text-amber-700', info: 'bg-sky-50 text-sky-700',
      }
      const recipient = cfg.recipient_mode === 'expression' ? cfg.recipient_expr : cfg.recipient_user_id
      return (
        <div className="space-y-1 text-[10px]">
          <code className={cn('rounded px-1 py-0.5 font-semibold', severityColor[cfg.severity])}>{cfg.severity}</code>
          <p className="truncate text-slate-500">{cfg.title}</p>
          {recipient && <p className="truncate text-slate-400">to: {recipient}</p>}
        </div>
      )
    }
    case 'exit':
      return <p className="text-[11px] text-slate-400">Workflow ends here</p>
    case 'merge':
      return <p className="text-[11px] text-slate-400">Joins parallel branches</p>
    case 'set_variable': {
      const cfg = data.configuration as SetVariableConfig
      const assignments: VariableAssignment[] = cfg?.assignments ?? []
      if (assignments.length === 0) return <p className="text-[11px] italic text-slate-400">Not configured</p>
      return (
        <div className="space-y-1">
          {assignments.slice(0, 3).map((a, i) => (
            <div key={a.id ?? i} className="flex items-center gap-1 text-[10px]">
              <code className="shrink-0 rounded bg-blue-50 px-1 py-0.5 font-semibold text-blue-700">{a.variable_name || '…'}</code>
              <span className="text-slate-300">=</span>
              {a.mode === 'literal'
                ? <code className="truncate text-slate-500">{String(a.literal_value ?? '""')}</code>
                : <code className="truncate italic text-violet-500">{'{'}{'{'}…{'}'}{'}'}</code>
              }
            </div>
          ))}
          {assignments.length > 3 && (
            <p className="text-[10px] text-slate-400">+{assignments.length - 3} more…</p>
          )}
        </div>
      )
    }
    case 'condition': {
      const cfg = data.configuration as ConditionConfig
      if (!cfg?.expression) return <p className="text-[11px] italic text-slate-400">No expression set</p>
      return <code className="block truncate rounded bg-slate-100 px-1.5 py-1 font-mono text-[10px] text-slate-700">{cfg.expression}</code>
    }
    case 'subflow': {
      const cfg = data.configuration as { definition_id?: string }
      return <p className="text-[11px] italic text-slate-400">{cfg?.definition_id ? `↳ ${cfg.definition_id.slice(0, 8)}…` : 'Not linked'}</p>
    }
    case 'loop_end':
      return <p className="text-[11px] text-slate-400">Marks the end of the loop body</p>
    case 'iterator': {
      const cfg = data.configuration as IteratorConfig | undefined
      if (!cfg?.source_expr) return <p className="text-[11px] italic text-slate-400">No source list set</p>
      const itemV = cfg.item_var || 'item'
      const idxV = cfg.index_var || 'index'
      return (
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">for</span>
            <code className="rounded bg-amber-50 px-1 py-0.5 font-semibold text-amber-700">{itemV}</code>
            <span className="text-slate-300">,</span>
            <code className="rounded bg-amber-50 px-1 py-0.5 font-semibold text-amber-700">{idxV}</code>
            <span className="text-slate-400">in</span>
          </div>
          <code className="block truncate rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{cfg.source_expr}</code>
          {(cfg.filter_expr || cfg.stop_expr || cfg.continue_on_error) && (
            <div className="flex gap-1 text-slate-400">
              {cfg.filter_expr && <span className="rounded bg-slate-100 px-1">filter</span>}
              {cfg.stop_expr && <span className="rounded bg-slate-100 px-1">stop</span>}
              {cfg.continue_on_error && <span className="rounded bg-amber-50 px-1 text-amber-600">continue on error</span>}
            </div>
          )}
        </div>
      )
    }
    case 'fetch_records': {
      const cfg = data.configuration as FetchRecordsConfig | undefined
      if (!cfg?.form_id) return <p className="text-[11px] italic text-slate-400">No form selected</p>
      const conds = countConditions(cfg.filter)
      return (
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center gap-1">
            <code className="rounded bg-rose-50 px-1 py-0.5 font-semibold text-rose-700">{cfg.mode === 'one' ? 'single' : 'multiple'}</code>
            {conds > 0 && <span className="text-slate-400">· {conds} filter{conds > 1 ? 's' : ''}</span>}
            {cfg.limit ? <span className="text-slate-400">· top {cfg.limit}</span> : null}
          </div>
          {cfg.output_var && (
            <div className="flex items-center gap-1">
              <span className="text-slate-300">→</span>
              <code className="truncate font-semibold text-blue-700">{cfg.output_var}</code>
            </div>
          )}
        </div>
      )
    }
    case 'http_request': {
      const cfg = data.configuration as HttpRequestConfig | undefined
      const url = cfg?.url_mode === 'expression' ? cfg?.url_expr : cfg?.url
      if (!url) return <p className="text-[11px] italic text-slate-400">No URL set</p>
      return (
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center gap-1.5">
            <code className="shrink-0 rounded bg-cyan-50 px-1 py-0.5 font-semibold text-cyan-700">{cfg?.method ?? 'GET'}</code>
            <code className="truncate text-slate-500">{url}</code>
          </div>
          {cfg?.auth_type && cfg.auth_type !== 'none' && (
            <span className="rounded bg-slate-100 px-1 text-slate-400">auth: {cfg.auth_type}</span>
          )}
        </div>
      )
    }
    case 'debug': {
      const cfg = data.configuration as DebugConfig | undefined
      return (
        <p className="text-[11px] text-slate-400">
          {cfg?.label ? <span className="text-lime-600">{cfg.label}</span> : 'Captures a variable snapshot here'}
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

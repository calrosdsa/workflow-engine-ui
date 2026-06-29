import { useMemo } from 'react'
import { Handle, Position, type NodeProps, useStore } from '@xyflow/react'
import { Plus, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NODE_REGISTRY } from '../node-registry'
import { useBuilderStore, type FlowNode, type DropPosition } from '../store'
import { computeExecutionOrder } from '../executionOrder'
import { DropZone } from './DropZone'
import type { SetVariableConfig, ConditionConfig, VariableAssignment, FetchRecordsConfig, FilterGroup } from '../../types'

const DRAG_TRANSFER_KEY = 'application/workflow-node-reorder'

export function BaseNode({ id, data, selected }: NodeProps<FlowNode>) {
  const reg        = NODE_REGISTRY[data.type]
  const Icon       = reg.icon
  const hasInputs  = data.inputs?.length  > 0
  const hasOutputs = data.outputs?.length > 0

  // Show + button below this node only if it's a leaf (no outgoing edges) and not exit
  const hasOutgoingEdge = useStore((s) => s.edges.some((e) => e.source === id))
  const showAddButton   = hasOutputs && !hasOutgoingEdge && data.type !== 'exit'

  const openPicker          = useBuilderStore((s) => s.openPicker)
  const draggingNodeId      = useBuilderStore((s) => s.draggingNodeId)
  const activeDropTarget    = useBuilderStore((s) => s.activeDropTarget)
  const setDraggingNode     = useBuilderStore((s) => s.setDraggingNode)
  const setActiveDropTarget = useBuilderStore((s) => s.setActiveDropTarget)
  const reorderNode         = useBuilderStore((s) => s.reorderNode)
  const applyDagreLayout    = useBuilderStore((s) => s.applyDagreLayout)

  // Execution order badge
  const nodes    = useBuilderStore((s) => s.nodes)
  const edges    = useBuilderStore((s) => s.edges)
  const execInfo = useMemo(() => computeExecutionOrder(nodes, edges), [nodes, edges])
  const info     = execInfo.get(id)

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

  return (
    <div
      className={cn(
        'group relative w-[200px] rounded-2xl border bg-white transition-all duration-150',
        selected
          ? 'border-blue-400 ring-2 ring-blue-400/30 shadow-lg shadow-blue-500/10'
          : 'border-slate-200/80 shadow-sm hover:border-slate-300 hover:shadow-md',
        isDraggingThis ? 'opacity-40 scale-95' : '',
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
    </div>
  )
}

// ---------------------------------------------------------------------------

function NodeBody({ data }: { data: FlowNode['data'] }) {
  switch (data.type) {
    case 'entry':
      return <p className="text-[11px] text-slate-400">Workflow starts here</p>
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

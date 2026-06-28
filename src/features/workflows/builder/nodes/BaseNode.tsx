import { useMemo } from 'react'
import { Handle, Position, type NodeProps, useStore } from '@xyflow/react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NODE_REGISTRY } from '../node-registry'
import { useBuilderStore, type FlowNode } from '../store'
import { computeExecutionOrder } from '../executionOrder'
import type { SetVariableConfig, ConditionConfig } from '../../types'

export function BaseNode({ id, data, selected }: NodeProps<FlowNode>) {
  const reg = NODE_REGISTRY[data.type]
  const hasInputs  = data.inputs?.length  > 0
  const hasOutputs = data.outputs?.length > 0

  // Show + button below this node only if it's a leaf (no outgoing edges) and not the exit node
  const hasOutgoingEdge = useStore((s) => s.edges.some((e) => e.source === id))
  const showAddButton   = hasOutputs && !hasOutgoingEdge && data.type !== 'exit'

  const openPicker = useBuilderStore((s) => s.openPicker)

  // Compute execution order from live store state
  const nodes = useBuilderStore((s) => s.nodes)
  const edges = useBuilderStore((s) => s.edges)
  const execInfo = useMemo(() => computeExecutionOrder(nodes, edges), [nodes, edges])
  const info = execInfo.get(id)

  const handleAddClick = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation()
    openPicker({ kind: 'node', sourceNodeId: id, sourceHandle: handle })
  }

  return (
    <div
      className={cn(
        'min-w-[160px] rounded-xl border-2 transition-all bg-white shadow-md',
        selected ? 'border-blue-500 shadow-blue-200 shadow-lg' : 'border-gray-200 hover:border-gray-300',
      )}
    >
      {/* Input handles — top edge for vertical flow */}
      {hasInputs && data.inputs.map((port, i) => (
        <Handle
          key={port.id}
          id={port.id}
          type="target"
          position={Position.Top}
          style={{ left: `${((i + 1) / (data.inputs.length + 1)) * 100}%`, background: '#6b7280' }}
        />
      ))}

      {/* Header */}
      <div className={cn('flex items-center gap-2 rounded-t-xl px-3 py-2', reg.color)}>
        <NodeIcon type={data.type} />
        <span className="text-xs font-semibold text-white truncate flex-1">{data.label}</span>
        {info && (
          <span className="ml-auto shrink-0 rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-bold text-white tabular-nums leading-none">
            #{info.step} · W{info.wave}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <NodeBody data={data} />
      </div>

      {/* Output handles — bottom edge for vertical flow */}
      {hasOutputs && data.outputs.map((port, i) => (
        <div key={port.id}>
          <Handle
            id={port.id}
            type="source"
            position={Position.Bottom}
            style={{ left: `${((i + 1) / (data.outputs.length + 1)) * 100}%`, background: '#3b82f6' }}
          />
          {data.outputs.length > 1 && (
            <span
              className="absolute bottom-[-1.1rem] text-[9px] text-gray-400 pointer-events-none select-none"
              style={{ left: `${((i + 1) / (data.outputs.length + 1)) * 100}%`, transform: 'translateX(-50%)' }}
            >
              {port.label}
            </span>
          )}
        </div>
      ))}

      {/* + button below leaf nodes (no outgoing edge) */}
      {showAddButton && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-8 flex flex-col items-center gap-0.5 pointer-events-none">
          {/* Stem line */}
          <div className="w-px h-3 bg-gray-300" />
          {/* + circle */}
          <button
            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-400 bg-white text-blue-500 shadow-sm hover:bg-blue-50 hover:scale-110 transition-transform nodrag nopan"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => handleAddClick(e, data.outputs[0]?.id ?? 'out')}
            title="Add next node"
          >
            <Plus size={12} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  )
}

function NodeBody({ data }: { data: FlowNode['data'] }) {
  switch (data.type) {
    case 'entry':
      return <p className="text-[10px] text-gray-400">Workflow starts here</p>
    case 'exit':
      return <p className="text-[10px] text-gray-400">Workflow ends here</p>
    case 'merge':
      return <p className="text-[10px] text-gray-400">Join branches</p>
    case 'set_variable': {
      const cfg = data.configuration as SetVariableConfig
      if (!cfg?.variable_name) return <p className="text-[10px] text-gray-400 italic">Not configured</p>
      return (
        <p className="text-[10px] text-gray-600">
          <span className="font-semibold">{cfg.variable_name}</span>
          {' = '}
          {cfg.mode === 'literal'
            ? <span className="font-mono">{String(cfg.literal_value ?? '')}</span>
            : <span className="font-mono text-purple-600 italic">{cfg.expression || '…'}</span>
          }
        </p>
      )
    }
    case 'condition': {
      const cfg = data.configuration as ConditionConfig
      if (!cfg?.expression) return <p className="text-[10px] text-gray-400 italic">No expression</p>
      return <p className="font-mono text-[10px] text-gray-600 truncate">{cfg.expression}</p>
    }
    case 'subflow': {
      const cfg = data.configuration as { definition_id?: string }
      return <p className="text-[10px] text-gray-400 italic">{cfg?.definition_id ? `ID: ${cfg.definition_id.slice(0, 8)}…` : 'Not linked'}</p>
    }
    default:
      return null
  }
}

function NodeIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    entry:        '▶',
    exit:         '⏹',
    set_variable: '✦',
    condition:    '◆',
    subflow:      '⊞',
    merge:        '⊕',
  }
  return <span className="text-white text-xs select-none">{icons[type] ?? '●'}</span>
}

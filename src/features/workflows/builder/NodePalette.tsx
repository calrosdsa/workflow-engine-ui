import { useBuilderStore } from './store'
import { PALETTE_NODES, NODE_REGISTRY } from './node-registry'
import { cn } from '@/lib/utils'
import type { NodeType } from '../types'

export function NodePalette() {
  const { addNode } = useBuilderStore()

  const onDragStart = (e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData('application/xyflow-node-type', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="absolute left-2 top-2 z-10 flex flex-col gap-1.5 rounded-xl border bg-white/90 p-2 shadow-md backdrop-blur">
      <p className="px-1 text-[9px] font-semibold uppercase tracking-wider text-gray-400">Nodes</p>
      {PALETTE_NODES.map((type) => {
        const reg = NODE_REGISTRY[type]
        return (
          <div
            key={type}
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            onClick={() => addNode(type)}
            className={cn(
              'flex cursor-grab items-center gap-2 rounded-lg border px-2.5 py-1.5',
              'hover:shadow-sm active:cursor-grabbing transition-shadow',
              'text-xs font-medium text-gray-700 select-none',
              'bg-white hover:bg-gray-50',
            )}
            title={reg.description}
          >
            <span className={cn('h-2 w-2 rounded-full', reg.color)} />
            {reg.label}
          </div>
        )
      })}
    </div>
  )
}

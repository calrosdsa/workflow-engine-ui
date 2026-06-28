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
    <div className="absolute left-3 top-3 z-10 flex w-44 flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white/80 p-2 shadow-lg shadow-slate-900/5 backdrop-blur-md">
      <p className="px-1.5 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Add Node</p>
      {PALETTE_NODES.map((type) => {
        const reg = NODE_REGISTRY[type]
        const Icon = reg.icon
        return (
          <div
            key={type}
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            onClick={() => addNode(type)}
            className={cn(
              'group flex cursor-grab items-center gap-2.5 rounded-xl px-2 py-1.5',
              'transition-colors hover:bg-slate-100 active:cursor-grabbing',
              'select-none',
            )}
            title={reg.description}
          >
            <div className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-transform group-hover:scale-105',
              reg.gradient,
            )}>
              <Icon size={14} strokeWidth={2.25} />
            </div>
            <span className="text-[13px] font-medium text-slate-700">{reg.label}</span>
          </div>
        )
      })}
    </div>
  )
}

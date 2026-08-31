import { Plug } from 'lucide-react'
import { useBuilderStore } from './store'
import { PALETTE_NODES, NODE_REGISTRY } from './node-registry'
import { useConnectorRegistry } from './connector-hooks'
import { cn } from '@/lib/utils'

export function NodePalette() {
  const { addNode } = useBuilderStore()
  const { data: connectorEntries } = useConnectorRegistry()

  // `type` here is the union of built-in NodeType members and any
  // runtime-discovered connector type string — useBuilderStore.addNode's
  // own signature is widened to accept both (see store.ts); a connector
  // type is never a real NodeType, so this stays a plain string outside
  // the built-in loop below.
  const onDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('application/xyflow-node-type', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="absolute left-3 top-3 z-10 flex w-44 flex-col gap-1 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/80 p-2 shadow-lg shadow-black/10 backdrop-blur-md">
      <p className="px-1.5 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Add Node</p>
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
              'transition-colors hover:bg-[hsl(var(--muted))] active:cursor-grabbing',
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
            <span className="text-[13px] font-medium text-[hsl(var(--foreground))]">{reg.label}</span>
          </div>
        )
      })}

      {/* Runtime-discovered connector types — merged in below the compiled
          palette, not interleaved, so the built-in list's order is never
          perturbed by which connectors happen to be configured. Re-renders
          once useConnectorRegistry resolves — no frontend rebuild needed
          for a newly-deployed connector to appear here. */}
      {(connectorEntries ?? []).length > 0 && (
        <>
          <div className="mx-1.5 my-1 h-px bg-[hsl(var(--border))]" />
          {connectorEntries!.map((c) => (
            <div
              key={c.type}
              draggable
              onDragStart={(e) => onDragStart(e, c.type)}
              onClick={() => addNode(c.type)}
              className={cn(
                'group flex cursor-grab items-center gap-2.5 rounded-xl px-2 py-1.5',
                'transition-colors hover:bg-[hsl(var(--muted))] active:cursor-grabbing',
                'select-none',
              )}
              title={c.description}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--foreground))]/70 text-white shadow-sm transition-transform group-hover:scale-105">
                <Plug size={14} strokeWidth={2.25} />
              </div>
              <span className="text-[13px] font-medium text-[hsl(var(--foreground))]">{c.label}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

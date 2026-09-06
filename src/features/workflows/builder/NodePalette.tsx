import { useMemo } from 'react'
import { Plug, FileCode2 } from 'lucide-react'
import { useBuilderStore } from './store'
import { PALETTE_NODES, NODE_REGISTRY, fallbackCategory } from './node-registry'
import { useConnectorRegistry } from './connector-hooks'
import { useNodeTaxonomy, groupByCategory, type PaletteEntry } from './node-taxonomy'
import { cn, onKeyboardActivate } from '@/lib/utils'
import type { NodeType } from '../types'

export function NodePalette() {
  const { addNode } = useBuilderStore()
  const { data: connectorEntries } = useConnectorRegistry()
  const { data: taxonomy } = useNodeTaxonomy()

  // `type` here is the union of built-in NodeType members and any
  // runtime-discovered connector or template type string —
  // useBuilderStore.addNode's own signature is widened to accept both (see
  // store.ts); a non-built-in type is never a real NodeType, so this stays a
  // plain string.
  const onDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('application/xyflow-node-type', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  // One list, grouped by what a node DOES rather than by where it came from.
  //
  // This replaced a flat built-in list with every connector appended below a
  // divider. That layout was protecting a real property — a connector's
  // presence could never shift where a built-in sat — but it answered the
  // wrong question: someone looking for "send a message to Slack" scans for
  // the thing it does, not for which process implements it. The property is
  // preserved a different way: groupByCategory sorts core nodes first within
  // each group, so a connector can still never displace a built-in.
  const groups = useMemo(() => {
    const servedCategory = new Map((taxonomy?.nodes ?? []).map((n) => [n.type, n.category]))
    const entries: PaletteEntry[] = [
      ...PALETTE_NODES.map((type): PaletteEntry => ({
        type,
        kind: 'core',
        category: servedCategory.get(type) ?? fallbackCategory(type),
        label: NODE_REGISTRY[type].label,
        description: NODE_REGISTRY[type].description,
      })),
      ...(connectorEntries ?? []).map((c): PaletteEntry => ({
        type: c.type,
        kind: c.kind,
        category: servedCategory.get(c.type) ?? c.category,
        label: c.label,
        description: c.description,
      })),
    ]
    return groupByCategory(entries, taxonomy?.categories ?? [])
  }, [connectorEntries, taxonomy])

  return (
    <div className="absolute left-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-44 flex-col gap-1 overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/80 p-2 shadow-lg shadow-black/10 backdrop-blur-md">
      <p className="px-1.5 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Add Node</p>

      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          <p className="px-1.5 pb-0.5 pt-1.5 text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]/70">
            {group.label}
          </p>
          {group.entries.map((entry) => {
            const reg = entry.kind === 'core' ? NODE_REGISTRY[entry.type as NodeType] : undefined
            // Templates and connectors are visually distinct from each other
            // for the same reason they are in the picker: one's behaviour is
            // data this deployment holds, the other's is a process it talks to.
            const Icon = reg?.icon ?? (entry.kind === 'template' ? FileCode2 : Plug)
            return (
              <div
                key={entry.type}
                // role="button" (unlike the selectable-card pattern
                // elsewhere in this app, e.g. form-builder/canvas/
                // ElementCard.tsx's role="group") because clicking this
                // adds the node — a single, complete action with no nested
                // interactive descendants of its own. draggable/onDragStart
                // stays mouse/touch-only (native HTML5 DnD has no keyboard
                // equivalent), but click already reaches the exact same
                // outcome, so Enter/Space here gives keyboard users full
                // parity, not just a partial one.
                role="button"
                tabIndex={0}
                aria-label={`Add ${entry.label} node`}
                draggable
                onDragStart={(e) => onDragStart(e, entry.type)}
                onClick={() => addNode(entry.type)}
                onKeyDown={onKeyboardActivate(() => addNode(entry.type))}
                className={cn(
                  'group flex cursor-grab items-center gap-2.5 rounded-xl px-2 py-1.5',
                  'transition-colors hover:bg-[hsl(var(--muted))] active:cursor-grabbing',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                  'select-none',
                )}
                title={entry.description}
              >
                <div className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-transform group-hover:scale-105',
                  reg?.gradient ?? 'bg-[hsl(var(--foreground))]/70',
                )}>
                  <Icon size={14} strokeWidth={2.25} />
                </div>
                <span className="truncate text-[13px] font-medium text-[hsl(var(--foreground))]">{entry.label}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

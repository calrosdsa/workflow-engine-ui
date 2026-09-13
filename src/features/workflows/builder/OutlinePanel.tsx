import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, ListTree, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBuilderStore } from './store'
import { NODE_REGISTRY } from './node-registry'
import { deriveOutline, type OutlineRow } from './outline'
import type { NodeType } from '../types'

// OutlinePanel is the flow reading of the canvas: the same workflow as a
// step tree — trigger, steps top to bottom, branches and loop bodies
// indented — derived live from the store on every change. Clicking a row
// selects the node on the canvas (and vice versa: the canvas selection
// highlights here), making the point physically: one workflow, two views.

const TAG_STYLES: Record<NonNullable<OutlineRow['text']>, string> = {
  'then': 'text-[hsl(var(--success,142_71%_45%))]',
  'else': 'text-[hsl(var(--warning))]',
  'each item': 'text-[hsl(var(--primary))]',
}

// Friendlier display names for the control-flow node types — the outline
// speaks flow ("If", "For each"), the canvas speaks graph.
const FLOW_NAMES: Partial<Record<string, string>> = {
  condition: 'if',
  iterator: 'for each',
}

interface OutlinePanelProps {
  open: boolean
  onToggle: () => void
}

export function OutlinePanel({ open, onToggle }: OutlinePanelProps) {
  const { nodes, edges, selectedNodeId, selectNode } = useBuilderStore()
  const outline = useMemo(() => deriveOutline(nodes, edges), [nodes, edges])

  return (
    <aside
      className={cn(
        'relative flex shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-[width] duration-200',
        open ? 'w-64' : 'w-10',
      )}
    >
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] shadow-sm transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
        title={open ? 'Collapse outline' : 'Expand outline'}
      >
        {open ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
      </button>

      {!open && (
        <div className="flex flex-1 flex-col items-center gap-2 pt-4">
          <ListTree size={15} className="text-[hsl(var(--muted-foreground))]" />
          <span className="rotate-90 select-none whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Outline
          </span>
        </div>
      )}

      {open && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2.5">
            <ListTree size={14} className="text-[hsl(var(--muted-foreground))]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Outline
            </span>
          </div>

          {!outline.structured && (
            <p className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 px-3 py-2 text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">
              Free-form graph — showing every node in run order instead of a
              step tree.
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto py-1.5">
            {outline.rows.length === 0 && (
              <p className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                No steps yet — add nodes on the canvas.
              </p>
            )}
            {outline.rows.map((row, i) =>
              row.kind === 'tag' ? (
                <div
                  key={`tag-${i}`}
                  className={cn(
                    'select-none px-3 pb-0.5 pt-1.5 font-mono text-[10px] font-bold uppercase tracking-wider',
                    TAG_STYLES[row.text!] ?? 'text-[hsl(var(--muted-foreground))]',
                  )}
                  style={{ paddingLeft: 12 + row.depth * 14 }}
                >
                  {row.text}
                </div>
              ) : (
                <OutlineStepRow
                  key={row.id}
                  row={row}
                  selected={selectedNodeId === row.id}
                  onSelect={() => selectNode(row.id ?? null)}
                />
              ),
            )}
          </div>
        </div>
      )}
    </aside>
  )
}

function OutlineStepRow({ row, selected, onSelect }: { row: OutlineRow; selected: boolean; onSelect: () => void }) {
  const entry = NODE_REGISTRY[row.type as NodeType]
  const Icon = entry?.icon ?? Zap
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors',
        selected
          ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--foreground))]'
          : 'text-[hsl(var(--foreground))]/90 hover:bg-[hsl(var(--muted))]',
      )}
      style={{ paddingLeft: 12 + row.depth * 14 }}
      title={row.label}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white',
          entry?.color ?? 'bg-[hsl(var(--muted-foreground))]',
        )}
      >
        <Icon size={11} />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{row.label}</span>
      <span className="shrink-0 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
        {FLOW_NAMES[row.type ?? ''] ?? row.type}
      </span>
    </button>
  )
}

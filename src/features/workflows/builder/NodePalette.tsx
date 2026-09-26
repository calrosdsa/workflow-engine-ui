import { useMemo } from 'react'
import { useBuilderStore } from './store'
import { PALETTE_NODES, NODE_REGISTRY, fallbackCategory, leverFor } from './node-registry'
import { useNodeTaxonomy, groupByPaletteCategory, type PaletteEntry } from './node-taxonomy'
import { iconFor } from './icon-hints'
import { cn, onKeyboardActivate } from '@/lib/utils'
import { useTranslation } from '@/features/i18n/I18nProvider'

const CATEGORY_LABEL_IDS = new Set(['ai', 'core', 'data', 'flow', 'integration', 'notify', 'output', 'structure', 'utility', 'logic'])

export function NodePalette() {
  const t = useTranslation()
  const { addNode } = useBuilderStore()
  const { data: taxonomy } = useNodeTaxonomy()

  // `type` here is the union of built-in NodeType members and any
  // runtime-discovered package node type string —
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
  // divider. That layout was protecting a real property — a package node's
  // presence could never shift where a built-in sat — but it answered the
  // wrong question: someone looking for "send a message to Slack" scans for
  // the thing it does, not for which process implements it. The property is
  // preserved a different way: groupByPaletteCategory sorts core nodes first
  // within each merged group, so a package node can still never displace a
  // built-in.
  const groups = useMemo(() => {
    const servedCategory = new Map((taxonomy?.nodes ?? []).map((n) => [n.type, n.category]))
    const entries: PaletteEntry[] = [
      ...PALETTE_NODES.map((type): PaletteEntry => ({
        type,
        kind: 'core',
        category: servedCategory.get(type) ?? fallbackCategory(type),
        label: t(`workflows.node.${type}.label`) === `workflows.node.${type}.label` ? NODE_REGISTRY[type].label : t(`workflows.node.${type}.label`),
        description: t(`workflows.node.${type}.description`) === `workflows.node.${type}.description` ? NODE_REGISTRY[type].description : t(`workflows.node.${type}.description`),
      })),
      ...(taxonomy?.nodes ?? [])
        .filter((n) => n.kind === 'package')
        .map((n): PaletteEntry => ({
          type: n.type,
          kind: 'package',
          category: n.category,
          label: n.display_name || n.type,
          description: n.summary ?? '',
          iconHint: n.icon_hint,
        })),
    ]
    return groupByPaletteCategory(entries, taxonomy?.categories ?? [])
  }, [taxonomy])

  return (
    <div className="absolute left-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-44 flex-col gap-1 overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/80 p-2 shadow-lg shadow-black/10 backdrop-blur-md">
      <p className="px-1.5 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.palette.add_node')}</p>

      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          <p className="px-1.5 pb-0.5 pt-1.5 text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]/70">
            {CATEGORY_LABEL_IDS.has(group.id) ? t(`workflows.category.${group.id}`) : group.label}
          </p>
          {group.entries.map((entry) => {
            const Icon = iconFor(entry.type, entry.iconHint)
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
                aria-label={t('workflows.palette.add_node_aria', { label: entry.label })}
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
                <div
                  data-lever={leverFor(entry.type, entry.category)}
                  className="wf-lever-tile flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
                >
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

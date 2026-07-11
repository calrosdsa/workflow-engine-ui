import { useMemo } from 'react'
import {
  Settings, ChevronLeft, ChevronRight, SlidersHorizontal, Maximize2, Minimize2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useBuilderStore } from './store'
import { NODE_REGISTRY } from './node-registry'
import { cn } from '@/lib/utils'
import { useForms } from '@/features/forms/hooks'
import { computeAncestors } from './executionOrder'
import { buildNodeOutputSchema, iteratorItemSchema, type NodeOutputSchema } from './node-output-schema'
import type { IteratorConfig } from '../types'

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
//
// Type-specific config forms and their normalise*Config functions live under
// node-forms/, one file per NodeType, wired in through node-registry.ts's
// `form`/`normalise` fields (mirrors features/menus/menu-registry.ts's
// configPanel pattern) — this file only dispatches, it no longer owns any
// per-type logic itself.

export function NodeConfigPanel() {
  const {
    nodes, edges, selectedNodeId, variables, updateNodeConfig, updateNodeLabel,
    configPanelOpen, toggleConfigPanel, configPanelWide, toggleConfigPanelWide,
  } = useBuilderStore()
  const node = nodes.find((n) => n.id === selectedNodeId)
  const reg  = node ? NODE_REGISTRY[node.data.type] : null
  const Icon = reg?.icon

  // Forms cache → id map, so fetch_records outputs can expose their record fields.
  const { data: forms } = useForms()
  const formsById = useMemo(
    () => new Map((forms ?? []).map((f) => [f.id, f])),
    [forms],
  )

  // Context-aware: only the outputs of nodes that execute BEFORE the selected one.
  // Iterators expose their item two ways depending on where the selected node is:
  //   • INSIDE the loop body → Vars["item"] (the current iteration's element).
  //   • DOWNSTREAM (after Loop End) → NodeOutputs[iter]["item"] (last element).
  const nodeContext: NodeOutputSchema[] = useMemo(() => {
    if (!selectedNodeId) return []
    const ancestorIds = computeAncestors(nodes, edges, selectedNodeId)

    // An iterator whose loop_end is not yet an ancestor means the selected node
    // sits inside that iterator's body → use the Vars-rooted item schema, and
    // suppress that iterator's NodeOutputs schema (not populated until the loop
    // finishes).
    const inBodyIterators = new Set<string>()
    const itemSchemas: NodeOutputSchema[] = []
    for (const n of nodes) {
      if (n.data.type !== 'iterator' || !ancestorIds.has(n.id)) continue
      const cfg = n.data.configuration as IteratorConfig | undefined
      if (cfg?.loop_end_id && !ancestorIds.has(cfg.loop_end_id)) {
        inBodyIterators.add(n.id)
        itemSchemas.push(iteratorItemSchema(n, nodes, formsById))
      }
    }

    const outputs = nodes
      .filter((n) => ancestorIds.has(n.id) && !inBodyIterators.has(n.id))
      .flatMap((n) => buildNodeOutputSchema(n, formsById, nodes))

    return [...itemSchemas, ...outputs]
  }, [nodes, edges, selectedNodeId, formsById])

  return (
    <aside
      className={cn(
        'relative flex shrink-0 flex-col border-l border-slate-200 bg-white transition-all duration-200',
        !configPanelOpen ? 'w-10' : configPanelWide ? 'w-[640px]' : 'w-80',
      )}
    >
      {/* Toggle button */}
      <button
        onClick={toggleConfigPanel}
        className="absolute -left-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-600"
        title={configPanelOpen ? 'Collapse config' : 'Expand config'}
      >
        {configPanelOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {/* Widen/narrow toggle — a global panel preference, not scoped to the
          selected node, so it stays available even with nothing selected. */}
      {configPanelOpen && (
        <button
          onClick={toggleConfigPanelWide}
          className="absolute -left-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-600"
          title={configPanelWide ? 'Narrow config panel' : 'Widen config panel'}
        >
          {configPanelWide ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      )}

      {/* Collapsed state */}
      {!configPanelOpen && (
        <div className="flex flex-1 flex-col items-center gap-2 pt-4">
          <SlidersHorizontal size={15} className="text-slate-400" />
          <span className="rotate-90 select-none whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Config
          </span>
        </div>
      )}

      {/* Expanded — no node selected */}
      {configPanelOpen && !node && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            <Settings size={22} className="text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">Select a node<br />to configure it</p>
        </div>
      )}

      {/* Expanded — node selected */}
      {configPanelOpen && node && reg && Icon && (
        <>
          {/* Header */}
          <div className={cn('flex items-center gap-3 px-4 py-3.5', reg.gradient)}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
              <Icon size={17} strokeWidth={2.25} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{reg.label}</p>
              <p className="truncate font-mono text-[10px] text-white/60">{node.id}</p>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-5 p-4">
              {/* Label */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Label</Label>
                <Input
                  value={node.data.label}
                  onChange={(e) => updateNodeLabel(node.id, e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="h-px bg-slate-100" />

              {/* Type-specific config — one unconditional dispatch through the
                  registry, no per-type branching left in this file. */}
              <reg.form
                config={reg.normalise(node.data.configuration)}
                variables={variables}
                nodeContext={nodeContext}
                onChange={(cfg) => updateNodeConfig(node.id, cfg)}
              />
            </div>
          </ScrollArea>
        </>
      )}
    </aside>
  )
}

import { useMemo } from 'react'
import {
  Settings, ChevronLeft, ChevronRight, SlidersHorizontal, Maximize2, Minimize2, Plug, FileCode2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useBuilderStore } from './store'
import { NODE_REGISTRY } from './node-registry'
import { useConnectorRegistry } from './connector-hooks'
import { SchemaForm, defaultsForSchema } from './SchemaForm'
import { cn } from '@/lib/utils'
import { useForms } from '@/features/forms/hooks'
import { computeAncestors } from './executionOrder'
import { buildNodeOutputSchema, iteratorItemSchema, type NodeOutputSchema } from './node-output-schema'
import type { IteratorConfig, NodeType } from '../types'

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

  // Two-step lookup: NODE_REGISTRY first (every built-in type — zero
  // behavior change from before this file supported connectors at all),
  // falling back to the runtime-fetched connector registry for anything
  // NODE_REGISTRY doesn't recognize. `node.data.type` is cast to `string`
  // ONLY at this local lookup site — NodeType itself stays a closed union
  // everywhere else (defaultPorts/nodeSetupIssue/defaultConfig's own
  // switches keep their exhaustiveness checking); see connector-registry.ts's
  // header comment for the full reasoning.
  const nodeTypeKey = node ? (node.data.type as string) : null
  const builtIn = nodeTypeKey ? NODE_REGISTRY[nodeTypeKey as NodeType] : null
  const { data: connectorEntries } = useConnectorRegistry()
  const connectorEntry = !builtIn && nodeTypeKey
    ? (connectorEntries ?? []).find((c) => c.type === nodeTypeKey)
    : null

  const reg  = builtIn
  const Icon = builtIn?.icon ?? (connectorEntry ? Plug : undefined)

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
        'relative flex shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-200',
        !configPanelOpen ? 'w-10' : configPanelWide ? 'w-[640px]' : 'w-80',
      )}
    >
      {/* Toggle button */}
      <button
        onClick={toggleConfigPanel}
        className="absolute -left-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] shadow-sm transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
        title={configPanelOpen ? 'Collapse config' : 'Expand config'}
      >
        {configPanelOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {/* Widen/narrow toggle — a global panel preference, not scoped to the
          selected node, so it stays available even with nothing selected. */}
      {configPanelOpen && (
        <button
          onClick={toggleConfigPanelWide}
          className="absolute -left-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] shadow-sm transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
          title={configPanelWide ? 'Narrow config panel' : 'Widen config panel'}
        >
          {configPanelWide ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      )}

      {/* Collapsed state */}
      {!configPanelOpen && (
        <div className="flex flex-1 flex-col items-center gap-2 pt-4">
          <SlidersHorizontal size={15} className="text-[hsl(var(--muted-foreground))]" />
          <span className="rotate-90 select-none whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Config
          </span>
        </div>
      )}

      {/* Expanded — no node selected */}
      {configPanelOpen && !node && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--muted))]">
            <Settings size={22} className="text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Select a node<br />to configure it</p>
        </div>
      )}

      {/* Expanded — node selected, resolved as a BUILT-IN type. Byte-for-byte
          unchanged from before connectors existed — reg.form/reg.normalise
          dispatch exactly as always. */}
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
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Label</Label>
                <Input
                  value={node.data.label}
                  onChange={(e) => updateNodeLabel(node.id, e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="h-px bg-[hsl(var(--border))]" />

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

      {/* Expanded — node selected, resolved as a PLUGGABLE CONNECTOR type.
          No compiled gradient/accent exists for a runtime-discovered type,
          so this header is deliberately neutral (slate + a generic plug
          icon) rather than faking a themed look — it reads as "a connector
          node," not as a built-in with the wrong colors. */}
      {configPanelOpen && node && !reg && connectorEntry && (
        <>
          <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--foreground))]/10 px-4 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--foreground))]/10 ring-1 ring-[hsl(var(--foreground))]/15">
              {/* A template and a connector are both configured through this
                  same schema-driven form — that is the point, and why a
                  template needed no frontend code. They are still drawn
                  differently, because "this node's behaviour is data we hold"
                  and "this node talks to a process" are different things to
                  know when something misbehaves. */}
              {connectorEntry.kind === 'template'
                ? <FileCode2 size={17} strokeWidth={2.25} className="text-[hsl(var(--foreground))]" />
                : <Plug size={17} strokeWidth={2.25} className="text-[hsl(var(--foreground))]" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-[hsl(var(--foreground))]">
                {connectorEntry.label}
                <span className="rounded-full border border-[hsl(var(--border))] px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  {connectorEntry.kind}
                </span>
              </p>
              <p className="truncate font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{node.id}</p>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-5 p-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Label</Label>
                <Input
                  value={node.data.label}
                  onChange={(e) => updateNodeLabel(node.id, e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="h-px bg-[hsl(var(--border))]" />

              <SchemaForm
                schema={connectorEntry.configSchema}
                value={
                  node.data.configuration && typeof node.data.configuration === 'object'
                    ? node.data.configuration
                    : defaultsForSchema(connectorEntry.configSchema)
                }
                onChange={(cfg) => updateNodeConfig(node.id, cfg)}
              />
            </div>
          </ScrollArea>
        </>
      )}

      {/* Expanded — node selected, but its type is neither a known built-in
          nor a currently-registered connector (a saved workflow referencing
          a deregistered connector — see the connector plan's deregistration
          risk note). Shows the raw stored config read-only rather than
          crashing trying to render a form against a schema that doesn't
          exist here. */}
      {configPanelOpen && node && !reg && !connectorEntry && (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 px-3 py-2.5">
            <Plug size={16} className="shrink-0 text-[hsl(var(--warning))]" />
            <p className="text-[12px] leading-snug text-[hsl(var(--warning))]">
              Unknown node type <span className="font-mono">{nodeTypeKey}</span> — its connector is not currently registered.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Label</Label>
            <Input
              value={node.data.label}
              onChange={(e) => updateNodeLabel(node.id, e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Stored configuration (read-only)</Label>
            <pre className="max-h-64 overflow-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2.5 text-[11px] text-[hsl(var(--muted-foreground))]">
              {JSON.stringify(node.data.configuration, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </aside>
  )
}

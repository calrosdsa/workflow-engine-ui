import { useMemo, useState } from 'react'
import {
  Settings, ChevronLeft, ChevronRight, SlidersHorizontal,
  Plus, Trash2, Braces, Code2, ArrowUpDown, Filter as FilterIcon,
  Maximize2, Minimize2, Clock, Zap as ZapIcon, MessageSquare,
  ShieldCheck, CheckCircle2, Send, type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useBuilderStore } from './store'
import { NODE_REGISTRY } from './node-registry'
import { cn } from '@/lib/utils'
import { ExpressionEditor } from './ExpressionEditor'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { FilterBuilder, newGroup } from './FilterBuilder'
import { ValuesEditor } from './ValuesEditor'
import { HttpRequestForm } from './HttpRequestForm'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm, useForms } from '@/features/forms/hooks'
import { computeAncestors } from './executionOrder'
import { buildNodeOutputSchema, iteratorItemSchema, type NodeOutputSchema } from './node-output-schema'
import { nanoid } from './nanoid'
import type {
  VariableDecl, SetVariableConfig, VariableAssignment, ConditionConfig, AssignMode,
  FetchRecordsConfig, FilterGroup, SortRule, FetchMode, IteratorConfig,
  UpsertRecordsConfig, UpdateRecordsConfig, DeleteRecordsConfig, FieldValue, RecordMatchMode,
  HttpRequestConfig, KeyValuePair, ResponseSchema,
  TriggerConfig, TriggerMode, TriggerEventType, ShowMessageConfig, MessageType,
  TransformConfig, TransformFieldMap, SaveRecordsConfig,
} from '../types'

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

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

              {/* Type-specific config */}
              {node.data.type === 'trigger' && (
                <TriggerForm
                  config={normaliseTriggerConfig(node.data.configuration)}
                  variables={variables}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'show_message' && (
                <ShowMessageForm
                  config={normaliseShowMessageConfig(node.data.configuration)}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'set_variable' && (
                <SetVariableForm
                  config={normaliseSetVariableConfig(node.data.configuration)}
                  variables={variables}
                  nodeContext={nodeContext}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'condition' && (
                <ConditionForm
                  config={node.data.configuration as ConditionConfig}
                  variables={variables}
                  nodeContext={nodeContext}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'subflow' && (
                <SubflowForm
                  config={node.data.configuration as { definition_id: string }}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'fetch_records' && (
                <FetchRecordsForm
                  config={normaliseFetchRecordsConfig(node.data.configuration)}
                  variables={variables}
                  nodeContext={nodeContext}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'upsert_records' && (
                <UpsertRecordsForm
                  config={normaliseUpsertRecordsConfig(node.data.configuration)}
                  variables={variables}
                  nodeContext={nodeContext}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'update_records' && (
                <UpdateRecordsForm
                  config={normaliseUpdateRecordsConfig(node.data.configuration)}
                  variables={variables}
                  nodeContext={nodeContext}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'delete_records' && (
                <DeleteRecordsForm
                  config={normaliseDeleteRecordsConfig(node.data.configuration)}
                  variables={variables}
                  nodeContext={nodeContext}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'transform' && (
                <TransformForm
                  config={normaliseTransformConfig(node.data.configuration)}
                  variables={variables}
                  nodeContext={nodeContext}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'save_records' && (
                <SaveRecordsForm
                  config={normaliseSaveRecordsConfig(node.data.configuration)}
                  variables={variables}
                  nodeContext={nodeContext}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'iterator' && (
                <IteratorForm
                  config={node.data.configuration as IteratorConfig}
                  variables={variables}
                  nodeContext={nodeContext}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'loop_end' && (
                <p className="text-xs text-slate-400 text-center py-4">
                  Marks the end of the loop body.<br />No configuration needed.
                </p>
              )}
              {node.data.type === 'http_request' && (
                <HttpRequestForm
                  config={normaliseHttpRequestConfig(node.data.configuration)}
                  variables={variables}
                  nodeContext={nodeContext}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {(node.data.type === 'entry' || node.data.type === 'exit' || node.data.type === 'merge') && (
                <p className="text-xs text-slate-400 text-center py-4">No additional configuration</p>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </aside>
  )
}

// ---------------------------------------------------------------------------
// trigger — mirrors internal/graph/configs_trigger.go
// ---------------------------------------------------------------------------

function normaliseTriggerConfig(raw: unknown): TriggerConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<TriggerConfig>
  return {
    mode:        r.mode ?? 'on_demand',
    cron:        r.cron ?? '',
    timezone:    r.timezone ?? '',
    description: r.description ?? '',
    form_id:     r.form_id ?? '',
    event_type:  r.event_type ?? 'create_or_update',
    filter:      ensureGroupIds(r.filter) ?? newGroup(),
    enabled:     r.enabled ?? true,
  }
}

const TRIGGER_MODES: { value: TriggerMode; label: string; icon: LucideIcon; description: string }[] = [
  { value: 'on_demand',   label: 'On Demand',    icon: ZapIcon,      description: 'Run manually or via API — no automatic trigger.' },
  { value: 'scheduled',   label: 'Scheduled',    icon: Clock,        description: 'Run on a recurring cron schedule.' },
  { value: 'before',      label: 'Before Write', icon: ShieldCheck,  description: 'Run before a record is created/updated/deleted — can block the write.' },
  { value: 'after',       label: 'After Write',  icon: CheckCircle2, description: 'Run after a record write commits — synchronously, blocking the response.' },
  { value: 'after_async', label: 'After Write (Async)', icon: Send,  description: 'Run after a record write commits — fire-and-forget, does not block the response.' },
]

const EVENT_TYPES: { value: TriggerEventType; label: string }[] = [
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'create_or_update', label: 'Create or Update' },
]

function TriggerForm({ config, variables, onChange }: {
  config: TriggerConfig
  variables: VariableDecl[]
  onChange: (c: TriggerConfig) => void
}) {
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []
  const isDataDriven = config.mode === 'before' || config.mode === 'after' || config.mode === 'after_async'

  const set = (patch: Partial<TriggerConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Enabled toggle */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
        <div>
          <Label className="text-[12px] font-semibold text-slate-700">Enabled</Label>
          <p className="text-[10px] text-slate-400">Disabled triggers never fire (workflow can still be run on demand from the editor).</p>
        </div>
        <button
          type="button"
          onClick={() => set({ enabled: !config.enabled })}
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors',
            config.enabled ? 'bg-emerald-500' : 'bg-slate-300',
          )}
        >
          <span className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            config.enabled ? 'translate-x-4' : 'translate-x-0.5',
          )} />
        </button>
      </div>

      {/* Mode picker */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Trigger Mode</Label>
        <div className="space-y-1.5">
          {TRIGGER_MODES.map((m) => {
            const Icon = m.icon
            const active = config.mode === m.value
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => set({ mode: m.value })}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                  active ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <div className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  active ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400',
                )}>
                  <Icon size={14} />
                </div>
                <div className="min-w-0">
                  <p className={cn('text-[12px] font-semibold', active ? 'text-emerald-800' : 'text-slate-700')}>{m.label}</p>
                  <p className="text-[10px] leading-snug text-slate-400">{m.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Scheduled mode fields */}
      {config.mode === 'scheduled' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cron Expression</Label>
            <Input
              value={config.cron ?? ''}
              onChange={(e) => set({ cron: e.target.value })}
              placeholder="0 9 * * *"
              className="h-8 font-mono text-[12px]"
            />
            <p className="text-[10px] text-slate-400">
              Standard 5-field crontab syntax, or shorthands like <code className="font-mono">@daily</code>, <code className="font-mono">@hourly</code>, <code className="font-mono">@every 1h30m</code>.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Timezone</Label>
            <Input
              value={config.timezone ?? ''}
              onChange={(e) => set({ timezone: e.target.value })}
              placeholder="e.g. America/New_York (blank = UTC)"
              className="h-8 text-[12px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Description</Label>
            <Input
              value={config.description ?? ''}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="What this schedule does…"
              className="h-8 text-[12px]"
            />
          </div>
        </div>
      )}

      {/* Data-driven mode fields (before / after / after_async) */}
      {isDataDriven && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Form / Table</Label>
            <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">On Event</Label>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              {EVENT_TYPES.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => set({ event_type: e.value })}
                  className={cn(
                    'rounded-md py-1 text-[11px] font-medium transition-colors',
                    config.event_type === e.value ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <FilterIcon size={12} className="text-slate-400" />
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Filter (optional)</Label>
            </div>
            {!config.form_id ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">Select a form to add filters.</p>
            ) : (
              <FilterBuilder
                group={config.filter ?? newGroup()}
                fields={fields}
                variables={variables}
                onChange={(g) => set({ filter: g })}
              />
            )}
            <p className="text-[10px] text-slate-400">
              Use the <span className="font-mono">was updated</span> operator on a field to react only when that field's value actually changes (change-detection, evaluated against the old/new record pair).
            </p>
          </div>

          <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-2.5 text-[10px] text-amber-700">
            {config.mode === 'before'
              ? 'Runs synchronously before the write. A Show Message node with type "error" here blocks the write and returns the message to the caller.'
              : config.mode === 'after'
                ? 'Runs synchronously after the write commits. A Show Message node with type "error" here becomes a non-fatal warning on the response (the write already happened).'
                : 'Runs after the write commits, without waiting. Failures are logged only — nothing is left to report them to the caller.'}
          </p>
        </div>
      )}

      {config.mode === 'on_demand' && (
        <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">
          No additional configuration. Run this workflow manually or via the executions API.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// show_message — mirrors internal/graph/configs_message.go
// ---------------------------------------------------------------------------

function normaliseShowMessageConfig(raw: unknown): ShowMessageConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ShowMessageConfig>
  return {
    message:      r.message ?? '',
    is_html:      r.is_html ?? false,
    timeout_ms:   r.timeout_ms ?? 0,
    message_type: r.message_type ?? 'info',
  }
}

const MESSAGE_TYPES: { value: MessageType; label: string; activeClass: string }[] = [
  { value: 'success', label: 'Success', activeClass: 'bg-emerald-500 text-white' },
  { value: 'error',   label: 'Error',   activeClass: 'bg-red-500 text-white' },
  { value: 'info',    label: 'Info',    activeClass: 'bg-sky-500 text-white' },
]

function ShowMessageForm({ config, onChange }: {
  config: ShowMessageConfig
  onChange: (c: ShowMessageConfig) => void
}) {
  const set = (patch: Partial<ShowMessageConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Message type */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Message Type</Label>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {MESSAGE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set({ message_type: t.value })}
              className={cn(
                'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
                config.message_type === t.value ? `${t.activeClass} shadow-sm` : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {config.message_type === 'error' && (
          <p className="text-[10px] text-slate-400">
            Inside a Trigger's Before mode, an error message here blocks the write. In After/AfterAsync/on-demand runs it's a non-fatal warning.
          </p>
        )}
      </div>

      {/* Message body — plain text/HTML only; the backend never evaluates
          this as an expression (see internal/activities/show_message.go).
          A dynamic value has to be composed upstream by a Set Variable
          node's expression assignment — this field itself is a literal
          string end to end. */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Message</Label>
        <div className="relative">
          <MessageSquare size={11} className="absolute left-2.5 top-2.5 text-indigo-400" />
          <textarea
            value={config.message}
            onChange={(e) => set({ message: e.target.value })}
            rows={4}
            placeholder={config.is_html ? '<p>Order confirmed.</p>' : 'Order confirmed.'}
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 text-[12px] text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <p className="text-[10px] text-slate-400">
          Plain text or HTML only — not evaluated as an expression. For a dynamic value, build the string with a Set Variable node first.
        </p>
      </div>

      {/* is_html toggle */}
      <label className="flex items-center gap-2 text-[12px] text-slate-600">
        <input
          type="checkbox"
          checked={config.is_html ?? false}
          onChange={(e) => set({ is_html: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-500 focus:ring-indigo-400"
        />
        Message contains HTML
      </label>

      {/* Timeout */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Auto-dismiss Timeout (ms)</Label>
        <Input
          type="number"
          min={0}
          value={config.timeout_ms || ''}
          onChange={(e) => set({ timeout_ms: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) })}
          placeholder="0 = no auto-dismiss"
          className="h-8 w-40 text-[12px]"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Normalise legacy single-assignment payload into the new shape
// ---------------------------------------------------------------------------

function normaliseSetVariableConfig(raw: unknown): SetVariableConfig {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    if (Array.isArray(r.assignments)) return raw as SetVariableConfig
    // Legacy shape
    if (r.variable_name) {
      return {
        assignments: [{
          id:            nanoid(),
          variable_name: String(r.variable_name),
          mode:          (r.mode as AssignMode) ?? 'literal',
          literal_value: r.literal_value,
          expression:    String(r.expression ?? ''),
        }],
      }
    }
  }
  return { assignments: [] }
}

// ---------------------------------------------------------------------------
// set_variable — multi-assignment form
// ---------------------------------------------------------------------------

interface SetVariableFormProps {
  config: SetVariableConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: SetVariableConfig) => void
}

function SetVariableForm({ config, variables, nodeContext, onChange }: SetVariableFormProps) {
  const [editorOpen, setEditorOpen] = useState<string | null>(null) // assignment id

  const assignments = config.assignments ?? []

  const update = (id: string, patch: Partial<VariableAssignment>) => {
    onChange({
      assignments: assignments.map((a) => a.id === id ? { ...a, ...patch } : a),
    })
  }

  const add = () => {
    onChange({
      assignments: [
        ...assignments,
        { id: nanoid(), variable_name: '', mode: 'literal', literal_value: '', expression: '' },
      ],
    })
  }

  const remove = (id: string) => {
    onChange({ assignments: assignments.filter((a) => a.id !== id) })
  }

  const openingAssignment = editorOpen ? assignments.find((a) => a.id === editorOpen) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Variable Assignments
        </Label>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {assignments.length}
        </span>
      </div>

      {variables.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
          Declare variables in the Variables panel first.
        </div>
      )}

      {assignments.length === 0 && variables.length > 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
          No assignments yet — click Add below.
        </div>
      )}

      <div className="space-y-2">
        {assignments.map((a, idx) => (
          <AssignmentRow
            key={a.id}
            index={idx}
            assignment={a}
            variables={variables}
            onChange={(patch) => update(a.id, patch)}
            onDelete={() => remove(a.id)}
            onOpenEditor={() => setEditorOpen(a.id)}
          />
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={add}
        disabled={variables.length === 0}
        className="w-full gap-1.5 border-dashed text-slate-500 hover:text-slate-700"
      >
        <Plus size={13} />
        Add Variable
      </Button>

      {/* Expression editor dialog */}
      {openingAssignment && (
        <ExpressionEditor
          open={editorOpen !== null}
          onClose={() => setEditorOpen(null)}
          value={openingAssignment.expression ?? ''}
          onChange={(expr) => update(openingAssignment.id, { expression: expr })}
          variables={variables}
          nodeContext={nodeContext}
          label={openingAssignment.variable_name || 'expression'}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single assignment row
// ---------------------------------------------------------------------------

interface AssignmentRowProps {
  index: number
  assignment: VariableAssignment
  variables: VariableDecl[]
  onChange: (patch: Partial<VariableAssignment>) => void
  onDelete: () => void
  onOpenEditor: () => void
}

function AssignmentRow({ index, assignment, variables, onChange, onDelete, onOpenEditor }: AssignmentRowProps) {
  const selVar = variables.find((v) => v.name === assignment.variable_name)

  return (
    <div className="group relative rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition-shadow hover:shadow-sm">
      {/* Row header: index + variable selector + delete */}
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
          {index + 1}
        </span>
        <div className="flex-1">
          <select
            value={assignment.variable_name}
            onChange={(e) => onChange({ variable_name: e.target.value, literal_value: '' })}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Select variable…</option>
            {variables.map((v) => (
              <option key={v.name} value={v.name}>{v.name} ({v.type})</option>
            ))}
          </select>
        </div>
        <button
          onClick={onDelete}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400"
          title="Remove assignment"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="mb-2 flex gap-1.5 rounded-lg bg-white p-1 border border-slate-200">
        {(['literal', 'expression'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ mode: m })}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors',
              assignment.mode === m
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {m === 'literal' ? <Settings size={10} /> : <Code2 size={10} />}
            {m === 'literal' ? 'Static' : 'Expression'}
          </button>
        ))}
      </div>

      {/* Value field */}
      {assignment.mode === 'literal' && (
        <LiteralInput
          varType={selVar?.type ?? 'string'}
          value={assignment.literal_value}
          onChange={(v) => onChange({ literal_value: v })}
        />
      )}

      {assignment.mode === 'expression' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Braces size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400" />
              <input
                value={assignment.expression ?? ''}
                onChange={(e) => onChange({ expression: e.target.value })}
                placeholder='e.g. Vars["count"] + 1'
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-2 font-mono text-[11px] text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              onClick={onOpenEditor}
              title="Open expression editor"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
            >
              <Code2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// condition
// ---------------------------------------------------------------------------

function ConditionForm({ config, variables, nodeContext, onChange }: {
  config: ConditionConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: ConditionConfig) => void
}) {
  const [editorOpen, setEditorOpen] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Condition Expression
        </Label>
        <button
          onClick={() => setEditorOpen(true)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-indigo-500 hover:bg-indigo-50 transition-colors"
        >
          <Code2 size={11} />
          Editor
        </button>
      </div>

      <div className="relative">
        <Braces size={11} className="absolute left-2.5 top-2.5 text-indigo-400" />
        <textarea
          value={config.expression}
          onChange={(e) => onChange({ expression: e.target.value })}
          rows={3}
          placeholder={`e.g. Vars["age"] >= 18`}
          className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 font-mono text-[11px] text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {variables.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Available variables</p>
          <div className="flex flex-wrap gap-1">
            {variables.map((v) => (
              <button
                key={v.name}
                onClick={() => onChange({ expression: config.expression + `Vars["${v.name}"]` })}
                className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                title={`Insert Vars["${v.name}"]`}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        Must return a boolean. Routes to <span className="font-semibold text-emerald-600">true</span> or <span className="font-semibold text-rose-500">false</span> output.
      </p>

      <ExpressionEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        value={config.expression}
        onChange={(expr) => onChange({ expression: expr })}
        variables={variables}
        nodeContext={nodeContext}
        label="condition"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// fetch_records
// ---------------------------------------------------------------------------

function normaliseFetchRecordsConfig(raw: unknown): FetchRecordsConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<FetchRecordsConfig>
  return {
    form_id:     r.form_id ?? '',
    mode:        r.mode ?? 'many',
    filter:      ensureGroupIds(r.filter) ?? newGroup(),
    refine_expr: r.refine_expr ?? '',
    sort:        (r.sort ?? []).map((s) => ({ ...s, id: s.id ?? nanoid() })),
    limit:       r.limit ?? 0,
    output_var:  r.output_var ?? '',
    count_var:   r.count_var ?? '',
  }
}

// Re-attach UI-only ids to a filter tree loaded from the backend (which strips them).
function ensureGroupIds(g: FilterGroup | undefined): FilterGroup | undefined {
  if (!g) return undefined
  return {
    id: g.id ?? nanoid(),
    combinator: g.combinator ?? 'and',
    conditions: (g.conditions ?? []).map((c) => ({ ...c, id: c.id ?? nanoid() })),
    groups: (g.groups ?? []).map((sub) => ensureGroupIds(sub)!).filter(Boolean),
  }
}

function FetchRecordsForm({ config, variables, nodeContext, onChange }: {
  config: FetchRecordsConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: FetchRecordsConfig) => void
}) {
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []

  const set = (patch: Partial<FetchRecordsConfig>) => onChange({ ...config, ...patch })

  const addSort = () =>
    set({ sort: [...config.sort, { id: nanoid(), field: '', dir: 'asc' }] })
  const updateSort = (id: string, patch: Partial<SortRule>) =>
    set({ sort: config.sort.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const removeSort = (id: string) =>
    set({ sort: config.sort.filter((s) => s.id !== id) })

  return (
    <div className="space-y-4">
      {/* Form picker */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Form / Table</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Retrieve</Label>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(['many', 'one'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set({ mode: m as FetchMode })}
              className={cn(
                'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
                config.mode === m ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {m === 'many' ? 'Multiple records' : 'Single record'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Filter */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <FilterIcon size={12} className="text-slate-400" />
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Filter</Label>
        </div>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">Select a form to add filters.</p>
        ) : (
          <FilterBuilder
            group={config.filter ?? newGroup()}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(g) => set({ filter: g })}
          />
        )}
      </div>

      {/* Sort */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={12} className="text-slate-400" />
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sort</Label>
          </div>
          <button onClick={addSort} disabled={!config.form_id} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-rose-500 hover:bg-rose-50 disabled:opacity-40">
            <Plus size={11} /> Add
          </button>
        </div>
        {config.sort.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <select
              value={s.field}
              onChange={(e) => updateSort(s.id, { field: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 focus:border-rose-400 focus:outline-none"
            >
              <option value="">field…</option>
              {fields.map((f) => <option key={f.name} value={f.name}>{f.label || f.name}</option>)}
            </select>
            <select
              value={s.dir}
              onChange={(e) => updateSort(s.id, { dir: e.target.value as 'asc' | 'desc' })}
              className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 focus:border-rose-400 focus:outline-none"
            >
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </select>
            <button onClick={() => removeSort(s.id)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-400">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Limit */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Limit</Label>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            value={config.mode === 'one' ? 1 : config.limit || ''}
            disabled={config.mode === 'one'}
            onChange={(e) => set({ limit: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) })}
            placeholder="0 = all"
            className="h-7 w-24 text-[12px]"
          />
          <div className="flex gap-1">
            {[10, 100].map((n) => (
              <button key={n} onClick={() => set({ limit: n })} disabled={config.mode === 'one'} className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                Top {n}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-slate-400">
          Outputs <span className="font-mono">records</span>, <span className="font-mono">count</span>, and <span className="font-mono">first</span> to downstream nodes.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared helpers for upsert / update / delete record configs
// ---------------------------------------------------------------------------

// Re-attach UI-only ids to a values list loaded from the backend (which strips them).
function ensureValueIds(values: FieldValue[] | undefined): FieldValue[] {
  return (values ?? []).map((v) => ({ ...v, id: v.id ?? nanoid() }))
}

function normaliseUpsertRecordsConfig(raw: unknown): UpsertRecordsConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<UpsertRecordsConfig>
  return {
    form_id:    r.form_id ?? '',
    values:     ensureValueIds(r.values),
    output_var: r.output_var ?? '',
  }
}

function normaliseUpdateRecordsConfig(raw: unknown): UpdateRecordsConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<UpdateRecordsConfig>
  return {
    form_id:    r.form_id ?? '',
    mode:       r.mode ?? 'one',
    filter:     ensureGroupIds(r.filter) ?? newGroup(),
    values:     ensureValueIds(r.values),
    output_var: r.output_var ?? '',
    count_var:  r.count_var ?? '',
  }
}

function normaliseDeleteRecordsConfig(raw: unknown): DeleteRecordsConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<DeleteRecordsConfig>
  return {
    form_id:   r.form_id ?? '',
    mode:      r.mode ?? 'one',
    filter:    ensureGroupIds(r.filter) ?? newGroup(),
    count_var: r.count_var ?? '',
  }
}

// ---------------------------------------------------------------------------
// transform / save_records config
// ---------------------------------------------------------------------------

function ensureMappingIds(mappings: TransformFieldMap[] | undefined): TransformFieldMap[] {
  return (mappings ?? []).map((m) => ({ ...m, id: m.id ?? nanoid() }))
}

function normaliseTransformConfig(raw: unknown): TransformConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<TransformConfig>
  return {
    source_expr: r.source_expr ?? '',
    form_id:     r.form_id ?? '',
    mappings:    ensureMappingIds(r.mappings),
    output_var:  r.output_var ?? '',
  }
}

function normaliseSaveRecordsConfig(raw: unknown): SaveRecordsConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<SaveRecordsConfig>
  return {
    source_expr: r.source_expr ?? '',
    form_id:     r.form_id ?? '',
    output_var:  r.output_var ?? '',
    count_var:   r.count_var ?? '',
  }
}

// ---------------------------------------------------------------------------
// http_request config
// ---------------------------------------------------------------------------

// Re-attach UI-only ids to a key/value row list loaded from the backend
// (which strips them) — same purpose as ensureValueIds above, for
// KeyValuePair rows (headers/params/form-body).
function ensureKeyValueIds(rows: KeyValuePair[] | undefined): KeyValuePair[] {
  return (rows ?? []).map((r) => ({ ...r, id: r.id ?? nanoid() }))
}

// Re-attach UI-only ids to response_schemas loaded from the backend — one
// level deeper than ensureKeyValueIds, since each schema itself needs an id
// AND its nested fields array needs ids of its own (mirrors how ensureGroupIds
// recurses one level deeper than ensureValueIds for fetch_records filters).
function ensureResponseSchemaIds(schemas: ResponseSchema[] | undefined): ResponseSchema[] {
  return (schemas ?? []).map((s) => ({
    ...s,
    id: s.id ?? nanoid(),
    fields: (s.fields ?? []).map((f) => ({ ...f, id: f.id ?? nanoid() })),
  }))
}

function normaliseHttpRequestConfig(raw: unknown): HttpRequestConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<HttpRequestConfig>
  return {
    method:  r.method ?? 'GET',
    url_mode: r.url_mode ?? 'static',
    url: r.url ?? '',
    url_expr: r.url_expr ?? '',
    params:  ensureKeyValueIds(r.params),
    headers: ensureKeyValueIds(r.headers),
    body_mode: r.body_mode ?? 'none',
    body_value_mode: r.body_value_mode ?? 'static',
    body_value: r.body_value ?? '',
    body_expression: r.body_expression ?? '',
    body_raw_content_type: r.body_raw_content_type ?? '',
    body_form: ensureKeyValueIds(r.body_form),
    auth_type: r.auth_type ?? 'none',
    auth_credential: r.auth_credential ?? '',
    auth_username_mode: r.auth_username_mode ?? 'static',
    auth_username: r.auth_username ?? '',
    auth_username_expr: r.auth_username_expr ?? '',
    auth_password_mode: r.auth_password_mode ?? 'static',
    auth_password: r.auth_password ?? '',
    auth_password_expr: r.auth_password_expr ?? '',
    auth_token_mode: r.auth_token_mode ?? 'static',
    auth_token: r.auth_token ?? '',
    auth_token_expr: r.auth_token_expr ?? '',
    auth_api_key_name: r.auth_api_key_name ?? '',
    auth_api_key_location: r.auth_api_key_location ?? 'header',
    auth_api_key_value_mode: r.auth_api_key_value_mode ?? 'static',
    auth_api_key_value: r.auth_api_key_value ?? '',
    auth_api_key_value_expr: r.auth_api_key_value_expr ?? '',
    timeout_ms: r.timeout_ms,
    output_var: r.output_var ?? '',
    response_schemas: ensureResponseSchemaIds(r.response_schemas),
  }
}

// ---------------------------------------------------------------------------
// upsert_records
// ---------------------------------------------------------------------------

function UpsertRecordsForm({ config, variables, nodeContext, onChange }: {
  config: UpsertRecordsConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: UpsertRecordsConfig) => void
}) {
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []
  const uniqueFields = fields.filter((f) => f.unique)

  const set = (patch: Partial<UpsertRecordsConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Form picker */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Form / Table</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Unique-field match info */}
      {config.form_id && (
        uniqueFields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-700">
            This form has no unique fields. Mark at least one field unique in the form builder to use upsert.
          </p>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-500">
            Matches on: {uniqueFields.map((f) => f.label || f.name).join(', ')}
          </p>
        )
      )}

      <div className="h-px bg-slate-100" />

      {/* Values */}
      <div className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Field values</Label>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">Select a form to set field values.</p>
        ) : (
          <ValuesEditor
            values={config.values}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(values) => set({ values })}
          />
        )}
        <p className="text-[10px] text-slate-400">
          Outputs <span className="font-mono">action</span> ("created" or "updated") and <span className="font-mono">record</span> to downstream nodes.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// transform — maps a source list into a target form's schema. Mapping rows
// reuse ValuesEditor (TransformFieldMap and FieldValue share the same
// {id, field, value_mode, value, expression} shape), but expressions here
// evaluate once per SOURCE ITEM with that item's own fields overlaid into
// scope — e.g. an expression of just `Email` reads the current item's Email
// field directly, not Vars["item"]["Email"].
// ---------------------------------------------------------------------------

function TransformForm({ config, variables, nodeContext, onChange }: {
  config: TransformConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: TransformConfig) => void
}) {
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []

  const set = (patch: Partial<TransformConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Source list */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Source List</Label>
        <ExpressionField
          value={config.source_expr ?? ''}
          onChange={(v) => set({ source_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. NodeOutputs["fetch1"]["records"]'
          label="source list"
        />
        <p className="text-[10px] text-slate-400">Must resolve to a list of records. Runs once per item.</p>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Target form */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Target Form / Table</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Field mappings */}
      <div className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Field mappings</Label>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">Select a target form to map fields.</p>
        ) : (
          <ValuesEditor
            values={config.mappings}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(mappings) => set({ mappings: mappings as TransformFieldMap[] })}
          />
        )}
        <p className="text-[10px] text-slate-400">
          Expressions evaluate per source item — reference the item's own fields directly (e.g. <span className="font-mono">Email</span>), not through <span className="font-mono">Vars</span>.
        </p>
      </div>

      <p className="text-[10px] text-slate-400">
        Outputs <span className="font-mono">records</span> (mapped to the target schema) and <span className="font-mono">count</span> to downstream nodes — chain into a Save Records node to write them.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// save_records — bulk upserts a list of records (typically a Transform
// node's "records" output) into a single form in one activity call.
// ---------------------------------------------------------------------------

function SaveRecordsForm({ config, variables, nodeContext, onChange }: {
  config: SaveRecordsConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: SaveRecordsConfig) => void
}) {
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []
  const uniqueFields = fields.filter((f) => f.unique)

  const set = (patch: Partial<SaveRecordsConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Target form */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Form / Table</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Unique-field match info */}
      {config.form_id && (
        uniqueFields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-700">
            This form has no unique fields. Mark at least one field unique in the form builder to use save_records.
          </p>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-500">
            Matches on: {uniqueFields.map((f) => f.label || f.name).join(', ')}
          </p>
        )
      )}

      <div className="h-px bg-slate-100" />

      {/* Source list */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Records to save</Label>
        <ExpressionField
          value={config.source_expr ?? ''}
          onChange={(v) => set({ source_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. NodeOutputs["transform1"]["records"]'
          label="records to save"
        />
        <p className="text-[10px] text-slate-400">
          Must resolve to a list of records shaped to this form's fields — e.g. a Transform node's <span className="font-mono">records</span> output. All records are upserted in one call.
        </p>
      </div>

      <p className="text-[10px] text-slate-400">
        Outputs <span className="font-mono">records</span>, <span className="font-mono">created</span>, <span className="font-mono">updated</span>, and <span className="font-mono">count</span> to downstream nodes.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// update_records
// ---------------------------------------------------------------------------

function MatchModeToggle({ mode, onChange, accent = 'bg-sky-500' }: { mode: RecordMatchMode; onChange: (m: RecordMatchMode) => void; accent?: string }) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
      {(['one', 'many'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
            mode === m ? `${accent} text-white shadow-sm` : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {m === 'one' ? 'Single record' : 'Multiple records'}
        </button>
      ))}
    </div>
  )
}

function UpdateRecordsForm({ config, variables, nodeContext, onChange }: {
  config: UpdateRecordsConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: UpdateRecordsConfig) => void
}) {
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []

  const set = (patch: Partial<UpdateRecordsConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Form picker */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Form / Table</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Match</Label>
        <MatchModeToggle mode={config.mode} onChange={(mode) => set({ mode })} />
        {config.mode === 'one' && (
          <p className="text-[10px] text-slate-400">Fails if the filter matches more than one record.</p>
        )}
      </div>

      <div className="h-px bg-slate-100" />

      {/* Filter */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <FilterIcon size={12} className="text-slate-400" />
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Filter</Label>
        </div>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">Select a form to add filters.</p>
        ) : (
          <FilterBuilder
            group={config.filter ?? newGroup()}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(g) => set({ filter: g })}
          />
        )}
      </div>

      <div className="h-px bg-slate-100" />

      {/* Values */}
      <div className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Field values</Label>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">Select a form to set field values.</p>
        ) : (
          <ValuesEditor
            values={config.values}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(values) => set({ values })}
          />
        )}
        <p className="text-[10px] text-slate-400">
          Outputs <span className="font-mono">records</span> and <span className="font-mono">count</span> to downstream nodes.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// delete_records
// ---------------------------------------------------------------------------

function DeleteRecordsForm({ config, variables, nodeContext, onChange }: {
  config: DeleteRecordsConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: DeleteRecordsConfig) => void
}) {
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []

  const set = (patch: Partial<DeleteRecordsConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Form picker */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Form / Table</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Match</Label>
        <MatchModeToggle mode={config.mode} onChange={(mode) => set({ mode })} accent="bg-red-500" />
        {config.mode === 'one' && (
          <p className="text-[10px] text-slate-400">Fails if the filter matches more than one record.</p>
        )}
      </div>

      <div className="h-px bg-slate-100" />

      {/* Filter */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <FilterIcon size={12} className="text-slate-400" />
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Filter</Label>
        </div>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">Select a form to add filters.</p>
        ) : (
          <FilterBuilder
            group={config.filter ?? newGroup()}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(g) => set({ filter: g })}
          />
        )}
        <p className="rounded-lg border border-dashed border-red-200 bg-red-50 p-2 text-[10px] text-red-600">
          A filter is required — deleting an entire table by accident is not allowed.
        </p>
      </div>

      <p className="text-[10px] text-slate-400">
        Outputs <span className="font-mono">count</span> to downstream nodes.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// iterator
// ---------------------------------------------------------------------------

function IteratorForm({ config, variables, nodeContext, onChange }: {
  config: IteratorConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: IteratorConfig) => void
}) {
  const set = (patch: Partial<IteratorConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Source list */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Source List</Label>
        <ExpressionField
          value={config.source_expr ?? ''}
          onChange={(v) => set({ source_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. NodeOutputs["fetch"]["records"]'
          label="source list"
        />
        <p className="text-[10px] text-slate-400">Must resolve to a list. The body runs once per element.</p>
      </div>

      {/* Item / index var names */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Item Var</Label>
          <Input
            value={config.item_var ?? 'item'}
            onChange={(e) => set({ item_var: e.target.value })}
            placeholder="item"
            className="h-8 font-mono text-[12px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Index Var</Label>
          <Input
            value={config.index_var ?? 'index'}
            onChange={(e) => set({ index_var: e.target.value })}
            placeholder="index"
            className="h-8 font-mono text-[12px]"
          />
        </div>
      </div>
      <p className="-mt-2 text-[10px] text-slate-400">
        Inside the loop body, reference <code className="text-amber-600">Vars["{config.item_var || 'item'}"]</code> and <code className="text-amber-600">Vars["{config.index_var || 'index'}"]</code>.
      </p>

      <div className="h-px bg-slate-100" />

      {/* Filter condition */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Filter (optional)</Label>
        <ExpressionField
          value={config.filter_expr ?? ''}
          onChange={(v) => set({ filter_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. Vars["item"]["active"] == true'
          label="filter condition"
        />
        <p className="text-[10px] text-slate-400">Run the body only when this is true (skip the element otherwise).</p>
      </div>

      {/* Stop condition */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Stop When (optional)</Label>
        <ExpressionField
          value={config.stop_expr ?? ''}
          onChange={(v) => set({ stop_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. Vars["index"] >= 10'
          label="stop condition"
        />
        <p className="text-[10px] text-slate-400">Stop the loop early when this becomes true.</p>
      </div>

      {/* Max iterations */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Max Iterations</Label>
        <Input
          type="number"
          min={0}
          value={config.max_iters || ''}
          onChange={(e) => set({ max_iters: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) })}
          placeholder="0 = unlimited"
          className="h-8 w-32 text-[12px]"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// subflow
// ---------------------------------------------------------------------------

function SubflowForm({ config, onChange }: {
  config: { definition_id: string }
  onChange: (c: { definition_id: string }) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Workflow Definition ID</Label>
      <Input
        value={config.definition_id ?? ''}
        onChange={(e) => onChange({ definition_id: e.target.value })}
        placeholder="Paste workflow UUID…"
        className="text-xs font-mono"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function LiteralInput({ varType, value, onChange }: {
  varType: VariableDecl['type']
  value: unknown
  onChange: (v: unknown) => void
}) {
  const str = value === undefined || value === null ? '' : String(value)

  if (varType === 'boolean') {
    return (
      <select
        value={str}
        onChange={(e) => onChange(e.target.value === 'true' ? true : e.target.value === 'false' ? false : '')}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      >
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }

  const inputTypeMap: Record<string, string> = {
    integer: 'number', float: 'number', time: 'time', datetime: 'datetime-local',
  }

  return (
    <Input
      type={inputTypeMap[varType] ?? 'text'}
      step={varType === 'float' ? '0.01' : undefined}
      value={str}
      placeholder={varType === 'string' ? 'Enter value…' : undefined}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') { onChange(''); return }
        if (varType === 'integer') { onChange(parseInt(raw, 10)); return }
        if (varType === 'float')   { onChange(parseFloat(raw));   return }
        onChange(raw)
      }}
      className="text-sm"
    />
  )
}

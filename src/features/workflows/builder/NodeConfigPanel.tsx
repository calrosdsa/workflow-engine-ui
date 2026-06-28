import { Settings, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useBuilderStore } from './store'
import { NODE_REGISTRY } from './node-registry'
import { cn } from '@/lib/utils'
import type { VariableDecl, SetVariableConfig, ConditionConfig } from '../types'

export function NodeConfigPanel() {
  const { nodes, selectedNodeId, variables, updateNodeConfig, updateNodeLabel, configPanelOpen, toggleConfigPanel } = useBuilderStore()
  const node = nodes.find((n) => n.id === selectedNodeId)
  const reg  = node ? NODE_REGISTRY[node.data.type] : null
  const Icon = reg?.icon

  return (
    <aside
      className={[
        'relative flex shrink-0 flex-col border-l border-slate-200 bg-white transition-all duration-200',
        configPanelOpen ? 'w-72' : 'w-10',
      ].join(' ')}
    >
      {/* Toggle button — always visible on the left edge */}
      <button
        onClick={toggleConfigPanel}
        className="absolute -left-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-600"
        title={configPanelOpen ? 'Collapse config' : 'Expand config'}
      >
        {configPanelOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

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
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm', reg.gradient)}>
              <Icon size={17} strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-slate-800">{reg.label}</p>
              <p className="truncate font-mono text-[10px] text-slate-400">{node.id}</p>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {/* Label */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Label</Label>
              <Input
                value={node.data.label}
                onChange={(e) => updateNodeLabel(node.id, e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Type-specific config */}
            {node.data.type === 'set_variable' && (
              <SetVariableForm
                config={node.data.configuration as SetVariableConfig}
                variables={variables}
                onChange={(cfg) => updateNodeConfig(node.id, cfg)}
              />
            )}
            {node.data.type === 'condition' && (
              <ConditionForm
                config={node.data.configuration as ConditionConfig}
                variables={variables}
                onChange={(cfg) => updateNodeConfig(node.id, cfg)}
              />
            )}
            {node.data.type === 'subflow' && (
              <SubflowForm
                config={node.data.configuration as { definition_id: string }}
                onChange={(cfg) => updateNodeConfig(node.id, cfg)}
              />
            )}
          </div>
        </>
      )}
    </aside>
  )
}

// ---------------------------------------------------------------------------
// set_variable
// ---------------------------------------------------------------------------

function SetVariableForm({ config, variables, onChange }: {
  config: SetVariableConfig
  variables: VariableDecl[]
  onChange: (c: SetVariableConfig) => void
}) {
  const set = (patch: Partial<SetVariableConfig>) => onChange({ ...config, ...patch })
  const selVar = variables.find((v) => v.name === config.variable_name)

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Target Variable</Label>
        {variables.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-300 p-3 text-xs text-gray-400">
            Declare variables in the Variables panel first.
          </p>
        ) : (
          <Select value={config.variable_name} onChange={(e) => set({ variable_name: e.target.value, literal_value: '' })}>
            <option value="">Select…</option>
            {variables.map((v) => (
              <option key={v.name} value={v.name}>{v.name} ({v.type})</option>
            ))}
          </Select>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Mode</Label>
        <div className="flex gap-2">
          {(['literal', 'expression'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set({ mode: m })}
              className={[
                'flex-1 rounded-lg border py-1.5 text-xs font-medium capitalize transition-colors',
                config.mode === m
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              ].join(' ')}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {config.mode === 'literal' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Value</Label>
          <LiteralInput
            varType={selVar?.type ?? 'string'}
            value={config.literal_value}
            onChange={(v) => set({ literal_value: v })}
          />
        </div>
      )}

      {config.mode === 'expression' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Expression</Label>
          <textarea
            value={config.expression ?? ''}
            onChange={(e) => set({ expression: e.target.value })}
            rows={4}
            placeholder={`e.g. Vars["count"] + 1`}
            className="w-full resize-y rounded-md border border-gray-200 px-3 py-2 font-mono text-xs focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <ExprHints type={selVar?.type ?? 'string'} />
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// condition
// ---------------------------------------------------------------------------

function ConditionForm({ config, variables, onChange }: {
  config: ConditionConfig
  variables: VariableDecl[]
  onChange: (c: ConditionConfig) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Expression (must return boolean)</Label>
      <textarea
        value={config.expression}
        onChange={(e) => onChange({ expression: e.target.value })}
        rows={4}
        placeholder={`e.g. Vars["age"] >= 18`}
        className="w-full resize-y rounded-md border border-gray-200 px-3 py-2 font-mono text-xs focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
      {variables.length > 0 && (
        <div className="mt-1">
          <p className="text-[10px] text-gray-400 mb-1">Available variables:</p>
          <div className="flex flex-wrap gap-1">
            {variables.map((v) => (
              <code key={v.name} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                {v.name}
              </code>
            ))}
          </div>
        </div>
      )}
      <p className="text-[10px] text-gray-400">Connects to <span className="font-semibold text-emerald-600">true</span> and <span className="font-semibold text-red-500">false</span> output handles.</p>
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
      <Label className="text-xs">Workflow Definition ID</Label>
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
// shared helpers
// ---------------------------------------------------------------------------

function LiteralInput({ varType, value, onChange }: {
  varType: VariableDecl['type']
  value: unknown
  onChange: (v: unknown) => void
}) {
  const str = value === undefined || value === null ? '' : String(value)

  if (varType === 'boolean') {
    return (
      <Select value={str} onChange={(e) => onChange(e.target.value === 'true' ? true : e.target.value === 'false' ? false : '')}>
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </Select>
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
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') { onChange(''); return }
        if (varType === 'integer') { onChange(parseInt(raw, 10)); return }
        if (varType === 'float')   { onChange(parseFloat(raw));   return }
        onChange(raw)
      }}
    />
  )
}

const EXPR_HINTS: Record<string, string[]> = {
  string:   ['Vars["name"] + " world"', 'upper(Vars["code"])'],
  integer:  ['Vars["count"] + 1', 'Vars["a"] * Vars["b"]'],
  float:    ['Vars["price"] * 1.2'],
  boolean:  ['Vars["age"] >= 18'],
  time:     ['now()'],
  datetime: ['now()'],
}

function ExprHints({ type }: { type: string }) {
  const hints = EXPR_HINTS[type] ?? []
  if (!hints.length) return null
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-gray-400">Examples:</p>
      {hints.map((h) => (
        <code key={h} className="block rounded bg-gray-50 px-2 py-0.5 text-[10px] text-purple-700">{h}</code>
      ))}
    </div>
  )
}

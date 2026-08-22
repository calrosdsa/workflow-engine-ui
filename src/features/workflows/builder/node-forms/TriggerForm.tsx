// trigger — mirrors internal/graph/configs_trigger.go
import {
  Filter as FilterIcon, Clock, Zap as ZapIcon, ShieldCheck, CheckCircle2, Send, MousePointerClick,
  type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { FilterBuilder, newGroup } from '../FilterBuilder'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm } from '@/features/forms/hooks'
import { ensureGroupIds } from './id-helpers'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, TriggerConfig, TriggerMode, TriggerEventType } from '../../types'

export function normaliseTriggerConfig(raw: unknown): TriggerConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<TriggerConfig>
  return {
    mode:           r.mode ?? 'on_demand',
    cron:           r.cron ?? '',
    timezone:       r.timezone ?? '',
    description:    r.description ?? '',
    form_id:        r.form_id ?? '',
    event_type:     r.event_type ?? 'create_or_update',
    filter:         ensureGroupIds(r.filter) ?? newGroup(),
    source_form_id: r.source_form_id ?? '',
    enabled:        r.enabled ?? true,
  }
}

const TRIGGER_MODES: { value: TriggerMode; label: string; icon: LucideIcon; description: string }[] = [
  { value: 'on_demand',   label: 'On Demand',    icon: ZapIcon,      description: 'Run manually or via API — no automatic trigger.' },
  { value: 'on_demand_data_driven', label: 'On Demand (with a record)', icon: MousePointerClick, description: 'Run manually against one specific record — its fields are available to every node as Vars["fieldKey"]. Used by record-detail custom actions (FR-D2-017).' },
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

export interface TriggerFormProps {
  config: TriggerConfig
  variables: VariableDecl[]
  nodeContext?: NodeOutputSchema[]
  onChange: (c: TriggerConfig) => void
}

export function TriggerForm({ config, variables, onChange }: TriggerFormProps) {
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

      {/* On Demand (data-driven) mode fields — FR-B3-007 */}
      {config.mode === 'on_demand_data_driven' && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Restrict to Form (optional)</Label>
          <FormReferenceSelect value={config.source_form_id || undefined} onChange={(id) => set({ source_form_id: id ?? '' })} />
          <p className="text-[10px] text-slate-400">
            Leave blank to allow this workflow to be triggered against a record from any form. When set, only that form's own record-detail custom actions can dispatch this workflow.
          </p>
        </div>
      )}

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

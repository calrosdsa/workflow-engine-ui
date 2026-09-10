// trigger — mirrors internal/graph/configs_trigger.go
import { useState } from 'react'
import {
  Filter as FilterIcon, Clock, Zap as ZapIcon, ShieldCheck, CheckCircle2, Send, MousePointerClick,
  Webhook, Workflow as WorkflowIcon, AlertTriangle, Copy, Check, RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { FilterBuilder, newGroup } from '../FilterBuilder'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm } from '@/features/forms/hooks'
import { ensureGroupIds } from './id-helpers'
import { WorkflowReferenceSelect } from '../config/WorkflowReferenceSelect'
import { CredentialSelect } from '@/features/app-settings/CredentialSelect'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, TriggerConfig, TriggerMode, TriggerEventType } from '../../types'

export function normaliseTriggerConfig(raw: unknown): TriggerConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<TriggerConfig>
  return {
    mode:                  r.mode ?? 'on_demand',
    cron:                  r.cron ?? '',
    timezone:              r.timezone ?? '',
    description:           r.description ?? '',
    form_id:               r.form_id ?? '',
    event_type:            r.event_type ?? 'create_or_update',
    filter:                ensureGroupIds(r.filter) ?? newGroup(),
    source_form_id:        r.source_form_id ?? '',
    webhook_token:         r.webhook_token ?? '',
    webhook_provider:      r.webhook_provider ?? '',
    webhook_events:        r.webhook_events ?? [],
    webhook_secret_credential: r.webhook_secret_credential ?? '',
    source_definition_id:  r.source_definition_id ?? '',
    enabled:               r.enabled ?? true,
    expose_as_tool:        r.expose_as_tool ?? false,
    tool_name:             r.tool_name ?? '',
    tool_description:      r.tool_description ?? '',
    tool_parameters:       r.tool_parameters ?? [],
  }
}

const TRIGGER_MODES: { value: TriggerMode; label: string; icon: LucideIcon; description: string }[] = [
  { value: 'on_demand',   label: 'On Demand',    icon: ZapIcon,      description: 'Run manually or via API — no automatic trigger.' },
  { value: 'on_demand_data_driven', label: 'On Demand (with a record)', icon: MousePointerClick, description: 'Run manually against one specific record — its fields are available to every node as Vars["fieldKey"]. Used by record-detail custom actions (FR-D2-017).' },
  { value: 'scheduled',   label: 'Scheduled',    icon: Clock,        description: 'Run on a recurring cron schedule.' },
  { value: 'before',      label: 'Before Write', icon: ShieldCheck,  description: 'Run before a record is created/updated/deleted — can block the write.' },
  { value: 'after',       label: 'After Write',  icon: CheckCircle2, description: 'Run after a record write commits — synchronously, blocking the response.' },
  { value: 'after_async', label: 'After Write (Async)', icon: Send,  description: 'Run after a record write commits — fire-and-forget, does not block the response.' },
  { value: 'webhook',     label: 'On Webhook Call', icon: Webhook,   description: 'Run when an external system sends an HTTP request to this workflow\'s own URL.' },
  { value: 'executed_by_workflow', label: 'When Executed by Another Workflow', icon: WorkflowIcon, description: 'Run only when called by an Execute Workflow node in a different workflow.' },
  { value: 'on_error',    label: 'Error Trigger', icon: AlertTriangle, description: 'Run when another workflow\'s execution fails.' },
]

const EVENT_TYPES: { value: TriggerEventType; label: string }[] = [
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'create_or_update', label: 'Create or Update' },
]

// WEBHOOK_PROVIDERS mirrors internal/webhookprovider's registered Providers
// (registry.go's register() calls) — an internal-only, code-defined set (see
// that package's own doc comment), so this is a hand-maintained mirror, the
// same convention TRIGGER_MODES/EVENT_TYPES above already use for their own
// Go-side source of truth, not a fetch from a served catalog. labelKey/
// descriptionKey/eventLabelKeys index into src/features/i18n/locales — see
// workflow-engine-ui/CLAUDE.md's t() rule. needsSecret and each event's
// value must match that provider's own Describe()/EventType* constants
// exactly, since api/workflows.validateWebhookProvider rejects any
// webhook_events entry the selected provider doesn't produce.
const WEBHOOK_PROVIDERS: {
  value: string
  labelKey: string
  descriptionKey: string
  instructionsKey: string
  needsSecret: boolean
  events: { value: string; labelKey: string }[]
}[] = [
  {
    value: 'generic',
    labelKey: 'workflows.trigger.webhook.provider_generic_label',
    descriptionKey: 'workflows.trigger.webhook.provider_generic_description',
    instructionsKey: 'workflows.trigger.webhook.instructions_generic',
    needsSecret: false,
    events: [],
  },
  {
    value: 'meta',
    labelKey: 'workflows.trigger.webhook.provider_meta_label',
    descriptionKey: 'workflows.trigger.webhook.provider_meta_description',
    instructionsKey: 'workflows.trigger.webhook.instructions_meta',
    needsSecret: true,
    events: [
      { value: 'messages', labelKey: 'workflows.trigger.webhook.event_messages' },
      { value: 'message_status', labelKey: 'workflows.trigger.webhook.event_message_status' },
    ],
  },
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

  // Switching mode clears the form-scoping field belonging to the mode being
  // LEFT, because the two are not interchangeable: form_id is the form whose
  // writes fire a before/after trigger, source_form_id is the form whose
  // records may manually dispatch an on_demand_data_driven one (see
  // internal/graph/configs_trigger.go, which spells out why they are separate
  // fields). Without this, `set({ mode })` spreads the whole config forward and
  // strands the previous mode's id — which the backend now rejects on save when
  // a stray form_id is the ONLY scoping present, since that combination reads
  // as "scoped" while dispatching from any form.
  const setMode = (mode: TriggerMode) => {
    if (mode === 'on_demand_data_driven') {
      set({ mode, form_id: '' })
    } else if (mode === 'before' || mode === 'after' || mode === 'after_async') {
      set({ mode, source_form_id: '' })
    } else {
      set({ mode })
    }
  }

  return (
    <div className="space-y-4">
      {/* Enabled toggle */}
      <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-2">
        <div>
          <Label className="text-[12px] font-semibold text-[hsl(var(--foreground))]">Enabled</Label>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Disabled triggers never fire (workflow can still be run on demand from the editor).</p>
        </div>
        <button
          type="button"
          onClick={() => set({ enabled: !config.enabled })}
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors',
            config.enabled ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--muted-foreground))]/40',
          )}
        >
          <span className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-[hsl(var(--card))] shadow transition-transform',
            config.enabled ? 'translate-x-4' : 'translate-x-0.5',
          )} />
        </button>
      </div>

      {/* Mode picker */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Trigger Mode</Label>
        <div className="space-y-1.5">
          {TRIGGER_MODES.map((m) => {
            const Icon = m.icon
            const active = config.mode === m.value
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                  active ? 'border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/10' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--muted-foreground))]/40',
                )}
              >
                <div className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  active ? 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
                )}>
                  <Icon size={14} />
                </div>
                <div className="min-w-0">
                  <p className={cn('text-[12px] font-semibold', active ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--foreground))]')}>{m.label}</p>
                  <p className="text-[10px] leading-snug text-[hsl(var(--muted-foreground))]">{m.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* Expose as tool — FR-C8-004. Orthogonal to Mode: this workflow keeps
          whatever mode already governs its normal dispatch and can ALSO be
          made callable as an Agent tool. */}
      <ExposeAsToolFields config={config} variables={variables} set={set} />

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* On Demand (data-driven) mode fields — FR-B3-007 */}
      {config.mode === 'on_demand_data_driven' && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Restrict to Form (optional)</Label>
          <FormReferenceSelect value={config.source_form_id || undefined} onChange={(id) => set({ source_form_id: id ?? '' })} />
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Leave blank to allow this workflow to be triggered against a record from any form. When set, only that form's own record-detail custom actions can dispatch this workflow.
          </p>
        </div>
      )}

      {/* Scheduled mode fields */}
      {config.mode === 'scheduled' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Cron Expression</Label>
            <Input
              value={config.cron ?? ''}
              onChange={(e) => set({ cron: e.target.value })}
              placeholder="0 9 * * *"
              className="h-8 font-mono text-[12px]"
            />
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Standard 5-field crontab syntax, or shorthands like <code className="font-mono">@daily</code>, <code className="font-mono">@hourly</code>, <code className="font-mono">@every 1h30m</code>.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Timezone</Label>
            <Input
              value={config.timezone ?? ''}
              onChange={(e) => set({ timezone: e.target.value })}
              placeholder="e.g. America/New_York (blank = UTC)"
              className="h-8 text-[12px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Description</Label>
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
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Form / Table</Label>
            <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">On Event</Label>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-[hsl(var(--muted))] p-1">
              {EVENT_TYPES.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => set({ event_type: e.value })}
                  className={cn(
                    'rounded-md py-1 text-[11px] font-medium transition-colors',
                    config.event_type === e.value ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                  )}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-[hsl(var(--border))]" />

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <FilterIcon size={12} className="text-[hsl(var(--muted-foreground))]" />
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Filter (optional)</Label>
            </div>
            {!config.form_id ? (
              <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">Select a form to add filters.</p>
            ) : (
              <FilterBuilder
                group={config.filter ?? newGroup()}
                fields={fields}
                variables={variables}
                onChange={(g) => set({ filter: g })}
              />
            )}
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Use the <span className="font-mono">was updated</span> operator on a field to react only when that field's value actually changes (change-detection, evaluated against the old/new record pair).
            </p>
          </div>

          <p className="rounded-lg border border-dashed border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-2.5 text-[10px] text-[hsl(var(--warning))]">
            {config.mode === 'before'
              ? 'Runs synchronously before the write. A Show Message node with type "error" here blocks the write and returns the message to the caller.'
              : config.mode === 'after'
                ? 'Runs synchronously after the write commits. A Show Message node with type "error" here becomes a non-fatal warning on the response (the write already happened).'
                : 'Runs after the write commits, without waiting. Failures are logged only — nothing is left to report them to the caller.'}
          </p>
        </div>
      )}

      {config.mode === 'on_demand' && (
        <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
          No additional configuration. Run this workflow manually or via the executions API.
        </p>
      )}

      {/* Webhook mode */}
      {config.mode === 'webhook' && <WebhookModeFields config={config} set={set} />}

      {/* Executed-by-workflow mode */}
      {config.mode === 'executed_by_workflow' && (
        <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
          No additional configuration. Add an <span className="font-semibold text-[hsl(var(--muted-foreground))]">Execute Workflow</span> node
          in another workflow and point it at this one — this trigger only accepts calls made that way, never a plain
          on-demand run or the executions API.
        </p>
      )}

      {/* Error trigger mode */}
      {config.mode === 'on_error' && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Watch Workflow (optional)</Label>
          <WorkflowReferenceSelect
            value={config.source_definition_id || undefined}
            onChange={(id) => set({ source_definition_id: id ?? '' })}
            placeholder="Any workflow in this app…"
          />
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Leave blank to react to any workflow's failed execution in this app. When set, only that workflow's
            failures dispatch this trigger.
          </p>
        </div>
      )}
    </div>
  )
}

// ExposeAsToolFields — FR-C8-004's toggle plus conditional name/description/
// parameter-selection block, following the same `set({...})` patch pattern
// every other mode's field block above already uses. Parameter selection
// reuses this form's own `variables` prop (the workflow's own declared
// Variables, sourced from VariablesPanel.tsx's builder-store state) rather
// than a new variable-listing component, per FR-C8-004 §3's own resolved
// design.
function ExposeAsToolFields({
  config,
  variables,
  set,
}: {
  config: TriggerConfig
  variables: VariableDecl[]
  set: (patch: Partial<TriggerConfig>) => void
}) {
  const parameters = config.tool_parameters ?? []
  const selectedNames = new Set(parameters.map((p) => p.variable_name))

  const toggleParameter = (name: string, checked: boolean) => {
    if (checked) {
      set({ tool_parameters: [...parameters, { variable_name: name, description: '' }] })
    } else {
      set({ tool_parameters: parameters.filter((p) => p.variable_name !== name) })
    }
  }

  const updateParamDescription = (name: string, description: string) => {
    set({ tool_parameters: parameters.map((p) => (p.variable_name === name ? { ...p, description } : p)) })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-2">
        <div>
          <Label className="text-[12px] font-semibold text-[hsl(var(--foreground))]">Expose as Tool</Label>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Let an Agent call this workflow directly, in addition to however it's normally triggered above.</p>
        </div>
        <button
          type="button"
          onClick={() => set({ expose_as_tool: !config.expose_as_tool })}
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors',
            config.expose_as_tool ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--muted-foreground))]/40',
          )}
        >
          <span className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-[hsl(var(--card))] shadow transition-transform',
            config.expose_as_tool ? 'translate-x-4' : 'translate-x-0.5',
          )} />
        </button>
      </div>

      {config.expose_as_tool && (
        <div className="space-y-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Tool Name</Label>
            <Input
              value={config.tool_name ?? ''}
              onChange={(e) => set({ tool_name: e.target.value })}
              placeholder="e.g. Send Invoice"
              className="h-8 text-[12px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Tool Description</Label>
            <textarea
              value={config.tool_description ?? ''}
              onChange={(e) => set({ tool_description: e.target.value })}
              rows={3}
              placeholder="What this tool does and when an Agent should call it…"
              className="w-full resize-y rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-[12px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Parameters</Label>
            {variables.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
                This workflow has no declared Variables yet — add one in the Variables panel to expose it as a tool parameter.
              </p>
            ) : (
              <div className="space-y-2">
                {variables.map((v) => {
                  const selected = selectedNames.has(v.name)
                  const param = parameters.find((p) => p.variable_name === v.name)
                  return (
                    <div key={v.name} className="rounded-lg border border-[hsl(var(--border))] p-2">
                      <label className="flex items-center gap-2">
                        <Checkbox checked={selected} onCheckedChange={(c) => toggleParameter(v.name, c === true)} />
                        <span className="font-mono text-[11px] text-[hsl(var(--foreground))]">{v.name}</span>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">({v.type})</span>
                      </label>
                      {selected && (
                        <Input
                          value={param?.description ?? ''}
                          onChange={(e) => updateParamDescription(v.name, e.target.value)}
                          placeholder="What should the model fill in here?"
                          className="mt-1.5 h-7 text-[11px]"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Leave every Variable unchecked for a tool that needs no input.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// WebhookModeFields shows the generated URL (once saved) and a copy button,
// plus the provider/events/secret configuration that decides how an inbound
// POST to that URL is authenticated and split into events — see
// api/workflows.validateWebhookProvider (server-authoritative; this form
// does not duplicate its validation, only steers the user toward valid
// combinations) and internal/webhookprovider's own doc comment for the
// Verify/Authenticate/Extract contract these fields feed. The URL itself is
// server-minted — see api/workflows.Handler.syncWebhook — so there is
// nothing to fill in for it before the first save; that section stays
// read-only by design.
function WebhookModeFields({ config, set }: { config: TriggerConfig; set: (patch: Partial<TriggerConfig>) => void }) {
  const t = useTranslation()
  const [copied, setCopied] = useState(false)
  const url = config.webhook_token
    ? `${window.location.origin}/api/webhooks/${config.webhook_token}`
    : ''

  const copy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const providerValue = config.webhook_provider || 'generic'
  // No `?? WEBHOOK_PROVIDERS[0]` fallback here on purpose: this field is a
  // server-authoritative name (any name registered in internal/webhookprovider
  // validates — see validateWebhookProvider), so a value this hardcoded FE
  // mirror doesn't yet know about is a real, reachable case the moment a new
  // provider ships server-side before this array is updated to match — not a
  // hypothetical. Falling back to the generic entry would silently misrender
  // the active card, needsSecret gate, and instructions as if the trigger
  // were generic while providerValue itself still held the real name; `provider`
  // staying undefined below and being handled explicitly is what keeps that
  // state honest instead of silently wrong.
  const provider = WEBHOOK_PROVIDERS.find((p) => p.value === providerValue)
  const events = config.webhook_events ?? []

  // Switching provider clears webhook_events AND webhook_secret_credential —
  // the same defensive-clear reasoning setMode above already documents for
  // mode-specific fields: a meta event name (e.g. "message_status") or a
  // meta-scoped secret credential left over after switching to a provider
  // that doesn't use it would either fail server-side validation on the next
  // save (validateWebhookProvider, for events) or sit invisibly in the saved
  // config only to silently reappear, looking freshly chosen, if the user
  // switches back (for the secret) — and every provider's own event
  // vocabulary is disjoint from every other's. Guarded on an actual change —
  // re-clicking the already-active provider card must not wipe a configured
  // event selection or secret.
  const setProvider = (value: string) => {
    if (value === providerValue) return
    set({ webhook_provider: value, webhook_events: [], webhook_secret_credential: '' })
  }

  const toggleEvent = (value: string, checked: boolean) => {
    set({ webhook_events: checked ? [...events, value] : events.filter((e) => e !== value) })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Webhook URL</Label>
        {url ? (
          <>
            <div className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 py-1.5">
              <code className="min-w-0 flex-1 truncate text-[11px] text-[hsl(var(--muted-foreground))]">{url}</code>
              <button
                type="button"
                onClick={copy}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted-foreground))]/20 hover:text-[hsl(var(--foreground))]"
                title="Copy URL"
              >
                {copied ? <Check size={12} className="text-[hsl(var(--success))]" /> : <Copy size={12} />}
              </button>
            </div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Send a <span className="font-mono">POST</span> request here with a JSON object body — its fields are
              available to every node as <span className="font-mono">Vars["fieldKey"]</span>, the same way a
              triggering record's fields are. A body-less call is treated as an empty payload.
            </p>
          </>
        ) : (
          <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-[hsl(var(--border))] p-3 text-[11px] text-[hsl(var(--muted-foreground))]">
            <RefreshCw size={12} className="shrink-0" />
            Save this workflow once to generate its webhook URL.
          </p>
        )}
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* Provider select */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {t('workflows.trigger.webhook.provider_label')}
        </Label>
        {!provider && (
          <p className="rounded-lg border border-dashed border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-2.5 text-[10px] text-[hsl(var(--warning))]">
            {t('workflows.trigger.webhook.unrecognized_provider', { provider: providerValue })}
          </p>
        )}
        <div className="space-y-1.5">
          {WEBHOOK_PROVIDERS.map((p) => {
            const active = providerValue === p.value
            return (
              <button
                key={p.value}
                type="button"
                aria-pressed={active}
                onClick={() => setProvider(p.value)}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 rounded-xl border p-2.5 text-left transition-colors',
                  active ? 'border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/10' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--muted-foreground))]/40',
                )}
              >
                <span className={cn('text-[12px] font-semibold', active ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--foreground))]')}>
                  {t(p.labelKey)}
                </span>
                <span className="text-[10px] leading-snug text-[hsl(var(--muted-foreground))]">{t(p.descriptionKey)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Events multiselect — only for a provider with a declared event
          vocabulary (generic has none — see WEBHOOK_PROVIDERS above). */}
      {provider && provider.events.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {t('workflows.trigger.webhook.events_label')}
          </Label>
          <div className="space-y-1.5">
            {provider.events.map((e) => {
              const checked = events.includes(e.value)
              return (
                <label
                  key={e.value}
                  className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] p-2"
                >
                  <Checkbox checked={checked} onCheckedChange={(c) => toggleEvent(e.value, c === true)} />
                  <span className="text-[11px] text-[hsl(var(--foreground))]">{t(e.labelKey)}</span>
                </label>
              )
            })}
          </div>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.trigger.webhook.events_hint')}</p>
        </div>
      )}

      {/* Secret credential — only for a provider that authenticates
          requests (needsSecret), matching resolveWebhookSecret's own
          server-side requirement, which also rejects an empty value here at
          save time (a hard failure this asterisk/hint surfaces up front
          instead of only after a save round-trip). */}
      {provider && provider.needsSecret && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {t('workflows.trigger.webhook.secret_label')}
            <span className="ml-1 text-[hsl(var(--destructive))]">*</span>
          </Label>
          <CredentialSelect
            value={config.webhook_secret_credential || undefined}
            onChange={(name) => set({ webhook_secret_credential: name ?? '' })}
            typeFilter={['bearer', 'api_key']}
          />
          {!config.webhook_secret_credential && (
            <p className="text-[10px] text-[hsl(var(--warning))]">
              {t('workflows.trigger.webhook.secret_required', { provider: t(provider.labelKey) })}
            </p>
          )}
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {t('workflows.trigger.webhook.secret_hint', { provider: t(provider.labelKey) })}
          </p>
        </div>
      )}

      {/* Provider setup instructions — mirrors that provider's own
          Describe().Instructions (internal/webhookprovider). Data-driven off
          WEBHOOK_PROVIDERS' own instructionsKey (not a second providerValue
          comparison) so a provider missing one is a TS error at the array
          literal, not a silent fallback to generic's text for it. */}
      <div className="space-y-1">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {t('workflows.trigger.webhook.instructions_label')}
        </Label>
        {!url && (
          <p className="text-[10px] text-[hsl(var(--warning))]">{t('workflows.trigger.webhook.save_first_hint')}</p>
        )}
        {provider && (
          <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-2.5 text-[10px] leading-snug text-[hsl(var(--muted-foreground))]">
            {t(provider.instructionsKey)}
          </p>
        )}
      </div>
    </div>
  )
}

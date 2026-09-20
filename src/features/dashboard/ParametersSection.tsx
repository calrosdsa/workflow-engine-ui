// Parameter and binding authoring — the human half of dashboard parameters
// (roadmap row 11 slice 2). Slice 1 shipped the model and the runtime bar,
// which left MCP able to declare a parameter through the catalog envelope
// and a person with no way to at all.
//
// Structurally mirrors the report surface's ArgumentsSection
// (features/reports/workbook/ArgumentsSection.tsx), because slice 1 lifted
// the report model rather than inventing a second one: a collapsed row per
// parameter, expanding to its own fields plus a bindings editor.
//
// NOT rendered on every dashboard-builder surface. See DashboardToolbox's
// `parameters` prop — the record detail page's custom tab uses the same
// builder but RuntimeGrid renders it with no ParameterBar, so a parameter
// declared there could never be set by anyone.
import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useForm } from '@/features/forms/hooks'
import { useTranslation, type I18nContextValue } from '@/features/i18n/I18nProvider'
import { cn } from '@/lib/utils'
import { bindableWidgets, coerceOperator, createParameter, operatorsFor, type BindableWidget } from './parameters'
import { useDashboardStore } from './store'
import { getWidget } from './widget-registry'
import type { DashboardParameter, ParameterBinding } from './schema'
import type { CompareOp } from '@/features/workflows/types'

function typeLabels(t: I18nContextValue['t']): Record<DashboardParameter['type'], string> {
  return {
    text: t('reports.arguments.type_text'),
    number: t('reports.arguments.type_number'),
    date: t('reports.arguments.type_date'),
    boolean: t('reports.arguments.type_boolean'),
  }
}

// Reuses the filter chips' own operator words rather than a second copy —
// same operators, same reader, one owner.
function opLabel(op: CompareOp, t: I18nContextValue['t']): string {
  const key: Partial<Record<CompareOp, string>> = {
    contains: 'filters.op.contains',
    not_contains: 'filters.op.not_contains',
    starts_with: 'filters.op.starts_with',
    ends_with: 'filters.op.ends_with',
    in: 'filters.op.in',
    not_in: 'filters.op.not_in',
  }
  const symbol: Partial<Record<CompareOp, string>> = {
    eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤',
  }
  return symbol[op] ?? (key[op] ? t(key[op]!) : op)
}

function keyProblem(param: DashboardParameter, all: DashboardParameter[], t: I18nContextValue['t']): string | undefined {
  if (!param.key.trim()) return t('builder.dashboard.parameters.key_required')
  if (all.filter((p) => p.key === param.key).length > 1) return t('builder.dashboard.parameters.key_duplicate', { key: param.key })
  return undefined
}

export function ParametersSection() {
  const t = useTranslation()
  const schema = useDashboardStore((s) => s.schema)
  const addParameter = useDashboardStore((s) => s.addParameter)
  const updateParameter = useDashboardStore((s) => s.updateParameter)
  const removeParameter = useDashboardStore((s) => s.removeParameter)

  const [openKey, setOpenKey] = useState<string | null>(null)

  const parameters = schema.parameters ?? []
  const targets = bindableWidgets(schema.widgets, getWidget)

  const add = () => {
    const param = createParameter(parameters)
    // Pre-create a binding onto the first bindable tile so a new parameter
    // is immediately meaningful, exactly as the report panel does. It is a
    // default the author may change or delete, never implicit behavior.
    const first = targets[0]
    addParameter(param, first ? { parameterKey: param.key, widgetId: first.id, field: '', op: 'eq' } : undefined)
    setOpenKey(param.key)
  }

  return (
    <section className="border-t border-[hsl(var(--border))] p-3" aria-labelledby="dashboard-parameters-heading">
      <div className="mb-2 flex items-center justify-between">
        <h3 id="dashboard-parameters-heading" className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {t('builder.dashboard.parameters.title')}
        </h3>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]" onClick={add}>
          <Plus size={11} /> {t('common.add')}
        </Button>
      </div>

      {parameters.length === 0 ? (
        <p className="px-1 py-2 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
          {t('builder.dashboard.parameters.empty')}
        </p>
      ) : (
        <div className="space-y-1">
          {parameters.map((param) => (
            <ParameterRow
              key={param.key}
              param={param}
              all={parameters}
              targets={targets}
              open={openKey === param.key}
              onToggle={() => setOpenKey(openKey === param.key ? null : param.key)}
              onChange={(patch) => {
                updateParameter(param.key, patch)
                if (patch.key) setOpenKey(patch.key)
              }}
              onRemove={() => removeParameter(param.key)}
            />
          ))}
        </div>
      )}

      {parameters.length > 0 && targets.length === 0 && (
        // Every bindable widget type needs a form before it can be a target,
        // so this is the state where an author has declared a control that
        // cannot yet narrow anything. Said plainly rather than left to be
        // discovered at runtime.
        <p className="mt-2 flex items-start gap-1.5 px-1 text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
          <AlertTriangle size={11} className="mt-px shrink-0 text-[hsl(var(--destructive))]" />
          {t('builder.dashboard.parameters.no_targets')}
        </p>
      )}
    </section>
  )
}

interface ParameterRowProps {
  param: DashboardParameter
  all: DashboardParameter[]
  targets: BindableWidget[]
  open: boolean
  onToggle: () => void
  onChange: (patch: Partial<DashboardParameter>) => void
  onRemove: () => void
}

function ParameterRow({ param, all, targets, open, onToggle, onChange, onRemove }: ParameterRowProps) {
  const t = useTranslation()
  const labels = typeLabels(t)
  const problem = keyProblem(param, all, t)

  return (
    <div className={cn('rounded-md border', open ? 'border-[hsl(var(--primary))]/40' : 'border-[hsl(var(--border))]')}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 px-2 py-2 text-left">
        {open ? <ChevronDown size={12} className="shrink-0 opacity-60" /> : <ChevronRight size={12} className="shrink-0 opacity-60" />}
        <SlidersHorizontal size={12} className="shrink-0 text-[hsl(var(--primary))]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-[hsl(var(--foreground))]">{param.label}</span>
          <span className="block truncate text-[10px] text-[hsl(var(--muted-foreground))]">{labels[param.type]} · {param.key}</span>
        </span>
        {problem && <AlertTriangle size={12} className="shrink-0 text-[hsl(var(--destructive))]" />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-[hsl(var(--border))] p-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard.parameters.label_field')}</Label>
            <Input value={param.label} onChange={(e) => onChange({ label: e.target.value })} className="h-8 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard.parameters.key_label')}</Label>
            <Input
              value={param.key}
              onChange={(e) => onChange({ key: e.target.value })}
              className="h-8 font-mono text-[12px]"
              aria-invalid={problem ? true : undefined}
            />
            {problem && <p className="text-[10px] leading-4 text-[hsl(var(--destructive))]">{problem}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('common.type')}</Label>
            <SelectMenu value={param.type} onValueChange={(v) => onChange({ type: v as DashboardParameter['type'], default: undefined })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(labels) as DashboardParameter['type'][]).map((ty) => (
                  <SelectItem key={ty} value={ty} className="text-xs">{labels[ty]}</SelectItem>
                ))}
              </SelectContent>
            </SelectMenu>
            {/* Changing the type clears the default above, because a default
                left over from the previous type is a value the control can
                no longer produce. */}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard.parameters.default_label')}</Label>
            <DefaultValueInput param={param} onChange={(v) => onChange({ default: v })} />
            <p className="text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">{t('builder.dashboard.parameters.default_hint')}</p>
          </div>

          <BindingsEditor param={param} targets={targets} />

          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px] text-[hsl(var(--destructive))]" onClick={onRemove}>
              <Trash2 size={11} /> {t('builder.dashboard.parameters.delete')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function DefaultValueInput({ param, onChange }: {
  param: DashboardParameter
  onChange: (value: DashboardParameter['default']) => void
}) {
  const t = useTranslation()
  const asString = param.default == null ? '' : String(param.default)

  if (param.type === 'boolean') {
    return (
      <SelectMenu value={asString} onValueChange={(v) => onChange(v === '' ? undefined : v === 'true')}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('builder.dashboard.parameters.no_default')} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true" className="text-xs">{t('common.yes')}</SelectItem>
          <SelectItem value="false" className="text-xs">{t('common.no')}</SelectItem>
        </SelectContent>
      </SelectMenu>
    )
  }

  return (
    <Input
      type={param.type === 'number' ? 'number' : param.type === 'date' ? 'date' : 'text'}
      value={asString}
      // Empty means NO default — undefined, not the empty string, which
      // resolveParameterFilter would treat as unset anyway but which would
      // persist a meaningless key into the saved dashboard.
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') return onChange(undefined)
        onChange(param.type === 'number' ? Number(raw) : raw)
      }}
      placeholder={t('builder.dashboard.parameters.no_default')}
      className="h-8 text-sm"
    />
  )
}

function BindingsEditor({ param, targets }: { param: DashboardParameter; targets: BindableWidget[] }) {
  const t = useTranslation()
  const schema = useDashboardStore((s) => s.schema)
  const addBinding = useDashboardStore((s) => s.addBinding)
  const updateBinding = useDashboardStore((s) => s.updateBinding)
  const removeBinding = useDashboardStore((s) => s.removeBinding)

  const all = schema.parameterBindings ?? []
  // Indices into the FLAT list, because that is what the store's update and
  // remove actions address — mirroring the report bindings editor, whose
  // bindings are likewise one flat array shared by every argument.
  const mine = all.map((b, index) => ({ b, index })).filter(({ b }) => b.parameterKey === param.key)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard.parameters.bindings_label')}</Label>
        <Button
          type="button" variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]"
          disabled={targets.length === 0}
          onClick={() => addBinding({ parameterKey: param.key, widgetId: targets[0].id, field: '', op: operatorsFor(param.type)[0] })}
        >
          <Plus size={11} /> {t('common.add')}
        </Button>
      </div>

      {mine.length === 0 ? (
        <p className="text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">{t('builder.dashboard.parameters.bindings_empty')}</p>
      ) : (
        mine.map(({ b, index }) => (
          <BindingRow
            key={index}
            binding={b}
            param={param}
            targets={targets}
            onChange={(patch) => updateBinding(index, patch)}
            onRemove={() => removeBinding(index)}
          />
        ))
      )}
    </div>
  )
}

function BindingRow({ binding, param, targets, onChange, onRemove }: {
  binding: ParameterBinding
  param: DashboardParameter
  targets: BindableWidget[]
  onChange: (patch: Partial<ParameterBinding>) => void
  onRemove: () => void
}) {
  const t = useTranslation()
  const target = targets.find((x) => x.id === binding.widgetId)
  // The field list comes from the WIDGET's own form, not the dashboard's —
  // which is the whole reason the binding carries widgetId and why the
  // envelope schema deliberately does not mark `field` as a fieldRef.
  const { data: form } = useForm(target?.formId ?? '')
  const fields = form?.fields ?? []
  const ops = operatorsFor(param.type)

  return (
    <div className="space-y-1.5 rounded-md border border-[hsl(var(--border))] p-2">
      <div className="flex items-center gap-1.5">
        <SelectMenu
          value={binding.widgetId}
          // Switching tiles clears the field: a field name from the old
          // tile's form almost never exists on the new one, and a binding
          // pointing at a field that isn't there narrows nothing silently.
          onValueChange={(widgetId) => onChange({ widgetId, field: '' })}
        >
          <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder={t('builder.dashboard.parameters.tile_placeholder')} /></SelectTrigger>
          <SelectContent>
            {targets.map((x) => <SelectItem key={x.id} value={x.id} className="text-xs">{x.label}</SelectItem>)}
          </SelectContent>
        </SelectMenu>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('builder.dashboard.parameters.delete_binding')}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
        >
          <Trash2 size={11} />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <SelectMenu value={binding.field} onValueChange={(field) => onChange({ field })}>
          <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder={t('builder.dashboard.parameters.field_placeholder')} /></SelectTrigger>
          <SelectContent>
            {fields.map((f) => <SelectItem key={f.name} value={f.name} className="text-xs">{f.label || f.name}</SelectItem>)}
            {fields.length === 0 && (
              <SelectItem value="__none__" disabled className="text-xs">{t('builder.dashboard.parameters.no_fields')}</SelectItem>
            )}
          </SelectContent>
        </SelectMenu>
        <SelectMenu value={coerceOperator(binding.op, param.type)} onValueChange={(op) => onChange({ op })}>
          <SelectTrigger className="h-7 w-20 shrink-0 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ops.map((op) => <SelectItem key={op} value={op} className="text-xs">{opLabel(op, t)}</SelectItem>)}
          </SelectContent>
        </SelectMenu>
      </div>

      {!binding.field && (
        <p className="text-[10px] leading-4 text-[hsl(var(--destructive))]">{t('builder.dashboard.parameters.field_required')}</p>
      )}
    </div>
  )
}

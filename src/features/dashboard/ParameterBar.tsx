// The viewer-facing control strip for a dashboard's parameters: set once,
// narrows every bound tile. Rendered by DashboardMenuRuntime and deliberately
// NOT by RuntimeGrid — the grid also renders a record's 'custom' detail tab,
// where a parameter bar would be a surprise nobody asked for.
//
// Values live in the caller's state and are never written back into the
// dashboard, exactly like the chart toolbar's own live overrides: a viewer
// narrowing their own view must not re-author the tile for everyone.
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-time-picker'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { activeParameterKeys, effectiveValue, type ParameterValues } from './parameters'
import type { DashboardParameter } from './schema'

interface ParameterBarProps {
  parameters: DashboardParameter[]
  values: ParameterValues
  onChange: (values: ParameterValues) => void
}

export function ParameterBar({ parameters, values, onChange }: ParameterBarProps) {
  const t = useTranslation()
  if (parameters.length === 0) return null

  const set = (key: string, value: unknown) => onChange({ ...values, [key]: value })
  const active = activeParameterKeys(parameters, values)

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-3">
      {parameters.map((param) => (
        <label key={param.key} className="flex min-w-[10rem] flex-col gap-1">
          <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{param.label}</span>
          <ParameterInput
            param={param}
            value={effectiveValue(param, values)}
            onChange={(v) => set(param.key, v)}
          />
        </label>
      ))}

      {active.length > 0 && (
        <button
          type="button"
          // Clears to unset rather than to each parameter's default: a
          // default is the starting point, and a viewer who clears is asking
          // to stop narrowing, not to go back to the author's narrowing.
          onClick={() => onChange(Object.fromEntries(parameters.map((p) => [p.key, ''])))}
          className="h-8 rounded-md px-2 text-[11px] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
        >
          {t('runtime.dashboard.parameters.clear')}
        </button>
      )}
    </div>
  )
}

function ParameterInput({ param, value, onChange }: {
  param: DashboardParameter
  value: unknown
  onChange: (value: unknown) => void
}) {
  const t = useTranslation()
  const asString = value == null ? '' : String(value)

  if (param.type === 'date') {
    return <DatePicker value={asString} onChange={onChange} size="sm" className="h-8" />
  }

  if (param.type === 'boolean') {
    return (
      <SelectMenu value={asString} onValueChange={(v) => onChange(v === '' ? '' : v === 'true')}>
        <SelectTrigger className="h-8 text-[12px]">
          <SelectValue placeholder={t('runtime.dashboard.parameters.any')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">{t('common.yes')}</SelectItem>
          <SelectItem value="false">{t('common.no')}</SelectItem>
        </SelectContent>
      </SelectMenu>
    )
  }

  return (
    <Input
      type={param.type === 'number' ? 'number' : 'text'}
      value={asString}
      // An empty input is UNSET, not the number zero or the empty string as
      // a value to match — see isUnset in parameters.ts.
      onChange={(e) => onChange(e.target.value === '' ? '' : param.type === 'number' ? Number(e.target.value) : e.target.value)}
      placeholder={t('runtime.dashboard.parameters.any')}
      className="h-8 text-[12px]"
    />
  )
}

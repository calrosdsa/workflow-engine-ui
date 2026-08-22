// Config surface for the update_field custom action type (FR-D2-017) — a
// target-field picker restricted to isFieldSingleWritable's same eligibility
// set the record-detail view's own per-field inline editing already uses,
// plus a static-value/expression-value toggle. Mirrors detail-tabs'
// related_form ConfigPanel's own "restrict the picker to only legal
// choices" precedent, rather than letting an admin pick an illegal target
// and fail later at click time.
import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { FieldInput } from '@/features/forms/runtime/FieldRenderer'
import { isFieldSingleWritable } from '@/features/forms/runtime/schema-to-zod'
import { schemaToVariableDecls } from '@/features/forms/runtime/expression-context'
import { iterElements } from '@/features/form-builder/projection'
import type { CustomActionConfigPanelProps } from '../contract'
import type { UpdateFieldActionConfig } from './schema'
import type { FormElement } from '@/features/form-builder/schema'

export function UpdateFieldConfigPanel({ config, onChange, schema }: CustomActionConfigPanelProps<UpdateFieldActionConfig>) {
  const writableFields = useMemo<FormElement[]>(() => {
    if (!schema) return []
    return Array.from(iterElements(schema)).filter(isFieldSingleWritable)
  }, [schema])

  const targetField = writableFields.find((f) => f.key === config.fieldKey)
  const variables = useMemo(() => (schema ? schemaToVariableDecls(schema) : []), [schema])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Field to update</Label>
        <SelectMenu
          value={config.fieldKey}
          onValueChange={(fieldKey) => onChange({ ...config, fieldKey, staticValue: '' })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose a field…" /></SelectTrigger>
          <SelectContent>
            {writableFields.length === 0 ? (
              <div className="px-2 py-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">No eligible fields on this form.</div>
            ) : (
              writableFields.map((f) => (
                <SelectItem key={f.id} value={f.key} className="text-xs">{f.label || f.key}</SelectItem>
              ))
            )}
          </SelectContent>
        </SelectMenu>
      </div>

      {targetField && (
        <>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
            <Checkbox
              checked={config.valueMode === 'expression'}
              onCheckedChange={(v) =>
                onChange(v ? { ...config, valueMode: 'expression', expressionValue: config.expressionValue ?? '' } : { ...config, valueMode: 'static' })
              }
            />
            <Label className="cursor-pointer text-[12px] font-normal text-[hsl(var(--muted-foreground))]">Compute the value with an expression</Label>
          </label>

          {config.valueMode === 'expression' ? (
            <ExpressionField
              value={config.expressionValue ?? ''}
              onChange={(v) => onChange({ ...config, expressionValue: v })}
              variables={variables}
              placeholder='Vars["stage"]'
              label="new value"
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Value to set</Label>
              <FieldInput
                el={targetField}
                field={{
                  value: config.staticValue,
                  onChange: (v) => onChange({ ...config, staticValue: v }),
                  onBlur: () => {},
                }}
                disabled={false}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

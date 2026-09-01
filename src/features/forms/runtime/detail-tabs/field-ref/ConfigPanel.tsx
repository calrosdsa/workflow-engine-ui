// Form Builder-side config UI for the field_ref tab type — a single picker
// listing THIS form's own data-bearing fields (same source list/filter
// DetailsTab already uses for its own read-only rendering), so an admin
// can point a sidebar/zone entry at an existing field without leaving the
// Detail Page config surface.
import { useMemo } from 'react'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { Field } from '@/features/form-builder/config/ConfigPanel'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { pickableFields } from './pickable-fields'
import type { DetailTabConfigPanelProps } from '../contract'
import type { FieldRefTabConfig } from './schema'

export function FieldRefConfigPanel({ config, onChange, formId }: DetailTabConfigPanelProps<FieldRefTabConfig>) {
  const { data: form } = useFormDef(formId)
  const schema = useMemo(() => (form ? resolveFormSchema(form) : null), [form])
  const options = useMemo(() => pickableFields(schema), [schema])

  return (
    <Field label="Field" hint="Which of this form's own fields to display here.">
      <SelectMenu value={config.fieldKey || undefined} onValueChange={(v) => onChange({ fieldKey: v })}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select a field…" /></SelectTrigger>
        <SelectContent>
          {options.map((el) => (
            <SelectItem key={el.key} value={el.key} className="text-xs">{el.label}</SelectItem>
          ))}
        </SelectContent>
      </SelectMenu>
    </Field>
  )
}

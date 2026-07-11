// Picks which field of a referenced form should be shown/searched for a
// Form Reference field, instead of the runtime's name/label/id fallback
// heuristic. A plain dropdown (not a Popover+Command combobox like
// FormReferenceSelect) since the option list is small and already in memory
// — no server-side search needed.
import { useMemo } from 'react'
import {
  SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select-menu'
import { useForm as useFormDef } from '@/features/forms/hooks'
import type { FieldType } from '@/features/forms/types'

// Field types that stringify into something meaningful as a display label.
const DISPLAYABLE_TYPES: FieldType[] = ['string', 'text', 'email', 'phone', 'integer', 'decimal', 'enum']

// Sentinel for "no field configured — use the name/label/id fallback".
// Radix Select disallows an empty-string item value, so this is mapped to/from
// `undefined` at the component boundary.
const AUTO = '__auto__'

interface DisplayFieldSelectProps {
  /** The referenced form's id (element.formRef). */
  formId?: string
  /** The currently configured display field name (element.displayField). */
  value?: string
  /** Emits the selected field name, or undefined to reset to Auto. */
  onChange: (fieldName: string | undefined) => void
}

export function DisplayFieldSelect({ formId, value, onChange }: DisplayFieldSelectProps) {
  const { data: targetForm, isLoading } = useFormDef(formId ?? '')

  const options = useMemo(
    () => (targetForm?.fields ?? []).filter((f) => DISPLAYABLE_TYPES.includes(f.type)),
    [targetForm],
  )

  if (!formId) {
    return (
      <SelectMenu disabled>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select a referenced form first" /></SelectTrigger>
        <SelectContent />
      </SelectMenu>
    )
  }

  if (!isLoading && options.length === 0) {
    return (
      <SelectMenu disabled>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="No suitable fields on this form" /></SelectTrigger>
        <SelectContent />
      </SelectMenu>
    )
  }

  return (
    <SelectMenu
      value={value ?? AUTO}
      onValueChange={(v) => onChange(v === AUTO ? undefined : v)}
      disabled={isLoading}
    >
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder={isLoading ? 'Loading fields…' : 'Select a field'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={AUTO} className="text-xs">Auto (name/label/id)</SelectItem>
        {options.map((f) => (
          <SelectItem key={f.name} value={f.name} className="text-xs">{f.label || f.name}</SelectItem>
        ))}
      </SelectContent>
    </SelectMenu>
  )
}

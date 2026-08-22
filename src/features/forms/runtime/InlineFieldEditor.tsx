// Per-field click-to-edit wrapper for the record detail view (Jira-style:
// click a single field's value, edit just that field, save/cancel it alone
// via a partial PATCH) — replaces the old "click a pencil, the whole
// Details tab swaps into one big FormRenderer form" behavior.
//
// Renders FieldValueDisplay (read state) by default; ELIGIBLE fields get a
// click-to-edit affordance that swaps to FieldInput (the same per-field
// input control FormRenderer itself uses, exported from FieldRenderer.tsx
// for this purpose) with local state, saved independently via
// useUpdateRecord with a genuinely single-key payload — safe against the
// Line Items row-deletion bug now that api/forms/line_items.go's
// applyLineItems correctly skips a child whose slug is absent from the
// payload, rather than treating that as "desired rows: none."
//
// Eligibility is intentionally conservative — see isFieldEligible below.
import { useState } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { FieldValueDisplay } from './FieldValueDisplay'
import { FieldInput } from './FieldRenderer'
import { fieldSchema } from './schema-to-zod'
import { useUpdateRecord } from '@/features/forms/hooks'
import { usePermission } from '@/features/auth/permissions'
import type { FormElement } from '@/features/form-builder/schema'
import type { FormRecord } from '@/features/forms/types'

/** Component types with a simple, self-contained FieldInput control that
 *  makes sense rendered in place, standalone, outside a whole-form context.
 *  Deliberately excludes: 'form' (needs ReferenceFieldAutocomplete's own
 *  search popover — a real inline-editing candidate, but separate,
 *  follow-up scope), 'line_items' (a whole grid, never was pencil-editable
 *  even in the old whole-form flow), 'line_item_count' (virtual/computed,
 *  never a real input), 'file'/'image' (currently a URL-text-field stub
 *  with no real upload backend — inline-editing a stub would be
 *  misleading), and every presentational type (no value to edit). */
const INLINE_EDITABLE_TYPES = new Set<FormElement['component']>([
  'text', 'textarea', 'richtext', 'number', 'email', 'url', 'password', 'phone',
  'date', 'time', 'datetime',
  'checkbox', 'switch', 'radio', 'select', 'multiselect', 'role', 'autocomplete',
])

function isFieldEligible(el: FormElement, canEdit: boolean): boolean {
  if (!canEdit) return false
  if (!INLINE_EDITABLE_TYPES.has(el.component)) return false
  if (el.behavior.readOnly === 'always') return false
  if (el.behavior.visibility === 'hidden') return false
  // Expression-mode readOnly/visibility would need the same
  // useExpressionRuntimeState round-trip FormRenderer runs for the whole
  // form (values/variables shape built across every sibling field) —
  // deliberately out of scope for a single isolated field this pass.
  // Excluding rather than guessing keeps this safe: a field that SHOULD be
  // blocked by an expression never gets an edit affordance, it just stays
  // plain read-only, same as it would if the expression were unevaluated.
  if (el.behavior.readOnly === 'expression') return false
  if (el.behavior.visibility === 'expression') return false
  return true
}

export function InlineFieldEditor({ el, record, formId, recordId }: {
  el: FormElement
  record: FormRecord
  formId: string
  recordId: string
}) {
  const canEdit = usePermission(`forms:${formId}:edit`)
  const eligible = isFieldEligible(el, canEdit)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<unknown>(record[el.key])
  const [error, setError] = useState<string | null>(null)
  const updateRecord = useUpdateRecord(formId)

  if (!eligible) {
    return <FieldValueDisplay el={el} record={record} formId={formId} />
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setValue(record[el.key]); setError(null); setEditing(true) }}
        className="group/field flex w-full items-start gap-1.5 rounded px-1 py-0.5 -mx-1 -my-0.5 text-left transition-colors hover:bg-[hsl(var(--accent))]"
      >
        <span className="min-w-0 flex-1">
          <FieldValueDisplay el={el} record={record} formId={formId} />
        </span>
        <Pencil size={11} className="mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity group-hover/field:opacity-100" />
      </button>
    )
  }

  const cancel = () => { setEditing(false); setError(null) }

  const save = async () => {
    const result = fieldSchema(el).safeParse(value)
    if (!result.success) {
      setError(result.error.issues[0]?.message || 'Invalid value')
      return
    }
    setError(null)
    try {
      await updateRecord.mutateAsync({ recordId, data: { [el.key]: result.data } })
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <FieldInput
            el={el}
            field={{
              value,
              onChange: setValue,
              onBlur: () => {},
            }}
            formId={formId}
            disabled={updateRecord.isPending}
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={updateRecord.isPending}
          title="Save"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check size={15} />
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={updateRecord.isPending}
          title="Cancel"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={15} />
        </button>
      </div>
      {error && <p className="text-[11px] text-[hsl(var(--destructive))]">{error}</p>}
    </div>
  )
}

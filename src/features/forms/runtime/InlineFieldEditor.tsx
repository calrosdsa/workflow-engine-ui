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
//
// Edit-mode is CONTROLLED by the parent (DetailsTab) via isEditing/
// onStartEdit/onStopEdit rather than local state, so DetailsTab can enforce
// "only one field editing at a time" across the whole record — see its own
// editingFieldId comment for why that's lifted instead of living here.
import { useState } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { FieldValueDisplay } from './FieldValueDisplay'
import { FieldInput } from './FieldRenderer'
import { fieldSchema, isFieldSingleWritable } from './schema-to-zod'
import { useUpdateRecord } from '@/features/forms/hooks'
import { usePermission } from '@/features/auth/permissions'
import type { FormElement } from '@/features/form-builder/schema'
import type { FormRecord } from '@/features/forms/types'

/** The RUNTIME half of eligibility — isFieldSingleWritable's static checks
 *  (component type, readOnly/visibility mode) plus the one thing only a
 *  live viewer session can answer: does THIS viewer hold edit permission.
 *  Shared with FR-D2-017's update_field custom action via
 *  isFieldSingleWritable, not duplicated — that action type reuses the same
 *  static half, evaluated at Form Builder config time where no "current
 *  viewer" exists to check canEdit against. */
function isFieldEligible(el: FormElement, canEdit: boolean): boolean {
  if (!canEdit) return false
  return isFieldSingleWritable(el)
}

/** Order-sensitive deep-ish equality via JSON — correct for every value
 *  shape a FieldInput actually produces (scalars, and multiselect's string
 *  arrays), and simpler than a bespoke comparator for those same shapes. A
 *  reordered multiselect counts as "changed", which is the conservative,
 *  correct call (it IS a different array, even if same members). */
function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export function InlineFieldEditor({ el, record, formId, recordId, isEditing, anyFieldEditing, onStartEdit, onStopEdit }: {
  el: FormElement
  record: FormRecord
  formId: string
  recordId: string
  /** Whether THIS field is the one currently open for editing — controlled
   *  by DetailsTab so at most one field across the record is ever true. */
  isEditing: boolean
  /** Whether SOME field (any field, including this one) is currently being
   *  edited. When true and isEditing is false, this field's own
   *  click-to-edit affordance is disabled — otherwise clicking it would
   *  just silently steal edit focus from whichever field is actually open,
   *  instead of requiring that field's changes to be saved or cancelled
   *  first, which is the whole point of enforcing one-at-a-time. */
  anyFieldEditing: boolean
  onStartEdit: () => void
  onStopEdit: () => void
}) {
  const canEdit = usePermission(`forms:${formId}:edit`)
  const eligible = isFieldEligible(el, canEdit)
  const [value, setValue] = useState<unknown>(record[el.key])
  const [error, setError] = useState<string | null>(null)
  const updateRecord = useUpdateRecord(formId)

  if (!eligible) {
    return <FieldValueDisplay el={el} record={record} formId={formId} />
  }

  if (!isEditing) {
    const locked = anyFieldEditing
    return (
      <button
        type="button"
        disabled={locked}
        title={locked ? 'Finish editing the other field first' : undefined}
        onClick={() => { setValue(record[el.key]); setError(null); onStartEdit() }}
        className="group/field flex w-full items-start gap-1.5 rounded px-1 py-0.5 -mx-1 -my-0.5 text-left transition-colors hover:bg-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      >
        <span className="min-w-0 flex-1">
          <FieldValueDisplay el={el} record={record} formId={formId} />
        </span>
        {!locked && (
          <Pencil size={11} className="mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity group-hover/field:opacity-100" />
        )}
      </button>
    )
  }

  const cancel = () => { onStopEdit(); setError(null) }

  const save = async () => {
    const result = fieldSchema(el).safeParse(value)
    if (!result.success) {
      setError(result.error.issues[0]?.message || 'Invalid value')
      return
    }
    setError(null)
    if (valuesEqual(result.data, record[el.key])) {
      toast.info('No changes to save', { description: `${el.label} is unchanged.` })
      onStopEdit()
      return
    }
    try {
      await updateRecord.mutateAsync({ recordId, data: { [el.key]: result.data } })
      toast.success('Saved', { description: `${el.label} was updated.` })
      onStopEdit()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save'
      setError(message)
      toast.error('Save failed', { description: message })
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

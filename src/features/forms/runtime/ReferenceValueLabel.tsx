// Read-only label for a single reference-field value: fetches the target
// record and resolves a human-readable label via resolveReferenceLabel
// (displayField, then the target form's record-title fields, then the
// legacy name/label/id heuristic) instead of showing the raw id. Shared by
// every place a reference field's value is displayed but not edited —
// RecordDetailPanel's Details tab, the Linked Records tab, DataTable
// reference columns, and LineItemsGrid's read-only summary cells. The
// editable widgets (ReferenceFieldAutocomplete, LineItemsGrid's
// ReferenceFieldInput) resolve their own label inline since they already
// fetch the target form/record for search — see resolveReferenceLabel's doc
// comment for why both paths share that same priority logic.
import { useQuery } from '@tanstack/react-query'
import { formsApi } from '@/features/forms/api'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { resolveReferenceLabel } from './record-title'

interface ReferenceValueLabelProps {
  /** The referenced form's id (element.formRef / FieldDef.reference_table). */
  formId?: string
  /** The stored reference value — the referenced record's id. */
  recordId?: unknown
  /** Explicit display field, when configured (element.displayField). */
  displayField?: string
}

export function ReferenceValueLabel({ formId, recordId, displayField }: ReferenceValueLabelProps) {
  const id = typeof recordId === 'string' ? recordId : undefined
  const { data: targetForm } = useFormDef(formId ?? '')
  const { data: record, isLoading } = useQuery({
    queryKey: ['forms', formId, 'records', id],
    queryFn: () => formsApi.getRecord(formId!, id!),
    enabled: !!formId && !!id,
  })

  if (!id) return <>—</>
  if (isLoading) return <span className="text-[hsl(var(--muted-foreground))]">…</span>
  if (!record) return <>{id}</>

  return <>{resolveReferenceLabel(targetForm?.fields, record, displayField) || id}</>
}

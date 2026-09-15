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
import { PREVIEW_REFERENCE_SENTINEL } from './preview-sentinel'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface ReferenceValueLabelProps {
  /** The referenced form's id (element.formRef / FieldDef.reference_table). */
  formId?: string
  /** The stored reference value — the referenced record's id. */
  recordId?: unknown
  /** Explicit display field, when configured (element.displayField). */
  displayField?: string
}

export function ReferenceValueLabel({ formId, recordId, displayField }: ReferenceValueLabelProps) {
  const t = useTranslation()
  const id = typeof recordId === 'string' ? recordId : undefined
  // Detail Page Builder preview mode fabricates this exact sentinel for
  // every reference field (sample-data.ts) since it can't safely fake a
  // real linked-record id — short-circuit before any query so preview
  // never fetches, 404s, or (worse) collides with an unrelated real
  // record that happens to share the sentinel string.
  const isPreviewSample = id === PREVIEW_REFERENCE_SENTINEL
  const { data: targetForm } = useFormDef(!isPreviewSample ? (formId ?? '') : '')
  const { data: record, isLoading } = useQuery({
    queryKey: ['forms', formId, 'records', id],
    queryFn: () => formsApi.getRecord(formId!, id!),
    enabled: !isPreviewSample && !!formId && !!id,
  })

  if (isPreviewSample) return <span className="text-[hsl(var(--muted-foreground))]">{t('reference_value_label.sample_reference')}</span>
  if (!id) return <>—</>
  if (isLoading) return <span className="text-[hsl(var(--muted-foreground))]">…</span>
  if (!record) return <>{id}</>

  return <>{resolveReferenceLabel(targetForm?.fields, record, displayField) || id}</>
}

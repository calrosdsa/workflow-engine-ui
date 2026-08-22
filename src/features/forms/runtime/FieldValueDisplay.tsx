// Read-only value display for one FormElement, given a record. Extracted
// from DetailsTab's own per-element rendering (RecordDetailPanel.tsx) so
// the Detail Page Builder's field_ref sidebar mirror (detail-tabs/field-ref/)
// can render an existing field's live value identically, without
// duplicating the reference/line-items/plain-value branching logic.
import { LineItemsGrid } from './LineItemsGrid'
import { ReferenceValueLabel } from './ReferenceValueLabel'
import { formatValue } from './format-value'
import type { FormElement } from '@/features/form-builder/schema'
import type { FormRecord } from '@/features/forms/types'

export function FieldValueDisplay({ el, record, formId }: {
  el: FormElement
  record: FormRecord
  formId: string
}) {
  if (el.component === 'line_items') {
    return <LineItemsGrid el={el} field={{ value: record[el.key], onChange: () => {} }} parentFormId={formId} disabled />
  }
  if (el.component === 'form') {
    return (
      <div style={{ color: 'hsl(var(--foreground))' }}>
        <ReferenceValueLabel formId={el.formRef} recordId={record[el.key]} displayField={el.displayField} />
      </div>
    )
  }
  return <div style={{ color: 'hsl(var(--foreground))' }}>{formatValue(record[el.key])}</div>
}

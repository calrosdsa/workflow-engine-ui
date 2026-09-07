// Read-only value display for one FormElement, given a record. Extracted
// from DetailsTab's own per-element rendering (RecordDetailPanel.tsx) so
// the Detail Page Builder's field_ref sidebar mirror (detail-tabs/field-ref/)
// can render an existing field's live value identically, without
// duplicating the reference/line-items/plain-value branching logic.
import { LineItemsGrid } from './LineItemsGrid'
import { ReferenceValueLabel } from './ReferenceValueLabel'
import { FileFieldInput } from './FileFieldInput'
import { formatFieldValue } from './format-value'
import { resolveOptionLabel } from './enum-labels'
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
  // 'file'/'image' (File Upload / Image Upload, FR-C1-012) store a
  // {content_id, filename, content_type, size_bytes} object, not a plain
  // scalar — formatValue's generic typeof-object branch fell back to
  // JSON.stringify, showing the raw JSON blob as text instead of the
  // thumbnail/file-chip preview FileFieldInput already knows how to render.
  // Reused here in disabled mode (Replace/Remove/upload controls hidden per
  // its own `disabled` prop, deliberately: 'file'/'image' are excluded from
  // SINGLE_FIELD_WRITABLE_TYPES, so this is a display-only context, never an
  // inline-edit one) rather than duplicating its presigned-URL resolution.
  if (el.component === 'file' || el.component === 'image') {
    return (
      <FileFieldInput
        el={el}
        isImage={el.component === 'image'}
        formId={formId}
        field={{ value: record[el.key], onChange: () => {} }}
        disabled
      />
    )
  }
  // 'select'/'radio' (FieldType 'enum') store the OPTION VALUE ("open"), not
  // its label ("Open") — RecordsTable/CardLayout/KanbanLayout already
  // special-case this via resolveEnumLabel (keyed off a schema-wide
  // enumLabels map built by buildEnumLabels); this was the remaining
  // read-only surface with the same el.component/field-type branch chain
  // that fell through to the generic formatter instead, showing the raw
  // stored value ("open") rather than the label ("Open") on the Detail Page.
  // resolveOptionLabel is the single-element counterpart — el.options is
  // already in hand here, so no schema-wide map needs to be threaded in.
  if (el.component === 'select' || el.component === 'radio') {
    return <div style={{ color: 'hsl(var(--foreground))' }}>{resolveOptionLabel(el.options, record[el.key])}</div>
  }
  // formatFieldValue, not formatValue: a 'date'/'time'/'datetime' component's
  // value is an RFC3339 string and rendered raw here for the same reason it
  // was in RecordsTable — the generic formatter has no field type to key off.
  // el.component carries the same 'date'/'time'/'datetime' names FieldType
  // uses, so it can be passed straight through. el.numberFormat is the
  // builder-schema counterpart of FieldDef.number_format (the other three
  // call sites pass the FieldDef's own copy) — this is the one surface with
  // only the FormElement in hand, not the backend field.
  return <div style={{ color: 'hsl(var(--foreground))' }}>{formatFieldValue(record[el.key], el.component, el.numberFormat)}</div>
}

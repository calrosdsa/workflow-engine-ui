// The three built-in tab types (FR-D2-015) — structural extractions of
// RecordDetailPanel.tsx's own DetailsTab/AuditLogTab/LinkedRecordsTab
// functions, zero logic change. Together with defaultDetailTabs() (registry.ts),
// this is the mechanism that guarantees a form with no configured
// detailTabs (every form as of this writing) renders byte-for-byte
// identically to pre-FR-D2-015 behavior.
import { FileText, History, Link2 } from 'lucide-react'
import { registerDetailTab } from '../registry'
import { DetailsTab, AuditLogTab, LinkedRecordsTab } from '../../RecordDetailPanel'
import type { DetailTabRendererProps } from '../contract'

registerDetailTab({
  type: 'details',
  label: 'Details',
  icon: FileText,
  description: "The record's own fields, laid out per the form's section/column design.",
  builtin: true,
  parseConfig: () => ({}),
  createDefaultConfig: () => ({}),
  Renderer: (props: DetailTabRendererProps<unknown>) => (
    <DetailsTab
      formId={props.formId}
      recordId={props.recordId}
      fields={props.fields}
      schema={props.schema}
      editing={!!props.editing}
      onStartEdit={props.onStartEdit ?? (() => {})}
      onSubmit={props.onSubmitEdit ?? (() => {})}
      onCancelEdit={props.onCancelEdit ?? (() => {})}
      submitting={!!props.submittingEdit}
    />
  ),
})

registerDetailTab({
  type: 'audit',
  label: 'Audit Log',
  icon: History,
  description: "This record's create/update history.",
  builtin: true,
  parseConfig: () => ({}),
  createDefaultConfig: () => ({}),
  Renderer: (props: DetailTabRendererProps<unknown>) => (
    <AuditLogTab formId={props.formId} recordId={props.recordId} fields={props.fields} schema={props.schema} />
  ),
})

registerDetailTab({
  type: 'linked',
  label: 'Linked Records',
  icon: Link2,
  description: 'Every record, on every other form, that references this one — auto-discovered.',
  builtin: true,
  parseConfig: () => ({}),
  createDefaultConfig: () => ({}),
  Renderer: (props: DetailTabRendererProps<unknown>) => (
    <LinkedRecordsTab formId={props.formId} recordId={props.recordId} onNavigateToRecord={props.onNavigateToRecord} />
  ),
})

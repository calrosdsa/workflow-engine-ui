// Renders a compact, read-only mirror of one existing field's live value —
// the Detail Page Builder's answer to "put a field directly in the sidebar"
// (Jira-style) without duplicating field ownership: the field itself still
// lives only in the Form Builder's own schema.sections tree, this just
// displays it a second time. No edit affordance here on purpose — editing
// stays on the main Details tab's existing pencil-icon flow, so there's only
// ever one edit/validation path for a given field.
import { useRecordDetail } from '../../record-detail-hooks'
import { FieldValueDisplay } from '../../FieldValueDisplay'
import type { DetailTabRendererProps } from '../contract'
import type { FieldRefTabConfig } from './schema'
import type { FormElement } from '@/features/form-builder/schema'

function findElementByKey(schema: DetailTabRendererProps<FieldRefTabConfig>['schema'], key: string): FormElement | null {
  if (!schema) return null
  for (const section of schema.sections) {
    for (const column of section.columns) {
      const found = column.elements.find((el) => el.key === key)
      if (found) return found
    }
  }
  return null
}

export function FieldRefRenderer({ formId, recordId, schema, config }: DetailTabRendererProps<FieldRefTabConfig>) {
  const { data: record } = useRecordDetail(formId, recordId)
  const el = config.fieldKey ? findElementByKey(schema, config.fieldKey) : null

  if (!config.fieldKey) {
    return <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>No field selected.</p>
  }
  // Stale reference — the field was renamed/deleted on the Form Builder
  // canvas since this mirror was created. Degrade gracefully (same
  // defensive posture ReferenceValueLabel already has for a broken form
  // reference) rather than crash.
  if (!el) {
    return <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Field no longer exists.</p>
  }
  if (!record) {
    return <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading…</p>
  }

  return (
    <div className="text-sm">
      <div className="mb-1 text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>{el.label}</div>
      <FieldValueDisplay el={el} record={record} formId={formId} />
    </div>
  )
}

// RF-402's data-mapping step, scoped to FORM mapping only (see this
// session's own scoping note in the print-fidelity plan doc for why field-
// level mapping is deferred: no stable identifier on a served
// ReportExample to key a per-template field manifest against, and no
// existing UI pattern in this codebase for "disable this one incompatible
// option with an explanation" to build it on).
//
// A worked example (examples.go) is written for an AI authoring agent to
// adapt by hand — every FormID it carries is a literal placeholder like
// "your-invoice-lines-form-id", and every example's own Note ends
// "Substitute your own form id and field names." This module is that
// substitution, done once per distinct placeholder rather than once per
// reference, and via a GENERIC walk rather than per-block-type parsing:
// every FormID field on the Go side (ReportDataSource, TableBlockConfig,
// GroupBlockConfig) already serializes to the same "form_id" JSON key
// (confirmed directly against block_table.go/block_group.go/definition.go),
// so this stays correct for a future block type without any change here.
import type { ReportDefinition } from './types'

export interface FormPlaceholder {
  /** The literal form_id placeholder value found in the definition, e.g.
   *  "your-invoice-lines-form-id". */
  value: string
  /** Human-readable references to it — a block's own name, its type as a
   *  fallback, or a data source's name/id — for the mapping UI's labels.
   *  Deduplicated, in first-seen order. */
  usedBy: string[]
}

function collectFormID(node: unknown, onFound: (value: string) => void): void {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach((item) => collectFormID(item, onFound))
    return
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'form_id' && typeof value === 'string' && value) {
      onFound(value)
    } else {
      collectFormID(value, onFound)
    }
  }
}

/** Every distinct form_id placeholder in definition, paired with what
 *  references it. Empty for a template with no data source (e.g. Blank,
 *  or a static-only report) — the mapping step is skipped entirely then. */
export function findFormPlaceholders(definition: ReportDefinition): FormPlaceholder[] {
  const usedByValue = new Map<string, string[]>()
  const note = (value: string, label: string) => {
    const labels = usedByValue.get(value) ?? []
    if (!labels.includes(label)) labels.push(label)
    usedByValue.set(value, labels)
  }

  ;(definition.data_sources ?? []).forEach((source) => {
    if (source.form_id) note(source.form_id, source.name || source.id)
  })
  definition.blocks.forEach((block, index) => {
    collectFormID(block.config, (value) => note(value, block.name || `${block.type} ${index + 1}`))
  })

  return [...usedByValue.entries()].map(([value, usedBy]) => ({ value, usedBy }))
}

function rewriteFormID(node: unknown, mapping: Record<string, string>): void {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach((item) => rewriteFormID(item, mapping))
    return
  }
  const obj = node as Record<string, unknown>
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'form_id' && typeof value === 'string' && value in mapping) {
      obj[key] = mapping[value]
    } else {
      rewriteFormID(value, mapping)
    }
  }
}

/** Replaces every occurrence of each mapped placeholder's value at a
 *  form_id key with the real form id the author picked for it. Returns a
 *  deep copy — definition itself is never mutated, so the cached
 *  ReportExample from useReportExamples() stays reusable for a second
 *  report created from the same template. A placeholder with no entry in
 *  mapping is left as-is (defensive; the wizard's own "Create" gating
 *  already requires every placeholder mapped before this runs). */
export function applyFormMapping(definition: ReportDefinition, mapping: Record<string, string>): ReportDefinition {
  const clone = structuredClone(definition)
  ;(clone.data_sources ?? []).forEach((source) => {
    if (source.form_id in mapping) source.form_id = mapping[source.form_id]
  })
  clone.blocks.forEach((block) => rewriteFormID(block.config, mapping))
  return clone
}

import type { FilterGroup, SortRule } from '@/features/workflows/types'
import type { TabVisibilityConfig, TabRenderCondition } from '@/features/form-builder/schema'
import { emptyTabVisibility, emptyTabRenderCondition } from '@/features/form-builder/schema'

export interface RelatedFormTabConfig {
  targetFormId: string
  /** The reference field on targetFormId whose reference_table resolves
   *  back to the owning form — validated the same way FormReferenceSelect's
   *  requireReferenceTo already restricts its own picker (FR-D2-015 §3). */
  targetFieldName: string
  /** Composed with the base relationship link via AND, not a replacement
   *  for it — see related-form/Renderer.tsx. */
  additionalFilter?: FilterGroup
  sort?: SortRule[]
  columns?: string[]
  hideWhenEmpty?: boolean
}

export function emptyRelatedFormConfig(): RelatedFormTabConfig {
  return { targetFormId: '', targetFieldName: '', hideWhenEmpty: false }
}

export function parseRelatedFormConfig(raw: unknown): RelatedFormTabConfig {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<RelatedFormTabConfig>
    if (typeof r.targetFormId === 'string' && typeof r.targetFieldName === 'string') {
      return {
        targetFormId: r.targetFormId,
        targetFieldName: r.targetFieldName,
        additionalFilter: r.additionalFilter,
        sort: Array.isArray(r.sort) ? r.sort : undefined,
        columns: Array.isArray(r.columns) ? r.columns.filter((c): c is string => typeof c === 'string') : undefined,
        hideWhenEmpty: r.hideWhenEmpty === true,
      }
    }
  }
  return emptyRelatedFormConfig()
}

// Re-exported here so related-form/ConfigPanel.tsx has one import site for
// both this type's own config and the shared visibility/renderIf shapes
// every tab config carries — not duplicated logic, just a convenience
// barrel for this one folder.
export type { TabVisibilityConfig, TabRenderCondition }
export { emptyTabVisibility, emptyTabRenderCondition }

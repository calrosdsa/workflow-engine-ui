// Live preview of a form's Detail Page, fed fabricated sample data instead
// of a real saved record — works on a brand-new form with zero records
// (explicit requirement). No dedicated preview mechanism exists anywhere
// else in this codebase to extend (FormPreviewDialog only previews the
// create/edit FORM, never the tabs/detail page) — this is new-build scope.
//
// Mechanism: seed React Query's cache for every record-detail hook
// (useRecordDetail/useAuditLog/useLinkedRecords/useComments) under a
// sentinel recordId that record-detail-hooks.ts's own `enabled` check
// gates out entirely (see preview-sentinel.ts) — so none of those hooks
// ever call their real queryFn, no network request possible — then render
// ZonedDetailTabList completely unmodified. Comments/History/Linked
// Records show real UI chrome around deliberately empty data (accepted
// tradeoff — real content there would need a real record). Related Form
// and Custom tabs get a lightweight placeholder Renderer instead, via
// DetailTabList's own rendererOverride prop — both would otherwise either
// query a different form's real records (related_form) or mount the
// entire live Dashboard widget canvas (custom), neither of which belongs
// inside a sandboxed preview.
//
// Two real, live-reproduced bugs this mechanism had to work around:
//  1. Seeding must happen synchronously DURING RENDER, not in a
//     useEffect — ZonedDetailTabList's children (DetailsTab,
//     LinkedRecordsTab, ...) call their own useRecordDetail/
//     useLinkedRecords etc. on THEIR first render, in the SAME commit as
//     this component's first render; a useEffect runs one commit too
//     late.
//  2. The seed must re-run on EVERY render, not just once (whether
//     ref-guarded or cache-content-guarded) — this component can
//     genuinely unmount while its own overlay stays open (confirmed live:
//     a parent re-render inside the overlay unmounted DetailPagePreview
//     without any accompanying remount, so nothing re-ran the seed and
//     every tab was left reading `record: undefined`, even though the
//     preview had shown correct fabricated data moments earlier). There's
//     no unmount-cleanup effect here for the same reason — with the seed
//     re-asserted every render instead of once, there's nothing for a
//     cleanup to protect against; the sentinel id is specific enough that
//     leaving a stale cache entry around costs nothing.
import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link2, LayoutGrid } from 'lucide-react'
import { ZonedDetailTabList } from '@/features/forms/runtime/detail-tabs/ZonedDetailTabList'
import { resolveDetailTabs } from '@/features/forms/runtime/detail-tabs/registry'
import { PREVIEW_RECORD_ID } from '@/features/forms/runtime/preview-sentinel'
import { fabricateSampleRecord } from './sample-data'
import type { FormSchema } from '@/features/form-builder/schema'
import type { FieldDef } from '@/features/forms/types'
import type { DetailTabRendererProps } from '@/features/forms/runtime/detail-tabs/contract'

function RelatedFormPreviewPlaceholder({ config }: DetailTabRendererProps<{ targetFormId?: string }>) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border))] py-10 text-center">
      <Link2 size={20} className="text-[hsl(var(--muted-foreground))]" />
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        {config.targetFormId ? 'Related records will appear here.' : 'Related records will appear here once a target form is configured.'}
      </p>
      <p className="text-xs text-[hsl(var(--muted-foreground))]/70">Not shown in preview.</p>
    </div>
  )
}

function CustomTabPreviewPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border))] py-10 text-center">
      <LayoutGrid size={20} className="text-[hsl(var(--muted-foreground))]" />
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Custom widgets are not shown in preview.</p>
    </div>
  )
}

function previewRendererOverride(type: string) {
  if (type === 'related_form') return RelatedFormPreviewPlaceholder
  if (type === 'custom') return CustomTabPreviewPlaceholder
  return undefined
}

export function DetailPagePreview({ formId, fields, schema }: {
  formId: string
  fields: FieldDef[]
  schema: FormSchema
}) {
  const qc = useQueryClient()
  const sampleRecord = useMemo(() => fabricateSampleRecord(fields), [fields])

  // Seeded synchronously, EVERY RENDER — before this component returns
  // JSX, so it's guaranteed to have already happened by the time
  // ZonedDetailTabList's children mount and fire their own
  // useRecordDetail/useAuditLog/useLinkedRecords/useComments calls in the
  // same commit. A useEffect here would run one commit too late (see this
  // file's own top comment for the live-reproduced bug). Deliberately NOT
  // guarded by a "have I already seeded" ref/check: this component can
  // genuinely unmount while its overlay stays open (confirmed live — some
  // parent re-render this session unmounts DetailPagePreview without an
  // accompanying remount, wiping any once-only seed for good), so the only
  // reliable approach is re-asserting the cache content on every render
  // rather than trying to seed exactly once. setQueryData is cheap and a
  // same-value write is a no-op for any observer already showing that
  // data, so this costs nothing beyond the redundant call itself.
  qc.setQueryData(['forms', formId, 'records', PREVIEW_RECORD_ID], sampleRecord)
  qc.setQueryData(['forms', formId, 'records', PREVIEW_RECORD_ID, 'audit', 1, 25], { entries: [], total: 0, page: 1, page_size: 25 })
  qc.setQueryData(['forms', formId, 'records', PREVIEW_RECORD_ID, 'linked', 1, 10], { groups: [] })
  qc.setQueryData(['forms', formId, 'records', PREVIEW_RECORD_ID, 'comments', 1, 25], { entries: [], total: 0, page: 1, page_size: 25 })

  return (
    // This preview lives inside the Detail Page Builder's own fixed-height
    // canvas panel — a bounded box needing its own scroll region, the same
    // reasoning as RecordDetailPanel's pageContext="drawer" wrapper (see
    // its own doc comment), now that ZonedDetailTabList/DetailTabList no
    // longer scroll each zone independently.
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <ZonedDetailTabList
        formId={formId}
        recordId={PREVIEW_RECORD_ID}
        fields={fields}
        schema={schema}
        record={sampleRecord}
        tabConfigs={resolveDetailTabs(schema.settings?.detailTabs)}
        layout={schema.settings?.detailLayout ?? 'single'}
        orientation={schema.settings?.tabOrientation ?? 'horizontal'}
        rendererOverride={previewRendererOverride}
      />
    </div>
  )
}

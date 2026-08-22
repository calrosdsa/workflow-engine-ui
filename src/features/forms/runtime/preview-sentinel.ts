// Fixed sentinels the Detail Page Builder's preview (detail-page-builder/
// preview/DetailPagePreview.tsx, sample-data.ts) uses to stand in for a
// real record — never real ids. Live here, not in that feature's own
// folder, because shared runtime code needs to recognize them:
//
//  - PREVIEW_RECORD_ID: record-detail-hooks.ts's useRecordDetail/
//    useAuditLog/useLinkedRecords/useComments all gate `enabled` on
//    `recordId !== PREVIEW_RECORD_ID` in addition to their existing
//    `!!recordId` check — the one airtight way to guarantee a real fetch
//    never fires for preview data, given `enabled: false` means React
//    Query never calls queryFn at all, no cache-seeding/staleTime race
//    possible. (An earlier cache-seeding-only approach was tried and
//    failed live: a real fetch already in flight — from an earlier mount,
//    StrictMode's double-invoke, or a fast Edit<->Preview toggle — would
//    resolve moments after the seed and silently overwrite it back to
//    null/error, confirmed via React Query devtools showing `Data: null,
//    status: fetching` immediately after the seed had supposedly landed.)
//
//  - PREVIEW_REFERENCE_SENTINEL: written into a fabricated 'reference'
//    field's value — ReferenceValueLabel (a shared runtime component used
//    far outside the Detail Page Builder) recognizes it and short-circuits
//    before issuing a fetch that would either 404 or, worse, collide with
//    an unrelated real record that happens to share the sentinel string.
export const PREVIEW_RECORD_ID = '__preview__'
export const PREVIEW_REFERENCE_SENTINEL = '__preview_sample__'

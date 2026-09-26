import { api } from '@/lib/api'
import type { NumberFormat, FormDefinition, CreateFormPayload, UpdateFormPayload, FormRecord, AuditLogResponse, LinkedRecordsResponse, ConnectionCountTarget, ConnectionCountsResponse, CommentEntry, CommentsResponse, AttachmentEntry, TagEntry, TagsResponse, TagSuggestionsResponse, FormVisibility, FormSharingResponse, FormSharingUsageResponse, LinkableForm } from './types'
import type { FilterGroup, SortRule } from '@/features/workflows/types'

export interface SearchRecordsRequest {
  filter?: FilterGroup
  sort?: SortRule[]
  page: number
  page_size: number
  /** Free-text full-text search, ANDed server-side into `filter` against the
   *  form's combined search column (fields marked searchable). */
  query?: string
}

export interface SearchRecordsResponse {
  records: FormRecord[]
  total: number
  page: number
  page_size: number
  /** Set when the filter carried a current_user condition that failed to
   *  resolve (no signed-in viewer, or no matching account record) — records
   *  is then empty BY DESIGN (fail closed), and this says why, so a "my
   *  records" menu with no results reads as "you have no linked account,"
   *  not "this menu is broken." */
  unresolved_reason?: string
}

export type AggregateFn = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'count_distinct' | 'median'
export type DateBucket = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface AggregateDimensionRequest {
  field: string
  bucket?: DateBucket
  ranges?: number[]
}

export interface AggregateSeriesRequest {
  fn: AggregateFn
  field?: string
}

export interface AggregateRecordsRequest {
  /** Omitting this means "no grouping at all" — one aggregate row over the
   *  whole (optionally filtered) table, the stat/KPI chart type's data
   *  source. See workflow-engine's AggregateQuery.GroupBy doc comment. */
  group_by?: AggregateDimensionRequest
  group_by2?: AggregateDimensionRequest
  series?: AggregateSeriesRequest[]
  filter?: FilterGroup
  sort_by?: 'group' | 'value'
  sort_dir?: 'asc' | 'desc'
  limit?: number
}

export interface AggregateGroupResponse {
  /** ABSENT, not "", in two cases, because the engine serializes it with
   *  `omitempty` (api/forms/handler.go's aggregateGroupResponse):
   *
   *  - the request had no group_by, i.e. a stat tile's single row;
   *  - the grouped value IS the empty string, which a text field stores
   *    when a form is saved with that input left blank.
   *
   *  A record with no value at all is a different group: it arrives keyed
   *  "(empty)". Read this through the chart's rawGroupKey/groupKeyLabel
   *  (widgets/chart/bucket-label.ts) rather than directly. */
  key?: string
  /** Absent when the request had no group_by2, and under the same
   *  empty-string rule as `key` when it did. */
  key2?: string
  values: number[]
}

/** Describes one positional column of AggregateGroupResponse, in row order:
 *  the group key, key2 when the request had one, then one per series.
 *  Mirrors api/forms/handler.go's aggregateColumnResponse.
 *
 *  This is what lets a chart format a money measure as money. Before it, the
 *  renderer had to go back to the form definition and guess which field
 *  produced which value, which is why formatting only ever worked on a stat
 *  tile — the one shape with exactly one known source field. */
export interface AggregateColumnResponse {
  role: 'group' | 'group2' | 'measure'
  /** The form field grouped by or aggregated. Absent for a count. */
  field?: string
  /** A display fallback — a caller's own label (the chart's series[].label)
   *  still wins. */
  label: string
  /** Measures only. */
  fn?: string
  /** The aggregated field's own format. Absent for counts (a row count has
   *  no unit) and for group keys, which are text. */
  number_format?: NumberFormat
}

export interface AggregateRecordsResponse {
  groups: AggregateGroupResponse[]
  /** Always present from a current backend; optional so an older one (or a
   *  cached response) degrades to the previous unformatted behavior rather
   *  than throwing. */
  columns?: AggregateColumnResponse[]
  /** Mirrors SearchRecordsResponse's own field — see its doc comment.
   *  groups is empty BY DESIGN when this is set. */
  unresolved_reason?: string
}

// Mirrors api/forms/handler.go's triggerWorkflowResponse (FR-B3-007's
// on_demand_data_driven dispatch, FR-D2-017's trigger_workflow custom action).
export interface TriggerWorkflowResponse {
  execution_id: string
  status: string
  workflow_definition_id: string
}

// Mirrors api/forms/handler.go's exportReportResponse (FR-D2-018's
// export_report custom action). Deliberately NOT execution_id/status/poll-
// shaped like TriggerWorkflowResponse above — this endpoint is synchronous,
// the response IS the final result.
export interface ExportReportResponse {
  content_id: string
  filename: string
  format: string
  row_count: number
}

export const formsApi = {
  // --- definitions ---
  list:   () => api.get('forms').json<FormDefinition[]>(),
  get:    (id: string) => api.get(`forms/${id}`).json<FormDefinition>(),
  create: (p: CreateFormPayload) => api.post('forms', { json: p }).json<FormDefinition>(),
  update: (id: string, p: UpdateFormPayload) => api.put(`forms/${id}`, { json: p }).json<FormDefinition>(),
  delete: async (id: string): Promise<void> => {
    await api.delete(`forms/${id}`)
  },

  // --- tree actions ("..." menu on a form node) ---
  copy:   (id: string) => api.post(`forms/${id}/copy`).json<FormDefinition>(),
  unlink: (id: string) => api.post(`forms/${id}/unlink`).json<FormDefinition>(),

  // FR-C1-013: Share Settings — replaces the removed one-time "share" clone
  // action. Owning-app-only server-side (a non-owning app's call 404s the
  // same as any form it can't see the settings of).
  getSharing: (id: string) => api.get(`forms/${id}/sharing`).json<FormSharingResponse>(),
  getSharingUsage: (id: string) => api.get(`forms/${id}/sharing/usage`).json<FormSharingUsageResponse>(),
  setSharing: (id: string, visibility: FormVisibility) =>
    api.patch(`forms/${id}/sharing`, { json: { visibility } }).json<FormSharingResponse>(),

  // --- cross-app links (the borrowing app's side of the same sharing model) ---
  // listLinkable is the "Shared from another app" picker's source: forms
  // OTHER apps under this client have shared and this app hasn't linked.
  listLinkable: () => api.get('forms/linkable').json<LinkableForm[]>(),
  link: (id: string) => api.post(`forms/${id}/link`).json<FormDefinition>(),
  // A 204, so awaited rather than passed through as an unresolved
  // ResponsePromise — same reason deleteRecord below does.
  unlinkShared: async (id: string): Promise<void> => {
    await api.delete(`forms/${id}/link`)
  },

  // --- records ---
  listRecords:   (formId: string, filters?: Record<string, string>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : ''
    return api.get(`forms/${formId}/records${params}`).json<FormRecord[]>()
  },
  getRecord:     (formId: string, recordId: string) =>
    api.get(`forms/${formId}/records/${recordId}`).json<FormRecord>(),
  createRecord:  (formId: string, data: FormRecord) =>
    api.post(`forms/${formId}/records?executeWorkflows=true`, { json: data }).json<FormRecord>(),
  updateRecord:  (formId: string, recordId: string, data: FormRecord) =>
    api.put(`forms/${formId}/records/${recordId}`, { json: data }).json<FormRecord>(),
  // Kanban layout's within-column drag-to-reorder — writes only the record's
  // kanban_order (a fractional-index float the caller computes as the
  // midpoint between its new neighbors), bypassing validation/triggers/audit
  // the way updateRecord's full-record PUT doesn't. A 204, not a record body.
  setKanbanOrder: async (formId: string, recordId: string, order: number): Promise<void> => {
    await api.patch(`forms/${formId}/records/${recordId}/kanban-order`, { json: { order } })
  },
  // Awaits the ky ResponsePromise directly (a 204 has no body to parse) so
  // callers get a real, settled Promise<void> — passing the raw
  // ResponsePromise through unresolved is what let React Query's mutation
  // observer see the DELETE's HTTP request finish while its own isPending/
  // isSuccess state never flipped (reproduced specifically on the "Expand to
  // full page" route's standalone confirm dialog).
  deleteRecord:  async (formId: string, recordId: string): Promise<void> => {
    await api.delete(`forms/${formId}/records/${recordId}`)
  },
  searchRecords: (formId: string, req: SearchRecordsRequest) =>
    api.post(`forms/${formId}/records/search`, { json: req }).json<SearchRecordsResponse>(),
  // The reference-field picker's data source: the TARGET form's records with
  // the field's reference_filter enforced server-side (current_user resolved
  // against the caller's session, this_record hops against `draft`). An
  // unresolvable viewer returns EMPTY records plus unresolved_reason — fail
  // closed, with the why — never an error and never the unfiltered list.
  referenceOptions: (formId: string, fieldName: string, req: ReferenceOptionsRequest) =>
    api.post(`forms/${formId}/fields/${fieldName}/reference-options`, { json: req }).json<ReferenceOptionsResponse>(),
  aggregateRecords: (formId: string, req: AggregateRecordsRequest) =>
    api.post(`forms/${formId}/records/aggregate`, { json: req }).json<AggregateRecordsResponse>(),
  getRecordAuditLog: (formId: string, recordId: string, params: { page: number; page_size: number }) =>
    api.get(`forms/${formId}/records/${recordId}/audit`, { searchParams: params }).json<AuditLogResponse>(),
  getLinkedRecords: (formId: string, recordId: string, params: { page: number; page_size: number }) =>
    api.get(`forms/${formId}/records/${recordId}/linked`, { searchParams: params }).json<LinkedRecordsResponse>(),
  getConnectionCounts: (formId: string, recordId: string, targets: ConnectionCountTarget[]) =>
    api.post(`forms/${formId}/records/${recordId}/connections-count`, { json: { targets } }).json<ConnectionCountsResponse>(),
  // Dispatches a workflow whose Trigger node is Mode: on_demand_data_driven
  // (FR-B3-007) against this specific record — the trigger_workflow custom
  // action's dispatch call (FR-D2-017). form_id/record_id are URL path
  // segments (not the JSON body) so the backend's RequireFormPermission
  // ("view") gate can read form_id the same way GetRecord's route already
  // does — see api/forms/handler.go's TriggerWorkflow doc comment.
  triggerWorkflow: (formId: string, recordId: string, workflowDefinitionId: string) =>
    api.post(`forms/${formId}/records/${recordId}/trigger-workflow`, {
      json: { workflow_definition_id: workflowDefinitionId },
    }).json<TriggerWorkflowResponse>(),

  exportReport: (
    formId: string,
    recordId: string,
    reportDefinitionId: string,
    format?: string,
    argumentValues?: Record<string, unknown>,
  ) =>
    api.post(`forms/${formId}/records/${recordId}/export-report`, {
      json: { report_definition_id: reportDefinitionId, format, arguments: argumentValues },
    }).json<ExportReportResponse>(),

  // --- comments (FR-D2-016) ---
  getComments: (formId: string, recordId: string, params: { page: number; page_size: number }) =>
    api.get(`forms/${formId}/records/${recordId}/comments`, { searchParams: params }).json<CommentsResponse>(),
  createComment: (formId: string, recordId: string, body: string) =>
    api.post(`forms/${formId}/records/${recordId}/comments`, { json: { body } }).json<CommentEntry>(),
  updateComment: (formId: string, recordId: string, commentId: string, body: string) =>
    api.put(`forms/${formId}/records/${recordId}/comments/${commentId}`, { json: { body } }),
  deleteComment: (formId: string, recordId: string, commentId: string) =>
    api.delete(`forms/${formId}/records/${recordId}/comments/${commentId}`),

  // --- attachments (Detail Page "Attachments" tab) ---
  getAttachments: (formId: string, recordId: string) =>
    api.get(`forms/${formId}/records/${recordId}/attachments`).json<AttachmentEntry[]>(),
  // See features/content/api.ts's contentApi.upload for why
  // `headers: { 'Content-Type': undefined }` is required here: ky's own
  // FormData-boundary auto-detection only kicks in when the client's
  // default 'Content-Type: application/json' header is explicitly deleted
  // BEFORE Request construction, not merely overridden after.
  uploadAttachment: (formId: string, recordId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`forms/${formId}/records/${recordId}/attachments`, {
      body: form,
      headers: { 'Content-Type': undefined },
    }).json<AttachmentEntry>()
  },
  deleteAttachment: (formId: string, recordId: string, attachmentId: string) =>
    api.delete(`forms/${formId}/records/${recordId}/attachments/${attachmentId}`),

  // --- tags (Detail Page "Tags" tab) ---
  getTags: (formId: string, recordId: string) =>
    api.get(`forms/${formId}/records/${recordId}/tags`).json<TagsResponse>(),
  addTag: (formId: string, recordId: string, tag: string) =>
    api.post(`forms/${formId}/records/${recordId}/tags`, { json: { tag } }).json<TagEntry>(),
  removeTag: (formId: string, recordId: string, tagId: string) =>
    api.delete(`forms/${formId}/records/${recordId}/tags/${tagId}`),
  getTagSuggestions: (formId: string) =>
    api.get(`forms/${formId}/tags/suggestions`).json<TagSuggestionsResponse>(),

  // --- record-detail account actions (create_user_on_submit forms) ---
  getRecordAccountStatus: (formId: string, recordId: string) =>
    api.get(`forms/${formId}/records/${recordId}/account`).json<RecordAccountStatus>(),
  resendRecordInvite: (formId: string, recordId: string) =>
    api.post(`forms/${formId}/records/${recordId}/account/resend-invite`).json<RecordAccountStatus>(),
  removeRecordAccess: (formId: string, recordId: string) =>
    api.post(`forms/${formId}/records/${recordId}/account/remove-access`).json<RecordAccountStatus>(),
  enableRecordAccess: (formId: string, recordId: string, data: { email: string; role_id: string }) =>
    api.post(`forms/${formId}/records/${recordId}/account/enable-access`, { json: data }).json<RecordAccountStatus>(),
}

export interface ReferenceOptionsRequest {
  search?: string
  /** One target-form field to contains-match `search` against (the picker's
   *  display-field convention); omitted, `search` is full-text over the
   *  target's Searchable fields. */
  search_field?: string
  /** The record-being-authored's current reference values, for this_record
   *  hops — {"<sibling reference field>": "<record id>"}. */
  draft?: Record<string, unknown>
  page_size?: number
}

export interface ReferenceOptionsResponse {
  records: FormRecord[]
  total: number
  /** Set when the viewer-scoped filter could not resolve (no viewer, no
   *  account record, an empty hop field): records is then empty BY DESIGN,
   *  and this says why — surface it instead of "no records found". */
  unresolved_reason?: string
}

export interface RecordAccountStatus {
  status: 'none' | 'pending' | 'active' | 'removed'
  invitation_id?: string
  user_id?: string
}

import { api } from '@/lib/api'
import type { FormDefinition, CreateFormPayload, UpdateFormPayload, FormRecord, AuditLogResponse, LinkedRecordsResponse, CommentEntry, CommentsResponse } from './types'
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
}

export type AggregateFn = 'count' | 'sum' | 'avg' | 'min' | 'max'
export type DateBucket = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface AggregateDimensionRequest {
  field: string
  bucket?: DateBucket
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
  key: string
  key2?: string
  values: number[]
}

export interface AggregateRecordsResponse {
  groups: AggregateGroupResponse[]
}

// Mirrors api/forms/handler.go's triggerWorkflowResponse (FR-B3-007's
// on_demand_data_driven dispatch, FR-D2-017's trigger_workflow custom action).
export interface TriggerWorkflowResponse {
  execution_id: string
  status: string
  workflow_definition_id: string
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
  share:  (id: string, targetAppId: string) =>
    api.post(`forms/${id}/share`, { json: { target_app_id: targetAppId } }).json<FormDefinition>(),

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
  aggregateRecords: (formId: string, req: AggregateRecordsRequest) =>
    api.post(`forms/${formId}/records/aggregate`, { json: req }).json<AggregateRecordsResponse>(),
  getRecordAuditLog: (formId: string, recordId: string, params: { page: number; page_size: number }) =>
    api.get(`forms/${formId}/records/${recordId}/audit`, { searchParams: params }).json<AuditLogResponse>(),
  getLinkedRecords: (formId: string, recordId: string, params: { page: number; page_size: number }) =>
    api.get(`forms/${formId}/records/${recordId}/linked`, { searchParams: params }).json<LinkedRecordsResponse>(),
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

  // --- comments (FR-D2-016) ---
  getComments: (formId: string, recordId: string, params: { page: number; page_size: number }) =>
    api.get(`forms/${formId}/records/${recordId}/comments`, { searchParams: params }).json<CommentsResponse>(),
  createComment: (formId: string, recordId: string, body: string) =>
    api.post(`forms/${formId}/records/${recordId}/comments`, { json: { body } }).json<CommentEntry>(),
  updateComment: (formId: string, recordId: string, commentId: string, body: string) =>
    api.put(`forms/${formId}/records/${recordId}/comments/${commentId}`, { json: { body } }),
  deleteComment: (formId: string, recordId: string, commentId: string) =>
    api.delete(`forms/${formId}/records/${recordId}/comments/${commentId}`),

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

export interface RecordAccountStatus {
  status: 'none' | 'pending' | 'active' | 'removed'
  invitation_id?: string
  user_id?: string
}

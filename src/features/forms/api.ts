import { api } from '@/lib/api'
import type { FormDefinition, CreateFormPayload, UpdateFormPayload, FormRecord, AuditLogResponse, LinkedRecordsResponse } from './types'
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

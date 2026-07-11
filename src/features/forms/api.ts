import { api } from '@/lib/api'
import type { FormDefinition, CreateFormPayload, UpdateFormPayload, FormRecord, AuditLogResponse, LinkedRecordsResponse } from './types'
import type { FilterGroup, SortRule } from '@/features/workflows/types'

export interface SearchRecordsRequest {
  filter?: FilterGroup
  sort?: SortRule[]
  page: number
  page_size: number
}

export interface SearchRecordsResponse {
  records: FormRecord[]
  total: number
  page: number
  page_size: number
}

export const formsApi = {
  // --- definitions ---
  list:   () => api.get('forms').json<FormDefinition[]>(),
  get:    (id: string) => api.get(`forms/${id}`).json<FormDefinition>(),
  create: (p: CreateFormPayload) => api.post('forms', { json: p }).json<FormDefinition>(),
  update: (id: string, p: UpdateFormPayload) => api.put(`forms/${id}`, { json: p }).json<FormDefinition>(),
  delete: (id: string) => api.delete(`forms/${id}`),

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
  deleteRecord:  (formId: string, recordId: string) =>
    api.delete(`forms/${formId}/records/${recordId}`),
  searchRecords: (formId: string, req: SearchRecordsRequest) =>
    api.post(`forms/${formId}/records/search`, { json: req }).json<SearchRecordsResponse>(),
  getRecordAuditLog: (formId: string, recordId: string, params: { page: number; page_size: number }) =>
    api.get(`forms/${formId}/records/${recordId}/audit`, { searchParams: params }).json<AuditLogResponse>(),
  getLinkedRecords: (formId: string, recordId: string, params: { page: number; page_size: number }) =>
    api.get(`forms/${formId}/records/${recordId}/linked`, { searchParams: params }).json<LinkedRecordsResponse>(),
}

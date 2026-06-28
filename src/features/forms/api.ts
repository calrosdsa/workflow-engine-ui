import { api } from '@/lib/api'
import type { FormDefinition, CreateFormPayload, UpdateFormPayload, FormRecord } from './types'

export const formsApi = {
  // --- definitions ---
  list:   () => api.get('forms').json<FormDefinition[]>(),
  get:    (id: string) => api.get(`forms/${id}`).json<FormDefinition>(),
  create: (p: CreateFormPayload) => api.post('forms', { json: p }).json<FormDefinition>(),
  update: (id: string, p: UpdateFormPayload) => api.put(`forms/${id}`, { json: p }).json<FormDefinition>(),
  delete: (id: string) => api.delete(`forms/${id}`),

  // --- records ---
  listRecords:   (formId: string, filters?: Record<string, string>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : ''
    return api.get(`forms/${formId}/records${params}`).json<FormRecord[]>()
  },
  getRecord:     (formId: string, recordId: string) =>
    api.get(`forms/${formId}/records/${recordId}`).json<FormRecord>(),
  createRecord:  (formId: string, data: FormRecord) =>
    api.post(`forms/${formId}/records`, { json: data }).json<FormRecord>(),
  updateRecord:  (formId: string, recordId: string, data: FormRecord) =>
    api.put(`forms/${formId}/records/${recordId}`, { json: data }).json<FormRecord>(),
  deleteRecord:  (formId: string, recordId: string) =>
    api.delete(`forms/${formId}/records/${recordId}`),
}

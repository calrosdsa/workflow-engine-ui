import { api } from '@/lib/api'
import type { WorkflowDefinition, CreateWorkflowPayload, UpdateWorkflowPayload, ReorderWorkflowsPayload, ExposedTool } from './types'

export const workflowsApi = {
  list: () => api.get('workflows').json<WorkflowDefinition[]>(),
  get:  (id: string) => api.get(`workflows/${id}`).json<WorkflowDefinition>(),

  create: (payload: CreateWorkflowPayload) =>
    api.post('workflows', { json: payload }).json<WorkflowDefinition>(),

  update: (id: string, payload: UpdateWorkflowPayload) =>
    api.put(`workflows/${id}`, { json: payload }).json<WorkflowDefinition>(),

  delete: (id: string) => api.delete(`workflows/${id}`),

  reorder: (payload: ReorderWorkflowsPayload) =>
    api.patch('workflows/reorder', { json: payload }),

  // Gated assistant:read, not workflows:read — see api/workflows'
  // ExposedAsTools handler doc comment (FR-C8-004).
  exposedAsTools: () => api.get('workflows/exposed-as-tools').json<ExposedTool[]>(),
}

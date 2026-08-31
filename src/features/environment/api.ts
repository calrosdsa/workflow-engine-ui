import { api } from '@/lib/api'
import type {
  EnvironmentLinkStatus, CreateProductionPayload, LinkExistingPayload,
  PromotePreviewResult, PromoteResult,
} from './types'

export const environmentApi = {
  status:          () => api.get('application/environment-link').json<EnvironmentLinkStatus>(),
  createProduction: (p: CreateProductionPayload) =>
    api.post('application/environment-link/create-production', { json: p }).json<EnvironmentLinkStatus>(),
  linkExisting:    (p: LinkExistingPayload) =>
    api.post('application/environment-link/link-existing', { json: p }).json<EnvironmentLinkStatus>(),
  promotePreview:  () => api.get('application/environment-link/promote-preview').json<PromotePreviewResult>(),
  promote:         () => api.post('application/environment-link/promote').json<PromoteResult>(),
  unlink:          () => api.delete('application/environment-link'),
}

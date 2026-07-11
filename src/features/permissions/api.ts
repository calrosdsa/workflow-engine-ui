import { api } from '@/lib/api'
import type { PermissionDef } from './types'

export const permissionsApi = {
  list: () => api.get('permissions').json<PermissionDef[]>(),
}

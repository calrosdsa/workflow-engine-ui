import { api } from '@/lib/api'
import type { TeamUser } from './types'

export const usersApi = {
  list:         () => api.get('users').json<TeamUser[]>(),
  revokeAccess: (userId: string) => api.delete(`users/${userId}`),
}

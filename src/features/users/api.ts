import { api } from '@/lib/api'
import type { TeamUser } from './types'

export const usersApi = {
  list:             () => api.get('users').json<TeamUser[]>(),
  revokeAccess:     (userId: string) => api.delete(`users/${userId}`),
  updateAppRole:    (userId: string, appId: string, roleId: string) =>
    api.put(`users/${userId}/apps/${appId}`, { json: { role_id: roleId } }),
  revokeAppAccess:  (userId: string, appId: string) => api.delete(`users/${userId}/apps/${appId}`),
  grantSuperAdmin:  (userId: string) => api.post(`users/${userId}/super-admin`),
  revokeSuperAdmin: (userId: string) => api.delete(`users/${userId}/super-admin`),
}

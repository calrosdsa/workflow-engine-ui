import { api } from '@/lib/api'
import type { Role, CreateRolePayload, UpdateRolePayload } from './types'

// Roles are scoped per-app; every read/delete route requires ?app_id= (the
// one resource in this app where the caller explicitly names the scope
// instead of relying on the active membership's app_id alone — see
// api/roles/handler.go's List comment on the backend side).
export const rolesApi = {
  list:   (appId: string) => api.get('roles', { searchParams: { app_id: appId } }).json<Role[]>(),
  get:    (id: string, appId: string) => api.get(`roles/${id}`, { searchParams: { app_id: appId } }).json<Role>(),
  create: (p: CreateRolePayload) => api.post('roles', { json: p }).json<Role>(),
  update: (id: string, p: UpdateRolePayload) => api.put(`roles/${id}`, { json: p }).json<Role>(),
  delete: (id: string, appId: string) => api.delete(`roles/${id}`, { searchParams: { app_id: appId } }),
}

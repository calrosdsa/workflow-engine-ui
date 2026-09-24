import { api } from '@/lib/api'
import type { TeamUser, BasicUser } from './types'

export const usersApi = {
  list:             () => api.get('users').json<TeamUser[]>(),
  // FR-D2-016 — lower-privilege than list() above (no Super Admin gate);
  // resolves a batch of ids to display name/email, e.g. for comment authors.
  // An empty ids array is a no-op (matches the backend's own early-return).
  getBasic:         (ids: string[]) =>
    ids.length === 0
      ? Promise.resolve<BasicUser[]>([])
      : api.get('users/basic', { searchParams: { ids: ids.join(',') } }).json<BasicUser[]>(),
  // FR-D2-016 v0.6 — @mention autocomplete. App-scoped (not client-scoped
  // like getBasic above), search-by-substring (not resolve-by-known-id).
  searchMentionable: (query: string) =>
    query.trim() === ''
      ? Promise.resolve<BasicUser[]>([])
      : api.get('users/mentionable', { searchParams: { q: query } }).json<BasicUser[]>(),
  updateProfile:    (userId: string, firstName: string, lastName: string) =>
    api.patch(`users/${userId}`, { json: { first_name: firstName, last_name: lastName } }),
  revokeAccess:     (userId: string) => api.delete(`users/${userId}`),
  updateAppRole:    (userId: string, appId: string, roleId: string) =>
    api.put(`users/${userId}/apps/${appId}`, { json: { role_id: roleId } }),
  revokeAppAccess:  (userId: string, appId: string) => api.delete(`users/${userId}/apps/${appId}`),
  grantSuperAdmin:  (userId: string) => api.post(`users/${userId}/super-admin`),
  revokeSuperAdmin: (userId: string) => api.delete(`users/${userId}/super-admin`),
  // Turns off a member's two-step verification. The engine refuses (403) unless
  // the caller runs every organisation the member belongs to, and never lets
  // anyone reset themselves this way.
  resetMfa:         (userId: string) => api.post(`users/${userId}/mfa/reset`),
}

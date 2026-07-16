import { api } from '@/lib/api'
import type { PermissionDef } from './types'

export const permissionsApi = {
  // app_id is optional — omitting it (e.g. the menu editor's general-purpose
  // "required permission" picker) returns only the static catalog, no
  // per-form entries.
  list: (appId?: string) =>
    api.get('permissions', appId ? { searchParams: { app_id: appId } } : {}).json<PermissionDef[]>(),
}

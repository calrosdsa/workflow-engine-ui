import { useQuery } from '@tanstack/react-query'
import { permissionsApi } from './api'

/** The permission catalog is a static server-side list (changes only on a
 *  backend deploy, not per-session) — staleTime: Infinity avoids refetching
 *  it on every window focus/mount like a normal resource list. */
export function usePermissionsCatalog() {
  return useQuery({ queryKey: ['permissions'], queryFn: permissionsApi.list, staleTime: Infinity })
}

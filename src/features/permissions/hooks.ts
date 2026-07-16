import { useQuery } from '@tanstack/react-query'
import { permissionsApi } from './api'

/** The static portion of the catalog only changes on a backend deploy, but
 *  once appId is given the response also includes per-form entries derived
 *  from that app's forms — which change whenever a form is created, renamed,
 *  or deleted (see features/forms/hooks.ts's mutations, which invalidate
 *  this same ['permissions'] key). No more staleTime: Infinity. */
export function usePermissionsCatalog(appId?: string) {
  return useQuery({
    queryKey: ['permissions', appId],
    queryFn: () => permissionsApi.list(appId),
  })
}

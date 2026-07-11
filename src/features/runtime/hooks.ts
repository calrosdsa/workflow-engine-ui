import { useQuery } from '@tanstack/react-query'
import { runtimeApi } from './api'

export const runtimeKeys = {
  snapshot: (clientId: string, appId: string) => ['runtime', 'snapshot', clientId, appId] as const,
}

// Published snapshots change rarely (only on an explicit "Launch
// Application" click), so this is the one query in the app with a
// deliberately long staleTime — it's the single fetch the whole runtime
// session hangs off of.
export function useRuntimeSnapshot(clientId: string, appId: string) {
  return useQuery({
    queryKey: runtimeKeys.snapshot(clientId, appId),
    queryFn: () => runtimeApi.getPublishedSnapshot(clientId, appId),
    staleTime: 60_000,
    retry: false,
  })
}

// Fetches the runtime connector registry from GET /api/connectors — see
// connector-registry.ts's header comment for the full design. Follows
// features/app-settings/hooks.ts's useCredentials() shape exactly (same
// query-key-factory convention, same plain useQuery — no polling; a new
// connector becoming available mid-session is picked up on the next
// natural refetch/navigation, not live-pushed).
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toRegistryEntry, type ConnectorManifest, type ConnectorRegistryEntry } from './connector-registry'

export const connectorKeys = {
  all: () => ['workflows', 'connectors'] as const,
}

async function listConnectors(): Promise<ConnectorRegistryEntry[]> {
  // `api` already has prefix: '/api' baked in (see @/lib/api) and Vite's
  // dev proxy strips that prefix before forwarding to the Go server, whose
  // own route is registered bare as GET /connectors — so the path here is
  // 'connectors', matching every sibling call site's convention (e.g.
  // api.get('application/credentials'), never 'api/application/credentials').
  const manifests = await api.get('connectors').json<ConnectorManifest[]>()
  return manifests.map(toRegistryEntry)
}

// Module-level, not inline in useConnectorRegistry's placeholderData option
// — a literal `[] as ConnectorRegistryEntry[]` written inline there would
// construct a NEW array object on every call to the hook (i.e. every render
// of every component using it), which defeats any consumer trying to
// useMemo off `data`'s reference (found via Layout.tsx's nodeTypes memo
// logging React Flow's "you've created a new nodeTypes object" warning —
// the query's own placeholder churn was the root cause, not the memo
// itself). One stable, shared reference fixes it for every consumer at
// once.
const EMPTY_CONNECTORS: ConnectorRegistryEntry[] = []

/** Empty array as the initial/placeholder value (not undefined) so every
 *  call site can treat "still loading" and "loaded, zero connectors
 *  configured" identically without a separate isLoading branch — the same
 *  reasoning form-builder's own registries use for their always-defined
 *  constants; this one just resolves asynchronously first. */
export function useConnectorRegistry() {
  return useQuery({
    queryKey: connectorKeys.all(),
    queryFn: listConnectors,
    placeholderData: EMPTY_CONNECTORS,
  })
}

import { api } from '@/lib/api'
import type { AppSnapshot } from './types'

export const runtimeApi = {
  // Unauthenticated GET — the IDs are already in the URL, so ky's
  // X-Client-ID/X-App-ID header injection (from activeMembership, if any)
  // is harmless but unused; the backend route ignores it entirely.
  getPublishedSnapshot: (clientId: string, appId: string) =>
    api.get(`runtime/${clientId}/${appId}`).json<AppSnapshot>(),
}

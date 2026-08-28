import { api } from '@/lib/api'
import type { AppSnapshot } from './types'

export const runtimeApi = {
  // Unauthenticated GET — the IDs are already in the URL, so ky's
  // X-Client-ID/X-App-ID header injection (from activeMembership, if any)
  // is harmless but unused; the backend route ignores it entirely.
  getPublishedSnapshot: (clientId: string, appId: string) =>
    api.get(`runtime/${clientId}/${appId}`).json<AppSnapshot>(),
  // Authenticated — application:design-gated server-side (see the backend
  // handler's own doc comment). Unlike getPublishedSnapshot, the IDs are
  // NOT in this URL; the backend scopes to whichever app the caller's
  // session/X-Client-ID/X-App-ID headers resolve to, same as every other
  // builder-side /application/* route. runtimeAppRoute's beforeLoad
  // already syncs activeMembership to the URL's $clientId/$appId before
  // this is called, so ky's header injection lands on the right app.
  getDraftSnapshot: () =>
    api.get('application/draft-snapshot').json<AppSnapshot>(),
}

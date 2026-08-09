import { useAuthStore } from '@/stores/auth'
import type { Membership } from '@/features/auth/types'

/** Cross-bundle navigation from the runtime app into the builder's app-scoped
 *  design shell (Workflows/Forms/App Design/Settings, gated on
 *  application:design — see ApplicationDesignShell.tsx) — the reverse
 *  direction of urls.ts's runtimeUrlFor. A full page navigation, not the
 *  runtime router's navigate: the builder lives in a separate Vite bundle
 *  (index.html vs runtime.html), so there is no in-SPA route to push to.
 *
 *  The design shell's own beforeLoad (router.tsx's applicationShellRoute)
 *  re-syncs activeMembership from the URL's $appId on load, so setting it
 *  here is belt-and-suspenders for the very first paint before that
 *  beforeLoad resolves, not the sole source of truth. */
export function openDesignHub(membership: Membership): void {
  useAuthStore.getState().setActiveMembership(membership)
  window.location.href = `/applications/${membership.app_id}`
}

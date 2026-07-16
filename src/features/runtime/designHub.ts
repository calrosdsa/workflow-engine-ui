import { useAuthStore } from '@/stores/auth'
import type { Membership } from '@/features/auth/types'

/** Cross-bundle navigation from the runtime app into the builder's design
 *  tools (Workflows/Forms/Applications, all gated on application:design —
 *  see Sidebar.tsx) — the reverse direction of RuntimePortalPage.tsx's
 *  runtimeUrlFor. A full page navigation, not the runtime router's navigate:
 *  the builder lives in a separate Vite bundle (index.html vs runtime.html),
 *  so there is no in-SPA route to push to.
 *
 *  The builder resolves "which app" from useAuthStore's activeMembership
 *  (persisted, shared localStorage key across both bundles) rather than a
 *  URL param — see stores/auth.ts and Sidebar.tsx's usePermission calls —
 *  so this sets it explicitly before navigating, using the same membership
 *  object the runtime already resolved for its own permission check
 *  (RuntimeAppShell.tsx), rather than re-fetching anything. */
export function openDesignHub(membership: Membership): void {
  useAuthStore.getState().setActiveMembership(membership)
  window.location.href = '/workflows'
}

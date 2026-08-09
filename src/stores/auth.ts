import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Me, Membership } from '@/features/auth/types'

interface AuthState {
  session: Me | null
  // Which CLIENT's apps are shown on Home / the client switcher. Independent
  // of activeMembership (which app's data the API is actually scoped to) —
  // switching clients on Home should not silently change what a workflow/form
  // page is editing until the user actually opens a specific app.
  activeClientId: string | null
  activeMembership: Membership | null
  setSession: (me: Me) => void
  // Switching clients must also re-point activeMembership at a membership
  // that actually belongs to the new client -- otherwise lib/api.ts keeps
  // sending X-Client-ID/X-App-ID for the OLD client on every request (the
  // headers are derived from activeMembership, not activeClientId), which
  // either 401s ("no membership for requested client/app") or silently
  // scopes client-wide pages like Team/Roles/Users to the wrong client. Only
  // the client_id needs to match for a Super Admin's client-wide grant, but
  // ResolveMembership needs a concrete app_id echoed back, so this prefers
  // an app-scoped membership under the new client if one exists.
  setActiveClientId: (clientId: string) => void
  setActiveMembership: (m: Membership) => void
  clear: () => void
}

// The Limen session itself lives in an HttpOnly cookie (unreadable from JS
// by design, and already persisted/re-sent by the browser). Only the
// *active* client/app selection is persisted here, so a page refresh
// doesn't lose which tenant context the user had selected.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      activeClientId: null,
      activeMembership: null,
      setSession: (session) =>
        set((state) => ({
          session,
          activeClientId: state.activeClientId ?? session.memberships?.[0]?.client_id ?? null,
          activeMembership: state.activeMembership ?? session.memberships?.[0] ?? null,
        })),
      setActiveClientId: (activeClientId) =>
        set((state) => {
          const clientMemberships = (state.session?.memberships ?? []).filter(
            (m) => m.client_id === activeClientId,
          )
          // Prefer an app-scoped membership (a concrete app_id) over a
          // client-wide one -- ResolveMembership still needs a real app_id
          // hint to echo back even for Super Admin, and RequireTenant
          // rejects an empty one outright ("select an app").
          const nextMembership =
            clientMemberships.find((m) => m.app_id) ?? clientMemberships[0] ?? state.activeMembership
          return { activeClientId, activeMembership: nextMembership }
        }),
      setActiveMembership: (activeMembership) => set({ activeMembership }),
      clear: () => set({ session: null, activeClientId: null, activeMembership: null }),
    }),
    {
      name: 'workflow-engine-active-membership',
      partialize: (state) => ({ activeClientId: state.activeClientId, activeMembership: state.activeMembership }),
    },
  ),
)

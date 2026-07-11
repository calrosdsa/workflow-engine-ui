import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Me, Membership } from '@/features/auth/types'

interface AuthState {
  session: Me | null
  activeMembership: Membership | null
  setSession: (me: Me) => void
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
      activeMembership: null,
      setSession: (session) =>
        set((state) => ({
          session,
          activeMembership: state.activeMembership ?? session.memberships?.[0] ?? null,
        })),
      setActiveMembership: (activeMembership) => set({ activeMembership }),
      clear: () => set({ session: null, activeMembership: null }),
    }),
    {
      name: 'workflow-engine-active-membership',
      partialize: (state) => ({ activeMembership: state.activeMembership }),
    },
  ),
)

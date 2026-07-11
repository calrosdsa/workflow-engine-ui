import { ShieldAlert, LogIn } from 'lucide-react'
import { useParams } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth'
import { RuntimeLink } from './RuntimeLink'

// The direct-hit-the-URL safety net for the route-load-time 403 half of
// role-based menu visibility (RuntimeSidebar already hides gated items —
// this is what a user sees if they have the URL anyway). Distinguishes "not
// signed in yet" (inline prompt, not a hard redirect away from the app —
// per the selective-gating decision, anonymous visitors can browse public
// menus) from "signed in but this role lacks the permission" (plain denial,
// no prompt to offer).
export function PermissionDeniedPage() {
  const session = useAuthStore((s) => s.session)
  const { clientId, appId } = useParams({ strict: false }) as { clientId?: string; appId?: string }

  if (!session) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <LogIn size={36} className="opacity-40" />
        <h2 className="text-base font-semibold">Sign in to continue</h2>
        <p className="max-w-sm text-sm opacity-70">This section requires an account with access. Sign in to view it.</p>
        <RuntimeLink
          to={`/${clientId ?? ''}/${appId ?? ''}/login?returnTo=${encodeURIComponent(window.location.pathname)}`}
          className="mt-1 rounded-md px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'hsl(var(--primary))' }}
        >
          Sign in
        </RuntimeLink>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <ShieldAlert size={36} className="opacity-40" />
      <h2 className="text-base font-semibold">You don't have access to this section</h2>
      <p className="max-w-sm text-sm opacity-70">Contact an administrator if you believe this is a mistake.</p>
    </div>
  )
}

import { LayoutGrid, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { runtimeUrlFor } from '@/features/runtime/urls'
import type { Membership } from '@/features/auth/types'

/** Landing page for Runtime Users (no application:design/team-admin
 *  permissions on any membership — see features/auth/access.ts's
 *  qualifiesForBuilder). Lists every app the user has access to and hands
 *  off to that app's runtime.html entry on selection. The single-app
 *  auto-redirect happens in portalRoute's beforeLoad (router.tsx), before
 *  this component ever mounts, to avoid a picker-UI flash — this component
 *  only ever renders the multi-app picker or the empty state. */
export function RuntimePortalPage() {
  const session = useAuthStore((s) => s.session)
  const appMemberships = (session?.memberships ?? []).filter((m) => m.app_id)

  if (appMemberships.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4 text-center">
        <LayoutGrid size={32} className="mb-3 text-gray-300" />
        <p className="text-gray-500">You don't have access to any application yet.</p>
        <p className="mt-1 text-sm text-gray-400">Contact your administrator to request access.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/40 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="mt-1 text-sm text-gray-500">
            {appMemberships.length} application{appMemberships.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {appMemberships.map((m) => (
            <PortalAppCard key={`${m.client_id}:${m.app_id}`} membership={m} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PortalAppCard({ membership }: { membership: Membership }) {
  const openApp = () => {
    window.location.href = runtimeUrlFor(membership.client_id, membership.app_id!)
  }

  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={openApp}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{membership.app_name || membership.app_id}</CardTitle>
            <CardDescription className="mt-1 text-xs">{membership.role}</CardDescription>
          </div>
          <ChevronRight size={16} className="mt-1 shrink-0 text-gray-300" />
        </div>
      </CardHeader>
    </Card>
  )
}

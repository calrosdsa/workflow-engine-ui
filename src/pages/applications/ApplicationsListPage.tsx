import { useNavigate } from '@tanstack/react-router'
import { LayoutGrid, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useApplication } from '@/features/applications/hooks'

// Each Limen membership is scoped to (client_id, app_id) — and per the App
// Builder's locked decision, "Application" IS the app row that membership
// scopes to, so listing memberships with an app_id IS listing applications
// the current user can open the builder for. No separate backend "list
// applications" endpoint exists (or is needed) — session.memberships already
// has this data.
export function ApplicationsListPage() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const activeMembership = useAuthStore((s) => s.activeMembership)
  const setActiveMembership = useAuthStore((s) => s.setActiveMembership)

  const appMemberships = (session?.memberships ?? []).filter((m) => m.app_id)

  const openApp = (membership: typeof appMemberships[number]) => {
    if (membership.client_id !== activeMembership?.client_id || membership.app_id !== activeMembership?.app_id) {
      setActiveMembership(membership)
    }
    navigate({ to: '/applications/$appId', params: { appId: membership.app_id! } })
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <p className="text-sm text-gray-500 mt-1">{appMemberships.length} application{appMemberships.length === 1 ? '' : 's'}</p>
      </div>

      {appMemberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <LayoutGrid size={32} className="text-gray-300 mb-3" />
          <p className="text-gray-500">You don't have access to any application yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {appMemberships.map((m) => (
            <ApplicationCard key={`${m.client_id}:${m.app_id}`} clientId={m.client_id} appId={m.app_id!} role={m.role} onOpen={() => openApp(m)} />
          ))}
        </div>
      )}
    </div>
  )
}

function ApplicationCard({ appId, role, onOpen }: { clientId: string; appId: string; role: string; onOpen: () => void }) {
  // Only fetches the currently-active app's settings (the tenant-scoped
  // /application route has no path param) — for the active membership's card
  // this shows the real name; for others it falls back to the app_id, which
  // is acceptable since selecting a card switches scope before opening.
  const activeMembership = useAuthStore((s) => s.activeMembership)
  const isActive = activeMembership?.app_id === appId
  const { data: app } = useApplication()

  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={onOpen}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{isActive && app ? app.name : appId}</CardTitle>
            <CardDescription className="mt-1 text-xs">{role}</CardDescription>
          </div>
          <ChevronRight size={16} className="mt-1 shrink-0 text-gray-300" />
        </div>
      </CardHeader>
    </Card>
  )
}

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { LayoutGrid, ChevronRight, PencilRuler, Plus, Loader2, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { hasPermission } from '@/features/auth/permissions'
import { isSuperAdmin } from '@/features/auth/access'
import { useCreateApp } from '@/features/applications/hooks'
import { runtimeUrlFor } from '@/features/runtime/urls'
import type { Membership } from '@/features/auth/types'

// The single landing page for builder-qualified users (Runtime Users who
// don't qualify for the builder shell at all still land on /portal — see
// router.tsx's qualifiesForBuilder gate, unaffected by this page). Replaces
// the old ApplicationsListPage: lists apps for the ACTIVE CLIENT only (not
// every membership across every client), since a multi-client user picks
// their client via ClientSwitcher in AppShell's header first.
export function HomePage() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const activeClientId = useAuthStore((s) => s.activeClientId)
  const setActiveMembership = useAuthStore((s) => s.setActiveMembership)
  const canCreateApp = isSuperAdmin(session)
  const [createOpen, setCreateOpen] = useState(false)

  const appMemberships = (session?.memberships ?? []).filter(
    (m) => m.app_id && m.client_id === activeClientId,
  )

  const openRuntime = (m: Membership) => {
    window.location.href = runtimeUrlFor(m.client_id, m.app_id!)
  }

  const openDesign = (m: Membership) => {
    setActiveMembership(m)
    navigate({ to: '/applications/$appId', params: { appId: m.app_id! } })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-sm text-gray-500 mt-1">{appMemberships.length} application{appMemberships.length === 1 ? '' : 's'}</p>
        </div>
        {canCreateApp && (
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus size={16} />Add app</Button>
        )}
      </div>

      {appMemberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <LayoutGrid size={32} className="text-gray-300 mb-3" />
          <p className="text-gray-500">You don't have access to any application yet.</p>
          <p className="mt-1 text-sm text-gray-400">Contact your administrator to request access.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {appMemberships.map((m) => (
            <AppCard
              key={`${m.client_id}:${m.app_id}`}
              membership={m}
              onOpenRuntime={() => openRuntime(m)}
              onOpenDesign={() => openDesign(m)}
            />
          ))}
        </div>
      )}

      {canCreateApp && <CreateAppDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  )
}

function CreateAppDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const createMutation = useCreateApp()
  const [name, setName] = useState('')

  const canSubmit = name.trim() !== ''

  const submit = () => {
    createMutation.mutate({ name: name.trim() }, {
      onSuccess: () => {
        onOpenChange(false)
        setName('')
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setName('') }}>
      <DialogContent className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle>New application</DialogTitle>
          <DialogDescription>
            Creates an empty application with default roles under this client. Workflows, forms, and design are
            configured after creation, from the app's Edit design shell.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-4">
          <div>
            <Label className="mb-1 block text-xs font-medium text-gray-600">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Support Portal"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) submit() }}
            />
          </div>
          {createMutation.isError && (
            <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle size={13} />Failed to create application</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>Cancel</Button>
          <Button size="sm" disabled={!canSubmit || createMutation.isPending} onClick={submit} className="gap-1.5">
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AppCard({ membership, onOpenRuntime, onOpenDesign }: {
  membership: Membership
  onOpenRuntime: () => void
  onOpenDesign: () => void
}) {
  const canDesign = hasPermission(membership.permissions, 'application:design')

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <button className="min-w-0 flex-1 text-left" onClick={onOpenRuntime}>
            <CardTitle className="truncate">{membership.app_name || membership.app_id}</CardTitle>
            <CardDescription className="mt-1 text-xs">{membership.role}</CardDescription>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            {canDesign && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenDesign() }}
                title="Edit design"
                aria-label="Edit design"
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
              >
                <PencilRuler size={14} />
              </button>
            )}
            <button onClick={onOpenRuntime} title="Open" aria-label="Open" className="rounded-md p-1 text-gray-300">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

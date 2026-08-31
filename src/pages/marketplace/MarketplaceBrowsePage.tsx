import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Store, Search, Download, Loader2, AlertCircle, Lock, Globe, Layers, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useBrowseMarketplace, usePublicListing, useInstallListing } from '@/features/marketplace/hooks'
import { usePermission } from '@/features/auth/permissions'
import { useAuthStore } from '@/stores/auth'
import { extractApiError } from '@/lib/api'
import type { PublicListing, InstallResult } from '@/features/marketplace/types'

const RESOURCE_LABELS: Record<string, string> = {
  forms: 'Forms', workflows: 'Workflows', menus: 'Menus',
  roles: 'Roles', agents: 'Agents', credentials: 'Credentials',
}

// Browsing is a primary, bookmarkable destination (a full page under the
// global shell, alongside Home/Team/Model Providers) rather than a modal
// picker — you arrive here to look around, not mid-flow inside another task.
export function MarketplaceBrowsePage() {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: listings, isLoading } = useBrowseMarketplace({ search })

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Marketplace</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Install a published app as a new application in your account. Installing copies the app's design — forms,
          workflows, menus, roles, and agents — and never its data: installed forms start empty.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search listings…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center"><Spinner /></div>
      ) : !listings?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-12 text-center">
          <Store size={32} className="mb-3 text-[hsl(var(--muted-foreground))]/60" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            {search ? 'No listings match your search' : 'Nothing published yet'}
          </p>
          <p className="mt-1 max-w-sm text-[12px] text-[hsl(var(--muted-foreground))]">
            {search
              ? 'Try a different search term.'
              : 'Public listings appear here once approved. Privately shared listings appear only for the account they were shared with.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} onOpen={() => setSelectedId(l.id)} />
          ))}
        </div>
      )}

      <ListingDetailDialog listingId={selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null) }} />
    </div>
  )
}

function ListingCard({ listing, onOpen }: { listing: PublicListing; onOpen: () => void }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="cursor-pointer transition-colors hover:border-[hsl(var(--primary))]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{listing.name}</CardTitle>
          {listing.visibility === 'private' ? (
            <Badge variant="outline" className="shrink-0 gap-1 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]">
              <Lock size={10} /> Shared with you
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 gap-1 text-[hsl(var(--muted-foreground))]">
              <Globe size={10} /> Public
            </Badge>
          )}
        </div>
        <CardDescription className="line-clamp-2">{listing.description || 'No description.'}</CardDescription>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-[hsl(var(--muted-foreground))]">
          {listing.category && <span>{listing.category}</span>}
          <span>{listing.install_count} install{listing.install_count === 1 ? '' : 's'}</span>
        </div>
      </CardHeader>
    </Card>
  )
}

function ListingDetailDialog({ listingId, onOpenChange }: { listingId: string | null; onOpenChange: (open: boolean) => void }) {
  const { data: listing, isLoading } = usePublicListing(listingId)
  const canInstall = usePermission('marketplace:install')
  const [installOpen, setInstallOpen] = useState(false)

  const resourceEntries = Object.entries(listing?.resources ?? {}).filter(([, n]) => n > 0)

  return (
    <>
      <Dialog open={listingId != null && !installOpen} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-lg">
          <DialogHeader>
            <DialogTitle>{listing?.name ?? ''}</DialogTitle>
            {listing && (
              <DialogDescription>
                {listing.category ? `${listing.category} · ` : ''}
                {listing.install_count} install{listing.install_count === 1 ? '' : 's'}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto px-6 py-2">
            {isLoading ? (
              <div className="flex h-24 items-center justify-center"><Spinner /></div>
            ) : !listing ? null : (
              <div className="space-y-4">
                {listing.description && (
                  <p className="text-sm text-[hsl(var(--foreground))]">{listing.description}</p>
                )}

                {resourceEntries.length > 0 && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                      <Layers size={12} /> What you'll get
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      {resourceEntries.map(([resource, count]) => (
                        <div key={resource} className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1.5">
                          <span className="font-medium text-[hsl(var(--foreground))]">{count}</span>{' '}
                          <span className="text-[hsl(var(--muted-foreground))]">{RESOURCE_LABELS[resource] ?? resource}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="flex items-start gap-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  Installing creates a brand-new app in your account. No records are copied — installed forms start
                  empty — and credential values are never included, so anything the source app connected to will need
                  reconfiguring here.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
            {canInstall && listing && (
              <Button size="sm" className="gap-1.5" onClick={() => setInstallOpen(true)}>
                <Download size={13} /> Install
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {listing && (
        <InstallDialog
          open={installOpen}
          listingId={listing.id}
          defaultName={listing.name}
          onOpenChange={(open) => {
            setInstallOpen(open)
            if (!open) onOpenChange(false)
          }}
        />
      )}
    </>
  )
}

/** Slugify a listing name into a URL-safe default — the same shape the
 *  backend's own slug columns expect, so the field arrives pre-filled and
 *  usually needs no edit. */
function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

function InstallDialog({
  open, listingId, defaultName, onOpenChange,
}: {
  open: boolean
  listingId: string
  defaultName: string
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const setActiveMembership = useAuthStore((s) => s.setActiveMembership)
  const installMutation = useInstallListing()
  const [name, setName] = useState(defaultName)
  const [slug, setSlug] = useState(slugify(defaultName))
  const [result, setResult] = useState<InstallResult | null>(null)

  const handleClose = (o: boolean) => {
    if (!o) {
      setResult(null)
      setName(defaultName)
      setSlug(slugify(defaultName))
    }
    onOpenChange(o)
  }

  const handleInstall = async () => {
    try {
      const res = await installMutation.mutateAsync({ id: listingId, payload: { name, slug } })
      // Warnings are shown in-dialog rather than as a toast — an installer
      // needs to actually read them (see InstallResult.warnings' own note).
      // With none, there's nothing to hold the dialog open for.
      if (res.warnings?.length) {
        setResult(res)
      } else {
        toast.success(`Installed "${res.name}"`)
        handleClose(false)
        openInstalledApp(res.app_id)
      }
    } catch (e) {
      toast.error('Install failed', { description: extractApiError(e) })
    }
  }

  const openInstalledApp = (appId: string) => {
    const session = useAuthStore.getState().session
    const membership = session?.memberships?.find((m) => m.app_id === appId)
    if (membership) setActiveMembership(membership)
    navigate({ to: '/applications/$appId', params: { appId } })
  }

  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[hsl(var(--success))]" />
              Installed "{result.name}"
            </DialogTitle>
            <DialogDescription>
              The app was created, but some references couldn't carry over and need your attention before it will
              run correctly.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[40vh] overflow-y-auto border-y border-[hsl(var(--border))] px-6 py-3">
            <ul className="space-y-1.5 text-[12px]">
              {result.warnings?.map((warning, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[hsl(var(--foreground))]">
                  <AlertCircle size={13} className="mt-0.5 shrink-0 text-[hsl(var(--warning))]" />
                  <span>
                    <span className="font-mono text-[11px] opacity-80">{warning.path}</span> — {warning.message}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => handleClose(false)}>Close</Button>
            <Button size="sm" onClick={() => { handleClose(false); openInstalledApp(result.app_id) }}>
              Open app
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Install as a new app</DialogTitle>
          <DialogDescription>
            Creates a new application in your account from this listing. Your existing apps are untouched.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Name</label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSlug(slugify(e.target.value))
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Slug</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleClose(false)} disabled={installMutation.isPending}>Cancel</Button>
          <Button size="sm" className="gap-1.5" onClick={handleInstall} disabled={!name || !slug || installMutation.isPending}>
            {installMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Install
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Store, Loader2, AlertCircle, Lock, Globe, Send, RefreshCw, Trash2, Plus, Clock,
  CheckCircle2, XCircle, FileEdit, EyeOff, Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  useListing, useGrants, usePublishListing, useUpdateListing, useResnapshotListing,
  useSubmitListing, useUnpublishListing, useCreateGrant, useRevokeGrant,
} from '@/features/marketplace/hooks'
import { usePermission } from '@/features/auth/permissions'
import { extractApiError } from '@/lib/api'
import type { Listing, ListingStatus, ListingVisibility } from '@/features/marketplace/types'

const STATUS_META: Record<ListingStatus, { label: string; icon: typeof Clock; className: string; blurb: string }> = {
  draft: {
    label: 'Draft', icon: FileEdit,
    className: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
    blurb: 'Not shared with anyone yet. Submit it when you\'re ready.',
  },
  pending_review: {
    label: 'Awaiting review', icon: Clock,
    className: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]',
    blurb: 'Submitted for review. It stays hidden from the marketplace until the admin team approves it.',
  },
  approved: {
    label: 'Live', icon: CheckCircle2,
    className: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]',
    blurb: 'Published and installable.',
  },
  rejected: {
    label: 'Rejected', icon: XCircle,
    className: 'bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]',
    blurb: 'The admin team sent this back. Edit it to address the feedback — saving returns it to draft so you can resubmit.',
  },
  unpublished: {
    label: 'Unpublished', icon: EyeOff,
    className: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
    blurb: 'Withdrawn from the marketplace. Anyone who already installed it keeps their copy.',
  },
}

export function MarketplaceSection() {
  const { data: listing, isLoading } = useListing()
  const canWrite = usePermission('marketplace:write')

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Marketplace</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Publish this app as an installable template — share it privately with specific people, or list it publicly
          for anyone (which the admin team reviews first). A listing captures a snapshot of the app at publish time
          and doesn't track later changes until you re-publish.
        </p>
      </div>

      {listing ? (
        <ListingPanel listing={listing} canWrite={canWrite} />
      ) : (
        <UnpublishedState canWrite={canWrite} />
      )}
    </div>
  )
}

function UnpublishedState({ canWrite }: { canWrite: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-12 text-center">
        <Store size={24} className="mb-3 text-[hsl(var(--muted-foreground))]" />
        <p className="mb-1 text-sm font-medium text-[hsl(var(--foreground))]">This app isn't published</p>
        <p className="mb-5 max-w-sm text-[12px] text-[hsl(var(--muted-foreground))]">
          Publishing creates a listing pinned to a snapshot of this app's current state. Nothing is shared until you
          submit it.
        </p>
        {canWrite && (
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Store size={13} /> Publish to marketplace
          </Button>
        )}
      </div>
      <ListingFormDialog open={open} onOpenChange={setOpen} mode="publish" />
    </>
  )
}

function ListingPanel({ listing, canWrite }: { listing: Listing; canWrite: boolean }) {
  const [editOpen, setEditOpen] = useState(false)
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)
  const submitMutation = useSubmitListing()
  const resnapshotMutation = useResnapshotListing()
  const unpublishMutation = useUnpublishListing()

  const meta = STATUS_META[listing.status]
  const StatusIcon = meta.icon
  const isPrivate = listing.visibility === 'private'

  const handleSubmit = async () => {
    try {
      const res = await submitMutation.mutateAsync()
      toast.success(res.status === 'approved' ? 'Listing is live' : 'Submitted for review')
    } catch (e) {
      toast.error('Could not submit', { description: extractApiError(e) })
    }
  }

  const handleResnapshot = async () => {
    try {
      const res = await resnapshotMutation.mutateAsync()
      toast.success(
        res.status === 'draft'
          ? 'Re-published from current state — resubmit for review'
          : 'Re-published from current state',
      )
    } catch (e) {
      toast.error('Could not re-publish', { description: extractApiError(e) })
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${meta.className}`}>
            <StatusIcon size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-[hsl(var(--foreground))]">{listing.name}</p>
              <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
              <Badge variant="outline" className="gap-1 text-[hsl(var(--muted-foreground))]">
                {isPrivate ? <><Lock size={10} /> Private</> : <><Globe size={10} /> Public</>}
              </Badge>
            </div>
            <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">{meta.blurb}</p>
            {listing.description && (
              <p className="mt-2 text-[13px] text-[hsl(var(--foreground))]">{listing.description}</p>
            )}
            <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
              {listing.category ? `${listing.category} · ` : ''}
              {listing.install_count} install{listing.install_count === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {listing.status === 'rejected' && listing.rejection_reason && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 px-3 py-2 text-[12px] text-[hsl(var(--destructive))]">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span><span className="font-medium">Reviewer feedback:</span> {listing.rejection_reason}</span>
          </div>
        )}

        {canWrite && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[hsl(var(--border))] pt-4">
            {listing.status === 'draft' && (
              <Button size="sm" className="gap-1.5" onClick={handleSubmit} disabled={submitMutation.isPending}>
                {submitMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {isPrivate ? 'Share privately' : 'Submit for review'}
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <FileEdit size={13} /> Edit details
            </Button>
            <Button
              variant="outline" size="sm" className="gap-1.5"
              onClick={handleResnapshot} disabled={resnapshotMutation.isPending}
              title="Update the listing to match this app's current state"
            >
              {resnapshotMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Re-publish current state
            </Button>
            {listing.status !== 'unpublished' && (
              <Button
                variant="ghost" size="sm"
                className="ml-auto gap-1.5 text-[hsl(var(--destructive))]"
                onClick={() => setConfirmUnpublish(true)}
              >
                <EyeOff size={13} /> Unpublish
              </Button>
            )}
          </div>
        )}
      </div>

      {isPrivate && <GrantsPanel canWrite={canWrite} />}

      <ListingFormDialog open={editOpen} onOpenChange={setEditOpen} mode="edit" listing={listing} />

      <Dialog open={confirmUnpublish} onOpenChange={setConfirmUnpublish}>
        <DialogContent className="w-full max-w-sm">
          <DialogHeader>
            <DialogTitle>Unpublish this listing?</DialogTitle>
            <DialogDescription>
              It stops appearing in the marketplace and can no longer be installed. Anyone who already installed it
              keeps their copy — this doesn't affect them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmUnpublish(false)} disabled={unpublishMutation.isPending}>Cancel</Button>
            <Button
              variant="destructive" size="sm" className="gap-1.5"
              disabled={unpublishMutation.isPending}
              onClick={async () => {
                try {
                  await unpublishMutation.mutateAsync()
                  toast.success('Listing unpublished')
                  setConfirmUnpublish(false)
                } catch (e) {
                  toast.error('Could not unpublish', { description: extractApiError(e) })
                }
              }}
            >
              {unpublishMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />}
              Unpublish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ListingFormDialog({
  open, onOpenChange, mode, listing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'publish' | 'edit'
  listing?: Listing
}) {
  const publishMutation = usePublishListing()
  const updateMutation = useUpdateListing()
  const mutation = mode === 'publish' ? publishMutation : updateMutation

  const [name, setName] = useState(listing?.name ?? '')
  const [description, setDescription] = useState(listing?.description ?? '')
  const [category, setCategory] = useState(listing?.category ?? '')
  const [visibility, setVisibility] = useState<ListingVisibility>(listing?.visibility ?? 'private')

  // Re-seed from the listing each time the dialog opens, so reopening after
  // a cancel doesn't show stale edits.
  useEffect(() => {
    if (open) {
      setName(listing?.name ?? '')
      setDescription(listing?.description ?? '')
      setCategory(listing?.category ?? '')
      setVisibility(listing?.visibility ?? 'private')
    }
  }, [open, listing])

  // Editing a live PUBLIC listing sends it back for re-review (the backend
  // resets it to draft — see UpdateListingMeta). Say so before they save
  // rather than surprising them with a status change afterward.
  const willNeedReReview =
    mode === 'edit' && listing?.status === 'approved' &&
    (visibility === 'public' || listing.visibility === 'public')

  const handleSave = async () => {
    try {
      await mutation.mutateAsync({ name, description, category, visibility })
      toast.success(mode === 'publish' ? 'Listing created as a draft' : 'Listing updated')
      onOpenChange(false)
    } catch (e) {
      toast.error(mode === 'publish' ? 'Could not publish' : 'Could not update', { description: extractApiError(e) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'publish' ? 'Publish to marketplace' : 'Edit listing'}</DialogTitle>
          <DialogDescription>
            {mode === 'publish'
              ? "Captures a snapshot of this app as it is right now. It starts as a draft — nothing is shared until you submit it."
              : "These details are what people browsing the marketplace see. They don't change the app itself."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CRM Starter Template" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What this app does, and who it's for…"
              className="flex w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] shadow-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Category</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Sales" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Visibility</label>
            <Select value={visibility} onChange={(e) => setVisibility(e.target.value as ListingVisibility)}>
              <option value="private">Private — only people you share it with</option>
              <option value="public">Public — anyone, after admin review</option>
            </Select>
          </div>
          {willNeedReReview && (
            <p className="flex items-start gap-1.5 text-[12px] text-[hsl(var(--warning))]">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              This listing is live. Saving returns it to draft and it'll need to be reviewed again before it's
              installable.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={!name || mutation.isPending}>
            {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Store size={13} />}
            {mode === 'publish' ? 'Create listing' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GrantsPanel({ canWrite }: { canWrite: boolean }) {
  const { data: grants, isLoading } = useGrants(true)
  const createMutation = useCreateGrant()
  const revokeMutation = useRevokeGrant()
  const [email, setEmail] = useState('')

  const handleShare = async () => {
    try {
      await createMutation.mutateAsync({ email })
      toast.success(`Shared with ${email}`)
      setEmail('')
    } catch (e) {
      toast.error('Could not share', { description: extractApiError(e) })
    }
  }

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <p className="font-medium text-[hsl(var(--foreground))]">Shared with</p>
      <p className="mt-0.5 text-[13px] text-[hsl(var(--muted-foreground))]">
        Only these accounts can see and install this listing. They'll find it in their own Marketplace.
      </p>

      {canWrite && (
        <div className="mt-4 flex items-center gap-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && email) handleShare() }}
            placeholder="person@example.com"
            type="email"
          />
          <Button size="sm" className="shrink-0 gap-1.5" onClick={handleShare} disabled={!email || createMutation.isPending}>
            {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Share
          </Button>
        </div>
      )}

      <div className="mt-4">
        {isLoading ? (
          <div className="flex h-16 items-center justify-center"><Spinner /></div>
        ) : !grants?.length ? (
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">Not shared with anyone yet.</p>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
            {grants.map((g) => (
              <div key={g.id} className="group flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-[hsl(var(--foreground))]">{g.email}</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    {g.status === 'installed'
                      ? `Installed ${g.installed_at ? new Date(g.installed_at).toLocaleDateString() : ''}`
                      : g.status === 'revoked'
                        ? 'Revoked'
                        : `Invited ${new Date(g.created_at).toLocaleDateString()}`}
                  </p>
                </div>
                {g.status === 'pending' && (
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost" size="sm" className="gap-1 text-xs"
                      title="Copy the share link"
                      onClick={() => {
                        navigator.clipboard?.writeText(`${window.location.origin}/marketplace?share=${g.token}`)
                        toast.success('Share link copied')
                      }}
                    >
                      <Copy size={12} /> Link
                    </Button>
                    {canWrite && (
                      <Button
                        variant="ghost" size="sm"
                        className="gap-1 text-xs text-[hsl(var(--destructive))]"
                        disabled={revokeMutation.isPending}
                        onClick={async () => {
                          try {
                            await revokeMutation.mutateAsync(g.id)
                            toast.success('Share revoked')
                          } catch (e) {
                            toast.error('Could not revoke', { description: extractApiError(e) })
                          }
                        }}
                      >
                        <Trash2 size={12} /> Revoke
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

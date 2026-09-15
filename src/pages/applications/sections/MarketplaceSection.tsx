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
import { useTranslation } from '@/features/i18n/I18nProvider'

const STATUS_META: Record<ListingStatus, { labelKey: string; icon: typeof Clock; className: string; blurbKey: string }> = {
  draft: {
    labelKey: 'marketplace.draft', icon: FileEdit,
    className: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
    blurbKey: 'marketplace.draft_blurb',
  },
  pending_review: {
    labelKey: 'marketplace.awaiting_review', icon: Clock,
    className: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]',
    blurbKey: 'marketplace.review_blurb',
  },
  approved: {
    labelKey: 'marketplace.live', icon: CheckCircle2,
    className: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]',
    blurbKey: 'marketplace.live_blurb',
  },
  rejected: {
    labelKey: 'marketplace.rejected', icon: XCircle,
    className: 'bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]',
    blurbKey: 'marketplace.rejected_blurb',
  },
  unpublished: {
    labelKey: 'marketplace.unpublished', icon: EyeOff,
    className: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
    blurbKey: 'marketplace.unpublished_blurb',
  },
}

export function MarketplaceSection() {
  const t = useTranslation()
  const { data: listing, isLoading } = useListing()
  const canWrite = usePermission('marketplace:write')

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">{t('marketplace.title')}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t('marketplace.publish_description')}
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
  const t = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-12 text-center">
        <Store size={24} className="mb-3 text-[hsl(var(--muted-foreground))]" />
        <p className="mb-1 text-sm font-medium text-[hsl(var(--foreground))]">{t('marketplace.not_published')}</p>
        <p className="mb-5 max-w-sm text-[12px] text-[hsl(var(--muted-foreground))]">
          {t('marketplace.not_published_description')}
        </p>
        {canWrite && (
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Store size={13} /> {t('marketplace.publish_to_marketplace')}
          </Button>
        )}
      </div>
      <ListingFormDialog open={open} onOpenChange={setOpen} mode="publish" />
    </>
  )
}

function ListingPanel({ listing, canWrite }: { listing: Listing; canWrite: boolean }) {
  const t = useTranslation()
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
      toast.success(res.status === 'approved' ? t('marketplace.listing_live') : t('marketplace.submitted_review'))
    } catch (e) {
      toast.error(t('marketplace.could_not_publish'), { description: extractApiError(e) })
    }
  }

  const handleResnapshot = async () => {
    try {
      const res = await resnapshotMutation.mutateAsync()
      toast.success(
        res.status === 'draft'
          ? t('marketplace.republished_resubmit')
          : t('marketplace.republished_current'),
      )
    } catch (e) {
      toast.error(t('marketplace.could_not_republish'), { description: extractApiError(e) })
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
              <Badge variant="outline" className={meta.className}>{t(meta.labelKey)}</Badge>
              <Badge variant="outline" className="gap-1 text-[hsl(var(--muted-foreground))]">
                {isPrivate ? <><Lock size={10} /> {t('marketplace.private')}</> : <><Globe size={10} /> {t('marketplace.public')}</>}
              </Badge>
            </div>
            <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">{t(meta.blurbKey)}</p>
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
            <span><span className="font-medium">{t('marketplace.reviewer_feedback')}</span> {listing.rejection_reason}</span>
          </div>
        )}

        {canWrite && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[hsl(var(--border))] pt-4">
            {listing.status === 'draft' && (
              <Button size="sm" className="gap-1.5" onClick={handleSubmit} disabled={submitMutation.isPending}>
                {submitMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {isPrivate ? t('marketplace.share_privately') : t('marketplace.submit_review')}
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <FileEdit size={13} /> {t('marketplace.edit_details')}
            </Button>
            <Button
              variant="outline" size="sm" className="gap-1.5"
              onClick={handleResnapshot} disabled={resnapshotMutation.isPending}
              title={t('marketplace.update_listing_title')}
            >
              {resnapshotMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {t('marketplace.republish_current')}
            </Button>
            {listing.status !== 'unpublished' && (
              <Button
                variant="ghost" size="sm"
                className="ml-auto gap-1.5 text-[hsl(var(--destructive))]"
                onClick={() => setConfirmUnpublish(true)}
              >
                <EyeOff size={13} /> {t('marketplace.unpublish')}
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
            <DialogTitle>{t('marketplace.unpublish_title')}</DialogTitle>
            <DialogDescription>
              {t('marketplace.unpublish_description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmUnpublish(false)} disabled={unpublishMutation.isPending}>{t('common.close')}</Button>
            <Button
              variant="destructive" size="sm" className="gap-1.5"
              disabled={unpublishMutation.isPending}
              onClick={async () => {
                try {
                  await unpublishMutation.mutateAsync()
                  toast.success(t('marketplace.listing_unpublished'))
                  setConfirmUnpublish(false)
                } catch (e) {
                  toast.error(t('marketplace.unpublish_failed'), { description: extractApiError(e) })
                }
              }}
            >
              {unpublishMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />}
              {t('marketplace.unpublish')}
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
  const t = useTranslation()
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
      toast.success(mode === 'publish' ? t('marketplace.listing_created') : t('marketplace.listing_updated'))
      onOpenChange(false)
    } catch (e) {
      toast.error(mode === 'publish' ? t('marketplace.could_not_publish') : t('marketplace.could_not_update'), { description: extractApiError(e) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'publish' ? t('marketplace.publish_listing') : t('marketplace.edit_listing')}</DialogTitle>
          <DialogDescription>
            {mode === 'publish'
              ? t('marketplace.publish_dialog_description')
              : t('marketplace.edit_dialog_description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('common.name')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CRM Starter Template" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('common.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What this app does, and who it's for…"
              className="flex w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] shadow-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('marketplace.category')}</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Sales" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('marketplace.visibility')}</label>
            <Select value={visibility} onChange={(e) => setVisibility(e.target.value as ListingVisibility)}>
              <option value="private">{t('marketplace.private_option')}</option>
              <option value="public">{t('marketplace.public_option')}</option>
            </Select>
          </div>
          {willNeedReReview && (
            <p className="flex items-start gap-1.5 text-[12px] text-[hsl(var(--warning))]">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              {t('marketplace.live_rereview')}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>{t('common.close')}</Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={!name || mutation.isPending}>
            {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Store size={13} />}
            {mode === 'publish' ? t('marketplace.create_listing') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GrantsPanel({ canWrite }: { canWrite: boolean }) {
  const t = useTranslation()
  const { data: grants, isLoading } = useGrants(true)
  const createMutation = useCreateGrant()
  const revokeMutation = useRevokeGrant()
  const [email, setEmail] = useState('')

  const handleShare = async () => {
    try {
      await createMutation.mutateAsync({ email })
      toast.success(`${t('marketplace.shared_with')} ${email}`)
      setEmail('')
    } catch (e) {
      toast.error(t('marketplace.could_not_share'), { description: extractApiError(e) })
    }
  }

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <p className="font-medium text-[hsl(var(--foreground))]">{t('marketplace.shared_with')}</p>
      <p className="mt-0.5 text-[13px] text-[hsl(var(--muted-foreground))]">
        {t('marketplace.shared_with_description')}
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
            {t('marketplace.share')}
          </Button>
        </div>
      )}

      <div className="mt-4">
        {isLoading ? (
          <div className="flex h-16 items-center justify-center"><Spinner /></div>
        ) : !grants?.length ? (
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">{t('marketplace.not_shared')}</p>
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
                      title={t('marketplace.copy_share_link')}
                      onClick={() => {
                        navigator.clipboard?.writeText(`${window.location.origin}/marketplace?share=${g.token}`)
                        toast.success(t('marketplace.share_link_copied'))
                      }}
                    >
                      <Copy size={12} /> {t('marketplace.link')}
                    </Button>
                    {canWrite && (
                      <Button
                        variant="ghost" size="sm"
                        className="gap-1 text-xs text-[hsl(var(--destructive))]"
                        disabled={revokeMutation.isPending}
                        onClick={async () => {
                          try {
                            await revokeMutation.mutateAsync(g.id)
                            toast.success(t('marketplace.share_revoked'))
                          } catch (e) {
                            toast.error(t('marketplace.could_not_revoke'), { description: extractApiError(e) })
                          }
                        }}
                      >
                        <Trash2 size={12} /> {t('team.revoke')}
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

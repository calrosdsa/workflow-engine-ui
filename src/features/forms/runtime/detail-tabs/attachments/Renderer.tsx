// The "Attachments" tab — a per-record file list (ERPNext's Attachments
// sidebar panel is the reference UX). Upload/list/delete all go through
// api/forms's own /forms/{form_id}/records/{record_id}/attachments routes
// (record-detail-hooks.ts's useAttachments/useUploadAttachment/
// useDeleteAttachment), NOT the generic contentApi used by File Upload
// fields — see internal/content.OwnerRecordAttachment's doc comment for
// why. Downloading still goes through the generic presigned-URL endpoint
// (contentApi.presignedUrl): that route only needs an object id + tenant
// headers, no owner-kind-specific check, so there is no reason to duplicate
// it behind a nested route.
import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Paperclip, Upload, FileIcon, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { usePermission } from '@/features/auth/permissions'
import { contentApi } from '@/features/content/api'
import { useAttachments, useUploadAttachment, useDeleteAttachment } from '../../record-detail-hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { DetailTabRendererProps } from '../contract'
import type { AttachmentsTabConfig } from './schema'
import type { AttachmentEntry } from '@/features/forms/types'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentRow({ entry, canDelete, onDelete }: { entry: AttachmentEntry; canDelete: boolean; onDelete: () => void }) {
  // Preview/download MUST use a presigned URL, not a plain /content/{id}
  // link — GET /content/{id} requires X-Client-ID/X-App-ID headers a
  // native <a href> can never attach (see FileFieldInput.tsx's identical
  // doc comment; confirmed live there).
  const presigned = useQuery({
    queryKey: ['content', entry.id, 'presigned-url'],
    queryFn: () => contentApi.presignedUrl(entry.id),
    staleTime: 10 * 60 * 1000,
  })

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5" style={{ borderColor: 'hsl(var(--border))' }}>
      <a
        href={presigned.data?.url ?? '#'}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => { if (!presigned.data?.url) e.preventDefault() }}
        className="flex min-w-0 items-center gap-1.5 text-[13px] hover:underline"
        style={{ color: 'hsl(var(--foreground))' }}
      >
        <FileIcon size={13} className="shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
        <span className="truncate">{entry.filename}</span>
      </a>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{formatSize(entry.size_bytes)}</span>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-[hsl(var(--muted-foreground))] hover:text-red-600"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

export function AttachmentsTabRenderer({ formId, recordId }: DetailTabRendererProps<AttachmentsTabConfig>) {
  const t = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const canEdit = usePermission(`forms:${formId}:edit`)

  const { data, isLoading } = useAttachments(formId, recordId)
  const upload = useUploadAttachment(formId, recordId)
  const remove = useDeleteAttachment(formId, recordId)
  const entries = data ?? []

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setError(null)
    upload.mutate(file, { onError: () => setError(t('attachments.tab.upload_error')) })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!canEdit || upload.isPending}
          onClick={() => inputRef.current?.click()}
          title={canEdit ? undefined : t('attachments.tab.no_permission')}
        >
          {upload.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {upload.isPending ? t('attachments.tab.uploading') : t('attachments.tab.upload')}
        </Button>
        <input ref={inputRef} type="file" className="hidden" disabled={!canEdit} onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center" style={{ borderColor: 'hsl(var(--border))' }}>
          <Paperclip size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
          <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('attachments.tab.empty')}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <AttachmentRow key={entry.id} entry={entry} canDelete={canEdit} onDelete={() => setDeleteTarget(entry.id)} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('attachments.tab.delete_title')}
        description={t('attachments.tab.delete_description')}
        confirmLabel={t('attachments.tab.delete_confirm')}
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await remove.mutateAsync(deleteTarget)
          setDeleteTarget(null)
        }}
        container={document.getElementById('runtime-root')}
      />
    </div>
  )
}

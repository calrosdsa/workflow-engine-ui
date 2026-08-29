// File Upload / Image Upload field input — backs FieldRenderer's 'file' and
// 'image' cases (both map to the same backend field.TypeFile; image-vs-file
// is a frontend MIME-filter/preview distinction only, isImage below, not a
// separate FormElement.component-driven schema field). Uploads through
// contentApi (internal/content, Garage-backed) scoped to
// owner_kind=form_record / owner_resource_id=formId, then writes the
// resulting content_id back into the record via field.onChange — same
// async-resolve-then-write-id shape ReferenceFieldAutocomplete already uses
// for Form Reference fields, just uploading bytes instead of picking an
// existing record.
import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Upload, X, FileIcon, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { contentApi } from '@/features/content/api'
import type { FileFieldValue } from '@/features/content/types'
import type { FormElement } from '@/features/form-builder/schema'

interface FileFieldInputProps {
  el: FormElement
  isImage: boolean
  formId?: string
  field: { value: unknown; onChange: (v: unknown) => void }
  disabled: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// preflightCheck mirrors the backend's own rule (api/content's Upload
// handler, FR-C1-012) client-side, so an obviously-doomed upload never even
// starts — the backend check is still the real, bypass-proof enforcement
// point (see contentApi.upload's own doc comment); this is purely a faster,
// friendlier error for the common case of picking an oversized or
// wrong-type file by mistake.
function preflightCheck(file: File, el: FormElement): string | null {
  const { maxFileSizeBytes, allowedMimeTypes } = el.validation
  if (maxFileSizeBytes && file.size > maxFileSizeBytes) {
    return `File exceeds the maximum size of ${formatSize(maxFileSizeBytes)}.`
  }
  if (allowedMimeTypes?.length && !allowedMimeTypes.includes(file.type)) {
    return `File type must be one of: ${allowedMimeTypes.join(', ')}.`
  }
  return null
}

export function FileFieldInput({ el, isImage, formId, field, disabled }: FileFieldInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const value = field.value as FileFieldValue | null | undefined

  // A configured AllowedMimeTypes rule is the more specific constraint —
  // prefer it over the generic isImage-driven 'image/*' fallback.
  const acceptAttr = el.validation.allowedMimeTypes?.length
    ? el.validation.allowedMimeTypes.join(',')
    : (isImage ? 'image/*' : undefined)

  const upload = useMutation({
    mutationFn: (file: File) => {
      // formId here is the FORM DEFINITION's id (FormRenderer's own prop,
      // not a specific record) — content.Owner scopes to the form, not to
      // any one record instance, so upload works fine on a not-yet-saved
      // Create form the same as an existing record's Edit form.
      if (!formId) throw new Error('No form context available for this upload.')
      return contentApi.upload({ ownerKind: 'form_record', ownerResourceId: formId }, file, el.key)
    },
    onSuccess: (obj) => {
      setError(null)
      field.onChange({
        content_id: obj.id,
        filename: obj.filename,
        content_type: obj.content_type,
        size_bytes: obj.size_bytes,
      } satisfies FileFieldValue)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Upload failed'),
  })

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    const preflightError = preflightCheck(file, el)
    if (preflightError) {
      setError(preflightError)
      return
    }
    upload.mutate(file)
  }

  // Preview/download MUST use a presigned URL, not contentApi.downloadUrl —
  // GET /content/{id} requires X-Client-ID/X-App-ID headers (RequireTenant
  // has no cookie-only/header-less tenant resolution path,
  // internal/middleware/tenant.go), which a plain <img src>/<a href> has no
  // way to attach (those are native browser resource loads, never routed
  // through ky's beforeRequest hook) — confirmed live: an <img> pointed at
  // downloadUrl 401'd every time. A presigned URL is self-contained
  // (signed query params, no header requirement) and is exactly what this
  // endpoint exists for.
  const presigned = useQuery({
    queryKey: ['content', value?.content_id, 'presigned-url'],
    queryFn: () => contentApi.presignedUrl(value!.content_id),
    enabled: !!value?.content_id,
    staleTime: 10 * 60 * 1000, // well under the presign endpoint's own TTL (15min default, FR-F-008) so a stale cached URL doesn't linger past expiry
  })

  if (upload.isPending) {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[hsl(var(--border))] text-[12px] text-[hsl(var(--muted-foreground))]">
        <Loader2 size={16} className="animate-spin" />
        Uploading…
      </div>
    )
  }

  if (value?.content_id) {
    return (
      <div className="space-y-1.5">
        {isImage ? (
          <div className="relative w-fit">
            {presigned.data?.url ? (
              <img
                src={presigned.data.url}
                alt={value.filename}
                className="h-24 w-auto rounded-md border border-[hsl(var(--border))] object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
                <Loader2 size={16} className="animate-spin" />
              </div>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={() => field.onChange(null)}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                title="Remove image"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-md border border-[hsl(var(--border))] px-2.5 py-1.5">
            <a
              href={presigned.data?.url ?? '#'}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => { if (!presigned.data?.url) e.preventDefault() }}
              className="flex min-w-0 items-center gap-1.5 text-[13px] text-[hsl(var(--foreground))] hover:underline"
            >
              <FileIcon size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="truncate">{value.filename}</span>
            </a>
            <span className="shrink-0 text-[11px] text-[hsl(var(--muted-foreground))]">{formatSize(value.size_bytes)}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => field.onChange(null)}
                className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                title="Remove file"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}
        {!disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline"
          >
            Replace
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="gap-1.5"
      >
        <Upload size={13} />
        {isImage ? 'Upload image' : 'Upload file'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-red-600">
          <AlertCircle size={11} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

// Compact read-only rendering of a File Upload / Image Upload field's value
// (FileFieldValue) for table-cell-sized contexts — RecordsTable's List/Card
// columns, Kanban cards. FieldValueDisplay's own fix (reusing FileFieldInput
// in disabled mode) renders too large for a table cell — that component's
// thumbnail is a fixed h-24, sized for a Detail Page section, not a dense
// row. This is the same presigned-URL pattern, scaled down, with no
// Replace/Remove affordance (this context has never supported inline
// editing of any field, unlike the Detail Page's InlineFieldEditor).
import { useQuery } from '@tanstack/react-query'
import { FileIcon } from 'lucide-react'
import { contentApi } from '@/features/content/api'
import type { FileFieldValue } from '@/features/content/types'

function isFileFieldValue(v: unknown): v is FileFieldValue {
  return !!v && typeof v === 'object' && typeof (v as FileFieldValue).content_id === 'string'
}

export function FileCellDisplay({ value }: { value: unknown }) {
  if (!isFileFieldValue(value)) return <>—</>

  const isImage = value.content_type.startsWith('image/')
  const presigned = useQuery({
    queryKey: ['content', value.content_id, 'presigned-url'],
    queryFn: () => contentApi.presignedUrl(value.content_id),
    staleTime: 10 * 60 * 1000,
  })

  if (isImage) {
    return presigned.data?.url ? (
      <img
        src={presigned.data.url}
        alt={value.filename}
        className="h-8 w-8 rounded border border-[hsl(var(--border))] object-cover"
      />
    ) : (
      <div className="h-8 w-8 rounded border border-[hsl(var(--border))]" />
    )
  }

  return (
    <a
      href={presigned.data?.url ?? '#'}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => { e.stopPropagation(); if (!presigned.data?.url) e.preventDefault() }}
      className="inline-flex items-center gap-1 text-[hsl(var(--primary))] hover:underline"
    >
      <FileIcon size={12} className="shrink-0" />
      <span className="truncate">{value.filename}</span>
    </a>
  )
}

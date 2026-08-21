// FR-D2-016 — one comment in the thread. Same visual language AuditLogTab's
// entry rows already establish (Avatar + name, RecordDetailPanel.tsx) reused
// directly rather than a new avatar/name-row component.
import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { CommentEntry } from '@/features/forms/types'
import type { BasicUser } from '@/features/users/types'

function commentAuthorName(entry: CommentEntry, author: BasicUser | undefined): string {
  if (!author) return `User ${entry.author_user_id.slice(0, 8)}`
  const name = `${author.first_name ?? ''} ${author.last_name ?? ''}`.trim()
  return name || author.email
}

export function CommentRow({
  entry, author, isOwn, onEdit, onDelete, saving,
}: {
  entry: CommentEntry
  author: BasicUser | undefined
  isOwn: boolean
  onEdit: (body: string) => void | Promise<void>
  onDelete: () => void
  saving?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.body)
  const name = commentAuthorName(entry, author)

  const startEdit = () => {
    setDraft(entry.body)
    setEditing(true)
  }
  const submitEdit = async () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    await onEdit(trimmed)
    setEditing(false)
  }

  return (
    <div className="flex gap-2.5">
      <Avatar name={name} className="h-7 w-7 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium" style={{ color: 'hsl(var(--foreground))' }}>{name}</span>
          <span className="shrink-0 text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {new Date(entry.created_at).toLocaleString()}
            {entry.edited && ' (edited)'}
          </span>
        </div>
        {editing ? (
          <div className="space-y-1.5">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="text-sm" autoFocus />
            <div className="flex items-center gap-1.5">
              <Button size="sm" className="h-7 gap-1 px-2" onClick={submitEdit} disabled={saving || !draft.trim()}>
                <Check size={12} />Save
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => setEditing(false)} disabled={saving}>
                <X size={12} />Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-[13px]" style={{ color: 'hsl(var(--foreground))' }}>{entry.body}</p>
        )}
        {isOwn && !editing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={startEdit}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-[hsl(var(--accent))]"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              <Pencil size={11} />Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))]"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              <Trash2 size={11} />Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

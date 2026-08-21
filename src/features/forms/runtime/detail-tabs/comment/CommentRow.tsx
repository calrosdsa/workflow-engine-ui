// FR-D2-016 — one comment in the thread. Same visual language AuditLogTab's
// entry rows already establish (Avatar + name, RecordDetailPanel.tsx) reused
// directly rather than a new avatar/name-row component.
import { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MentionEditor, type MentionEditorHandle } from './MentionEditor'
import { MentionAutocomplete } from './MentionAutocomplete'
import { useMentionEditor } from './useMentionEditor'
import { splitMentionSegments } from './mentions'
import type { CommentEntry } from '@/features/forms/types'
import type { BasicUser } from '@/features/users/types'

function commentAuthorName(entry: CommentEntry, author: BasicUser | undefined): string {
  if (!author) return `User ${entry.author_user_id.slice(0, 8)}`
  const name = `${author.first_name ?? ''} ${author.last_name ?? ''}`.trim()
  return name || author.email
}

function mentionDisplayName(userId: string, usersById: Map<string, BasicUser>): string {
  const u = usersById.get(userId)
  if (!u) return `User ${userId.slice(0, 8)}`
  const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return name || u.email
}

export function CommentRow({
  entry, author, isOwn, onEdit, onDelete, saving, usersById,
}: {
  entry: CommentEntry
  author: BasicUser | undefined
  isOwn: boolean
  onEdit: (body: string) => void | Promise<void>
  onDelete: () => void
  saving?: boolean
  /** Resolves both author AND mentioned-user ids to display names (FR-D2-016
   *  v0.6) — the same batched GET /users/basic map CommentTabRenderer builds. */
  usersById: Map<string, BasicUser>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.body)
  const editorHandleRef = useRef<MentionEditorHandle>(null)
  const mention = useMentionEditor(() => editorHandleRef.current?.element ?? null, setDraft)
  const name = commentAuthorName(entry, author)

  const startEdit = () => setEditing(true)

  // Rebuilds the editor's chip DOM from entry.body once, the render AFTER
  // editing flips true (the <MentionEditor> element needs to exist in the
  // DOM before loadBody can populate it) — usersById is already the exact
  // same batched-resolution map CommentRow's own read-only render uses, so
  // an edit's chips show the identical names the posted view already shows.
  useEffect(() => {
    if (editing) {
      editorHandleRef.current?.loadBody(entry.body, (userId) => mentionDisplayName(userId, usersById))
      setDraft(entry.body)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const submitEdit = async () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    await onEdit(trimmed)
    setEditing(false)
  }
  const cancelEdit = () => {
    setEditing(false)
    mention.resetAfterSubmit()
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
            <MentionEditor
              ref={editorHandleRef}
              onInput={mention.onEditorInput}
              onKeyDown={(e) => { mention.onEditorKeyDown(e) }}
              placeholder="Write a comment…"
              className="text-sm"
            />
            <MentionAutocomplete
              open={mention.mentionOpen}
              query={mention.mentionQuery}
              anchor={mention.mentionAnchor}
              highlightedIndex={mention.mentionHighlighted}
              onResultsChange={mention.onMentionResultsChange}
              onSelect={mention.onMentionSelect}
              container={document.getElementById('runtime-root')}
            />
            <div className="flex items-center gap-1.5">
              <Button size="sm" className="h-7 gap-1 px-2" onClick={submitEdit} disabled={saving || !draft.trim()}>
                <Check size={12} />Save
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={cancelEdit} disabled={saving}>
                <X size={12} />Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-[13px]" style={{ color: 'hsl(var(--foreground))' }}>
            {splitMentionSegments(entry.body).map((seg, i) =>
              seg.type === 'mention' ? (
                <span key={i} className="mention-chip">
                  @{mentionDisplayName(seg.userId!, usersById)}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </p>
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

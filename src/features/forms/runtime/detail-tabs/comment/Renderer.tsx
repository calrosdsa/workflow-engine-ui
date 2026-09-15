// FR-D2-016 — the "Comments" tab. Renders only the comment thread; does not
// embed or duplicate "History" content (a separate, relabeled `audit` tab —
// see Document Control v0.2's decision for two independent tabs, not one
// tab with an internal toggle).
import { useRef, useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { usePermission } from '@/features/auth/permissions'
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from '../../record-detail-hooks'
import { useUsersBasic } from '@/features/users/hooks'
import { CommentRow } from './CommentRow'
import { MentionEditor, type MentionEditorHandle } from './MentionEditor'
import { MentionAutocomplete } from './MentionAutocomplete'
import { useMentionEditor } from './useMentionEditor'
import { parseMentionedUserIds } from './mentions'
import { useAuthStore } from '@/stores/auth'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { DetailTabRendererProps } from '../contract'
import type { CommentTabConfig } from './schema'

const PAGE_SIZE = 25

export function CommentTabRenderer({ formId, recordId }: DetailTabRendererProps<CommentTabConfig>) {
  const t = useTranslation()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useComments(formId, recordId, page, PAGE_SIZE)
  const currentUserId = useAuthStore((s) => s.session?.user_id)
  const canComment = usePermission(`forms:${formId}:comment`)

  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Batches BOTH author ids and mentioned-user ids (FR-D2-016 §4 step 2c)
  // into the same GET /users/basic call — CommentRow needs a real display
  // name for a mention span, not just for the author line.
  const mentionedIds = entries.flatMap((e) => parseMentionedUserIds(e.body))
  const authorIds = [...new Set([...entries.map((e) => e.author_user_id), ...mentionedIds])]
  const { data: authors } = useUsersBasic(authorIds)
  const authorById = new Map((authors ?? []).map((a) => [a.id, a]))

  const createComment = useCreateComment(formId, recordId)
  const updateComment = useUpdateComment(formId, recordId)
  const deleteComment = useDeleteComment(formId, recordId)

  const [draft, setDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const editorHandleRef = useRef<MentionEditorHandle>(null)
  const mention = useMentionEditor(() => editorHandleRef.current?.element ?? null, setDraft)

  const submit = async () => {
    const body = draft.trim()
    if (!body) return
    await createComment.mutateAsync(body)
    editorHandleRef.current?.clear()
    mention.resetAfterSubmit()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <MentionEditor
          ref={editorHandleRef}
          onInput={mention.onEditorInput}
          onKeyDown={(e) => { mention.onEditorKeyDown(e) }}
          placeholder={canComment ? t('comment.tab.write_placeholder') : t('comment.tab.no_permission')}
          disabled={!canComment || createComment.isPending}
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
        <div className="flex justify-end">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={submit}
            disabled={!canComment || createComment.isPending || !draft.trim()}
            title={canComment ? undefined : t('comment.tab.no_permission')}
          >
            <Send size={12} />
            {createComment.isPending ? t('comment.tab.posting') : t('comment.tab.comment_button')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center" style={{ borderColor: 'hsl(var(--border))' }}>
          <MessageSquare size={20} style={{ color: 'hsl(var(--muted-foreground))' }} />
          <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('comment.tab.no_comments')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <CommentRow
              key={entry.id}
              entry={entry}
              author={authorById.get(entry.author_user_id)}
              usersById={authorById}
              isOwn={!!currentUserId && entry.author_user_id === currentUserId}
              saving={updateComment.isPending}
              onEdit={async (body) => {
                await updateComment.mutateAsync({ commentId: entry.id, body })
              }}
              onDelete={() => setDeleteTarget(entry.id)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <span>{t('common.page_of', { page, totalPages })}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-7 px-2">{t('common.prev')}</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-7 px-2">{t('common.next')}</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('comment.tab.delete_confirm_title')}
        description={t('comment.tab.delete_confirm_description')}
        confirmLabel={t('common.delete')}
        destructive
        loading={deleteComment.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteComment.mutateAsync(deleteTarget)
          setDeleteTarget(null)
        }}
        container={document.getElementById('runtime-root')}
      />
    </div>
  )
}

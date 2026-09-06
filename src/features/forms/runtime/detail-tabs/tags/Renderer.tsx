// The "Tags" tab — free-text labels on a record (ERPNext's Tags sidebar
// panel is the reference UX). A native <datalist> backs the "reuse an
// existing tag" autocomplete (useTagSuggestions) rather than a custom
// dropdown component — this input has no other affordance worth the extra
// weight (single value, Enter-to-add, no multi-select).
import { useId, useState } from 'react'
import { Tag as TagIcon, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermission } from '@/features/auth/permissions'
import { useTags, useAddTag, useRemoveTag, useTagSuggestions } from '../../record-detail-hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { DetailTabRendererProps } from '../contract'
import type { TagsTabConfig } from './schema'

export function TagsTabRenderer({ formId, recordId }: DetailTabRendererProps<TagsTabConfig>) {
  const t = useTranslation()
  const listId = useId()
  const [draft, setDraft] = useState('')
  const canEdit = usePermission(`forms:${formId}:edit`)

  const { data, isLoading } = useTags(formId, recordId)
  const { data: suggestions } = useTagSuggestions(formId)
  const addTag = useAddTag(formId, recordId)
  const removeTag = useRemoveTag(formId, recordId)
  const entries = data?.entries ?? []
  const existing = new Set(entries.map((e) => e.tag.toLowerCase()))

  const submit = () => {
    const tag = draft.trim()
    if (!tag || existing.has(tag.toLowerCase())) return
    addTag.mutate(tag)
    setDraft('')
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex gap-1.5">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
            placeholder={t('tags.tab.placeholder')}
            list={listId}
            disabled={addTag.isPending}
            className="h-8 text-sm"
          />
          <datalist id={listId}>
            {(suggestions?.tags ?? []).filter((s) => !existing.has(s.toLowerCase())).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" disabled={!draft.trim() || addTag.isPending} onClick={submit}>
            <Plus size={13} />
            {t('tags.tab.add')}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-center" style={{ borderColor: 'hsl(var(--border))' }}>
          <TagIcon size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />
          <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('tags.tab.empty')}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry) => (
            <Badge key={entry.id} variant="secondary" className="gap-1 pr-1.5">
              {entry.tag}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => removeTag.mutate(entry.id)}
                  title={t('tags.tab.remove')}
                  className="rounded-full hover:text-red-600"
                >
                  <X size={11} />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

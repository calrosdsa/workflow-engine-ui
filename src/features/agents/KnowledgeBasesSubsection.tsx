import { BookOpen } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { usePermission } from '@/features/auth/permissions'
import { useKnowledgeBases } from '@/features/knowledge/hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface KnowledgeBasesSubsectionProps {
  selected: string[]
  onChange: (ids: string[]) => void
  canWrite: boolean
}

/** The knowledge bases this Agent can search. The list is every knowledge
 *  base the app can read -- its own and the ones other apps share with it --
 *  which is exactly what the server accepts on save. The Agent gets a search
 *  tool over the checked ones, with no approval step, since searching only
 *  reads. An attached knowledge base the app can no longer read (deleted, or
 *  no longer shared) is dropped the next time this list is changed.
 *
 *  Attaching a knowledge base lets anyone who chats with the Agent read it,
 *  so the engine requires knowledge:read to attach one; without it this
 *  section explains that instead of listing knowledge bases it can't show. */
export function KnowledgeBasesSubsection({ selected, onChange, canWrite }: KnowledgeBasesSubsectionProps) {
  const t = useTranslation()
  const canViewKnowledge = usePermission('knowledge:read')
  const { data, isLoading } = useKnowledgeBases()
  const bases = data ?? []
  const readable = new Set(bases.map((kb) => kb.id))
  const unavailable = isLoading ? 0 : selected.filter((id) => !readable.has(id)).length

  const toggle = (id: string, checked: boolean) => {
    const kept = selected.filter((s) => s !== id && readable.has(s))
    onChange(checked ? [...kept, id] : kept)
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{t('agents.knowledge.title')}</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('agents.knowledge.description')}</p>
      </div>

      {!canViewKnowledge ? (
        <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
          {t('agents.knowledge.no_permission')}
        </p>
      ) : isLoading ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('agents.knowledge.loading')}</p>
      ) : bases.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
          {t('agents.knowledge.empty')}
        </p>
      ) : (
        <div className="space-y-2">
          {bases.map((kb) => {
            const checkboxId = `agent-kb-${kb.id}`
            return (
              <div key={kb.id} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                <Checkbox
                  id={checkboxId}
                  checked={selected.includes(kb.id)}
                  onCheckedChange={(checked) => toggle(kb.id, checked === true)}
                  disabled={!canWrite}
                />
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                  <BookOpen size={14} />
                </div>
                <label htmlFor={checkboxId} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block truncate text-xs font-medium text-[hsl(var(--foreground))]">{kb.name}</span>
                  {kb.description && (
                    <span className="block truncate text-[11px] text-[hsl(var(--muted-foreground))]">{kb.description}</span>
                  )}
                </label>
              </div>
            )
          })}
        </div>
      )}

      {canViewKnowledge && unavailable > 0 && (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
          {t('agents.knowledge.unavailable', { count: unavailable })}
        </p>
      )}
    </section>
  )
}

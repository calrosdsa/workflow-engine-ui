// Renders the ERPNext-style tile grid: one tile per configured connection,
// grouped under category headers, each with a record count and a "+"
// quick-create. Permission-filtered client-side (server-side is the real
// boundary — see connections-count's own "omit, don't disclose" contract).
import { useContext, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RuntimeLink } from '@/features/runtime/RuntimeLink'
import { RecordsTable } from '../../RecordsTable'
import { hasPermission } from '@/features/auth/permissions'
import { useAuthStore } from '@/stores/auth'
import { RuntimeSnapshotContext } from '@/features/runtime/snapshot-context'
import { useConnectionCounts } from '../../record-detail-hooks'
import { QuickCreateDialog } from './QuickCreateDialog'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { localizeFormName } from '@/features/form-builder/localize-schema'
import type { DetailTabRendererProps } from '../contract'
import type { ConnectionsEntry, ConnectionsTabConfig } from './schema'
import { connectionKey } from './schema'
import type { FilterGroup } from '@/features/workflows/types'
import { useTranslation, useI18n } from '@/features/i18n/I18nProvider'

// Same base-relationship filter shape related_form/Renderer.tsx's
// buildLinkFilter already uses — the condition's own id only needs to be
// unique within one filter tree.
function buildLinkFilter(fieldName: string, recordId: string): FilterGroup {
  return {
    combinator: 'and',
    conditions: [{ id: `link-${fieldName}-${recordId}`, field: fieldName, op: 'eq', value_mode: 'static', value: recordId }],
    groups: [],
  }
}

function useActiveMembership() {
  return useAuthStore((s) => s.activeMembership)
}

function Tile({ entry, formId, recordId, count, canCreate, expanded, onToggleExpand }: {
  entry: ConnectionsEntry
  formId: string
  recordId: string
  count: number | undefined
  canCreate: boolean
  expanded: boolean
  onToggleExpand: () => void
}) {
  const t = useTranslation()
  const { tc } = useI18n()
  const [creating, setCreating] = useState(false)
  const membership = useActiveMembership()
  const snapshot = useContext(RuntimeSnapshotContext)
  const targetMenuSlug = entry.targetMenuId ? snapshot?.menus.find((m) => m.id === entry.targetMenuId)?.slug : undefined
  // Falls back through: explicit label -> the target form's own (localized)
  // name -> the raw id as a last resort while the form def is still loading.
  const { data: targetForm } = useFormDef(entry.targetFormId)

  const quickCreate = entry.quickCreate ?? 'dialog'
  const label = entry.label || (targetForm ? localizeFormName(entry.targetFormId, targetForm.name, tc) : entry.targetFormId)

  const createTooltip = t('connections.tile.create_tooltip', { form: label })
  const expandTooltip = t('connections.tile.expand_tooltip', { form: label })

  const body = (
    <>
      <span className="truncate text-xs font-medium" style={{ color: 'hsl(var(--foreground))' }}>{label}</span>
      {count !== undefined ? (
        <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">{count}</Badge>
      ) : (
        <span className="ml-auto shrink-0 text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('connections.tab.count_unknown')}</span>
      )}
    </>
  )

  return (
    <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5" style={{ borderColor: 'hsl(var(--border))' }}>
      {membership && targetMenuSlug ? (
        <RuntimeLink
          to={`/${membership.client_id}/${membership.app_id}/${targetMenuSlug}?linkField=${encodeURIComponent(entry.targetFieldName)}&linkValue=${encodeURIComponent(recordId)}`}
          className="flex min-w-0 flex-1 items-center gap-1.5"
          title={expandTooltip}
        >
          {body}
        </RuntimeLink>
      ) : (
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          title={expandTooltip}
        >
          {body}
        </button>
      )}

      {canCreate && quickCreate !== 'off' && (
        quickCreate === 'page' && membership ? (
          <RuntimeLink
            to={`/${membership.client_id}/${membership.app_id}/forms/${entry.targetFormId}/new`}
            title={createTooltip}
          >
            <Plus size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
          </RuntimeLink>
        ) : (
          <Button
            variant="ghost" size="sm" className="h-6 w-6 shrink-0 p-0"
            onClick={() => setCreating(true)}
            title={createTooltip}
            aria-label={createTooltip}
          >
            <Plus size={14} />
          </Button>
        )
      )}

      {creating && (
        <QuickCreateDialog
          formId={formId}
          recordId={recordId}
          targetFormId={entry.targetFormId}
          targetFieldName={entry.targetFieldName}
          open={creating}
          onOpenChange={setCreating}
        />
      )}

      {!targetMenuSlug && expanded && (
        <div className="absolute inset-x-0 top-full z-10 mt-1">
          <RecordsTable formId={entry.targetFormId} defaultFilter={buildLinkFilter(entry.targetFieldName, recordId)} rowClick />
        </div>
      )}
    </div>
  )
}

export function ConnectionsTabRenderer({ formId, recordId, config }: DetailTabRendererProps<ConnectionsTabConfig>) {
  const t = useTranslation()
  const membership = useActiveMembership()
  const permissions = membership?.permissions ?? []
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const visible = useMemo(
    () => config.connections.filter((e) => hasPermission(permissions, `forms:${e.targetFormId}:view`)),
    [config.connections, permissions],
  )

  const targets = useMemo(
    () => visible.map((e) => ({ target_form_id: e.targetFormId, target_field_name: e.targetFieldName })),
    [visible],
  )
  const { data: countsData } = useConnectionCounts(formId, recordId, targets)
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of countsData?.counts ?? []) m.set(`${c.target_form_id}:${c.target_field_name}`, c.count)
    return m
  }, [countsData])

  const categoryOrder = config.categoryOrder ?? []
  const grouped = useMemo(() => {
    const buckets = new Map<string | undefined, ConnectionsEntry[]>()
    for (const e of visible) {
      const key = e.category
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(e)
    }
    const order: (string | undefined)[] = [undefined, ...categoryOrder]
    for (const key of buckets.keys()) {
      if (key !== undefined && !order.includes(key)) order.push(key)
    }
    return order.filter((k) => buckets.has(k)).map((k) => ({ category: k, entries: buckets.get(k)! }))
  }, [visible, categoryOrder])

  if (visible.length === 0) {
    return <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('connections.tab.empty')}</p>
  }

  return (
    <div className="space-y-4">
      {grouped.map(({ category, entries }) => (
        <div key={category ?? '__ungrouped__'} className="space-y-1.5">
          {category && (
            <h4 className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))' }}>{category}</h4>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {entries.map((entry) => {
              const key = connectionKey(entry)
              return (
                <div key={key} className="relative">
                  <Tile
                    entry={entry}
                    formId={formId}
                    recordId={recordId}
                    count={counts.get(key)}
                    canCreate={hasPermission(permissions, `forms:${entry.targetFormId}:create`)}
                    expanded={expandedKey === key}
                    onToggleExpand={() => setExpandedKey((k) => (k === key ? null : key))}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

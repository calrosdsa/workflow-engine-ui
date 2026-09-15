import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, Trash2, Play, ExternalLink, GripVertical } from 'lucide-react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useWorkflows, useDeleteWorkflow, useReorderWorkflows } from '@/features/workflows/hooks'
import { useTriggerExecution } from '@/features/executions/hooks'
import { useForms } from '@/features/forms/hooks'
import { usePermission } from '@/features/auth/permissions'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { WorkflowDefinition, TriggerConfig } from '@/features/workflows/types'
import { useI18n } from '@/features/i18n/I18nProvider'

/** Pulls the Trigger root node's config out of a saved definition, if any —
 *  same lookup api/workflows/handler.go's triggerConfig does server-side.
 *  A definition with no Trigger node (or an unparsable one) has no automatic
 *  dispatch behavior, so its position in the list is informational only. */
function getTriggerConfig(wf: WorkflowDefinition): TriggerConfig | null {
  const node = wf.definition.nodes?.find((n) => n.type === 'trigger')
  if (!node) return null
  return node.configuration as TriggerConfig
}

const MODE_LABEL_KEY: Record<string, string> = {
  before: 'workflows.list.before',
  after: 'workflows.list.after',
  after_async: 'workflows.list.after_async',
  scheduled: 'workflows.list.scheduled',
  on_demand: 'workflows.list.on_demand',
}

const MODE_STYLE: Record<string, string> = {
  before: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30',
  after: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30',
  after_async: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30',
  scheduled: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  on_demand: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
}

export function WorkflowsPage() {
  const { t, locale } = useI18n()
  const { data: workflows, isLoading } = useWorkflows()
  const deleteMutation = useDeleteWorkflow()
  const reorderMutation = useReorderWorkflows()
  const triggerMutation = useTriggerExecution()
  const { data: forms } = useForms()
  const [triggeredId, setTriggeredId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const canWrite = usePermission('workflows:write')
  const canTrigger = usePermission('executions:write')
  const appId = useAuthStore((s) => s.activeMembership?.app_id) ?? ''

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (isLoading) return <PageLoader />

  // Server already returns rows ORDER BY sort_order ASC (internal/store/definitions.go)
  // — this is the same order the trigger dispatcher executes same-event workflows in.
  const ordered = workflows ?? []
  const formNameById = new Map((forms ?? []).map((f) => [f.id, f.name]))

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const fromIdx = ordered.findIndex((w) => w.id === active.id)
    const toIdx = ordered.findIndex((w) => w.id === over.id)
    if (fromIdx === -1 || toIdx === -1) return
    const next = arrayMove(ordered, fromIdx, toIdx)
    reorderMutation.mutate({ ordered_ids: next.map((w) => w.id) })
  }

  const move = (id: string, dir: -1 | 1) => {
    const idx = ordered.findIndex((w) => w.id === id)
    const swapWith = idx + dir
    if (idx === -1 || swapWith < 0 || swapWith >= ordered.length) return
    const next = arrayMove(ordered, idx, swapWith)
    reorderMutation.mutate({ ordered_ids: next.map((w) => w.id) })
  }

  const activeWorkflow = activeId ? ordered.find((w) => w.id === activeId) : null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{t('workflows.list.title')}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {t('workflows.list.count_and_order', { count: ordered.length })}
          </p>
        </div>
        {canWrite && (
          <Link to="/applications/$appId/workflows/new" params={{ appId }}>
          <Button><Plus size={16} />{t('workflows.list.new')}</Button>
          </Link>
        )}
      </div>

      {triggeredId && (
        <div className="rounded-md bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/30 p-3 text-sm text-[hsl(var(--primary))]">
        {t('workflows.list.triggered')} <Link to="/applications/$appId/executions/$executionId" params={{ appId, executionId: triggeredId }} className="underline font-medium">{t('workflows.list.track_here')}</Link>
        </div>
      )}

      {!ordered.length ? (
        <EmptyState canWrite={canWrite} appId={appId} />
      ) : (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <p className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/60 px-4 py-2 text-xs text-[hsl(var(--muted-foreground))]">
            {t('workflows.list.order_hint')}
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={ordered.map((w) => w.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-[hsl(var(--border))]">
                {ordered.map((wf, index) => (
                  <WorkflowRow
                    key={wf.id}
                    appId={appId}
                    wf={wf}
                    index={index}
                    count={ordered.length}
                    triggerCfg={getTriggerConfig(wf)}
                    formName={(() => {
                      const cfg = getTriggerConfig(wf)
                      return cfg?.form_id ? formNameById.get(cfg.form_id) : undefined
                    })()}
                    canWrite={canWrite}
                    canTrigger={canTrigger}
                    onDelete={() => deleteMutation.mutate(wf.id)}
                    onTrigger={() => triggerMutation.mutate(wf.id, { onSuccess: (r) => setTriggeredId(r.execution_id) })}
                    isTriggering={triggerMutation.isPending}
                    onMove={(dir) => move(wf.id, dir)}
                    locale={locale}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.2,0,0,1)' }}>
              {activeWorkflow && (
                <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--primary))]/40 bg-[hsl(var(--card))] px-3 py-2 text-sm font-medium text-[hsl(var(--foreground))] shadow-lg">
                  <GripVertical size={14} className="text-[hsl(var(--primary))]" />
                  {activeWorkflow.name}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  )
}

function WorkflowRow({
  appId, wf, index, count, triggerCfg, formName, canWrite, canTrigger, onDelete, onTrigger, isTriggering, onMove, locale,
}: {
  appId: string
  wf: WorkflowDefinition
  index: number
  count: number
  triggerCfg: TriggerConfig | null
  formName?: string
  canWrite: boolean
  canTrigger: boolean
  onDelete: () => void
  onTrigger: () => void
  isTriggering: boolean
  onMove: (dir: -1 | 1) => void
  locale: string
}) {
  const t = useI18n().t
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: wf.id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  const modeKey = triggerCfg?.mode
  const modeLabel = modeKey ? t(MODE_LABEL_KEY[modeKey] ?? modeKey) : null
  const modeStyle = modeKey ? MODE_STYLE[modeKey] ?? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]' : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('group flex items-center gap-3 px-4 py-3', isDragging && 'opacity-50 bg-[hsl(var(--muted))]')}
    >
      <span className="w-6 shrink-0 text-center text-xs font-mono text-[hsl(var(--muted-foreground))]/60">{index + 1}</span>

      <button
        {...attributes}
        {...listeners}
        title={t('workflows.list.drag_reorder')}
        className="shrink-0 cursor-grab touch-none rounded p-1 text-[hsl(var(--muted-foreground))]/60 hover:text-[hsl(var(--muted-foreground))] active:cursor-grabbing disabled:opacity-30"
        disabled={!canWrite}
      >
        <GripVertical size={16} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-[hsl(var(--foreground))]">{wf.name}</span>
          {modeLabel && (
            <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium', modeStyle)}>
              {modeLabel}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-[hsl(var(--muted-foreground))]">
          {formName && triggerCfg?.event_type ? `${formName} · ${triggerCfg.event_type}` : null}
          {formName && triggerCfg?.event_type ? ' · ' : ''}
          {t('workflows.list.updated', { count: wf.definition.nodes?.length ?? 0, date: new Date(wf.updated_at).toLocaleDateString(locale) })}
        </p>
      </div>

      {canWrite && (
        <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          <button title={t('workflows.list.move_up')} disabled={index === 0} onClick={() => onMove(-1)} className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30">
            ▲
          </button>
          <button title={t('workflows.list.move_down')} disabled={index === count - 1} onClick={() => onMove(1)} className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30">
            ▼
          </button>
        </span>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {canTrigger && (
          <Button size="sm" variant="outline" onClick={onTrigger} disabled={isTriggering}>
            {isTriggering ? <Spinner className="h-4 w-4" /> : <Play size={14} />}
            {t('workflows.list.run')}
          </Button>
        )}
        <Link to="/applications/$appId/workflows/$workflowId" params={{ appId, workflowId: wf.id }}>
          <Button variant="ghost" size="icon"><ExternalLink size={14} /></Button>
        </Link>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={onDelete} className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10">
            <Trash2 size={14} />
          </Button>
        )}
      </div>
    </div>
  )
}

function EmptyState({ canWrite, appId }: { canWrite: boolean; appId: string }) {
  const t = useI18n().t
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-12 text-center">
      <p className="text-[hsl(var(--muted-foreground))] mb-4">{t('workflows.list.no_definitions')}</p>
      {canWrite && (
        <Link to="/applications/$appId/workflows/new" params={{ appId }}>
          <Button variant="outline"><Plus size={16} />{t('workflows.list.create_first')}</Button>
        </Link>
      )}
    </div>
  )
}

function PageLoader() {
  return <div className="flex h-64 items-center justify-center"><Spinner /></div>
}

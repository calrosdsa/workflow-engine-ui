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
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { WorkflowDefinition, TriggerConfig } from '@/features/workflows/types'

/** Pulls the Trigger root node's config out of a saved definition, if any —
 *  same lookup api/workflows/handler.go's triggerConfig does server-side.
 *  A definition with no Trigger node (or an unparsable one) has no automatic
 *  dispatch behavior, so its position in the list is informational only. */
function getTriggerConfig(wf: WorkflowDefinition): TriggerConfig | null {
  const node = wf.definition.nodes?.find((n) => n.type === 'trigger')
  if (!node) return null
  return node.configuration as TriggerConfig
}

const MODE_LABEL: Record<string, string> = {
  before: 'Before',
  after: 'After',
  after_async: 'After (async)',
  scheduled: 'Scheduled',
  on_demand: 'On demand',
}

const MODE_STYLE: Record<string, string> = {
  before: 'bg-amber-50 text-amber-700 border-amber-200',
  after: 'bg-blue-50 text-blue-700 border-blue-200',
  after_async: 'bg-violet-50 text-violet-700 border-violet-200',
  scheduled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  on_demand: 'bg-gray-50 text-gray-600 border-gray-200',
}

export function WorkflowsPage() {
  const { data: workflows, isLoading } = useWorkflows()
  const deleteMutation = useDeleteWorkflow()
  const reorderMutation = useReorderWorkflows()
  const triggerMutation = useTriggerExecution()
  const { data: forms } = useForms()
  const [triggeredId, setTriggeredId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const canWrite = usePermission('workflows:write')
  const canTrigger = usePermission('executions:write')

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
          <h1 className="text-2xl font-bold text-gray-900">Workflow Definitions</h1>
          <p className="text-sm text-gray-500 mt-1">
            {ordered.length} definitions · drag to set execution order
          </p>
        </div>
        {canWrite && (
          <Link to="/workflows/new">
            <Button><Plus size={16} />New Workflow</Button>
          </Link>
        )}
      </div>

      {triggeredId && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
          Execution triggered — <Link to="/executions/$executionId" params={{ executionId: triggeredId }} className="underline font-medium">track it here</Link>
        </div>
      )}

      {!ordered.length ? (
        <EmptyState canWrite={canWrite} />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          <p className="border-b border-gray-100 bg-gray-50/60 px-4 py-2 text-xs text-gray-500">
            When multiple workflows trigger on the same record event, they run top-to-bottom in this order —
            a Before/After workflow only fires for events that happen after it in the list.
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={ordered.map((w) => w.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-gray-100">
                {ordered.map((wf, index) => (
                  <WorkflowRow
                    key={wf.id}
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
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.2,0,0,1)' }}>
              {activeWorkflow && (
                <div className="flex items-center gap-2 rounded-md border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-lg">
                  <GripVertical size={14} className="text-indigo-400" />
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
  wf, index, count, triggerCfg, formName, canWrite, canTrigger, onDelete, onTrigger, isTriggering, onMove,
}: {
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
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: wf.id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  const modeKey = triggerCfg?.mode
  const modeLabel = modeKey ? MODE_LABEL[modeKey] ?? modeKey : null
  const modeStyle = modeKey ? MODE_STYLE[modeKey] ?? 'bg-gray-50 text-gray-600 border-gray-200' : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('group flex items-center gap-3 px-4 py-3', isDragging && 'opacity-50 bg-gray-50')}
    >
      <span className="w-6 shrink-0 text-center text-xs font-mono text-gray-300">{index + 1}</span>

      <button
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        className="shrink-0 cursor-grab touch-none rounded p-1 text-gray-300 hover:text-gray-500 active:cursor-grabbing disabled:opacity-30"
        disabled={!canWrite}
      >
        <GripVertical size={16} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-gray-900">{wf.name}</span>
          {modeLabel && (
            <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium', modeStyle)}>
              {modeLabel}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-400">
          {formName && triggerCfg?.event_type ? `${formName} · ${triggerCfg.event_type}` : null}
          {formName && triggerCfg?.event_type ? ' · ' : ''}
          {wf.definition.nodes?.length ?? 0} nodes · Updated {new Date(wf.updated_at).toLocaleDateString()}
        </p>
      </div>

      {canWrite && (
        <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          <button title="Move up" disabled={index === 0} onClick={() => onMove(-1)} className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">
            ▲
          </button>
          <button title="Move down" disabled={index === count - 1} onClick={() => onMove(1)} className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">
            ▼
          </button>
        </span>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {canTrigger && (
          <Button size="sm" variant="outline" onClick={onTrigger} disabled={isTriggering}>
            {isTriggering ? <Spinner className="h-4 w-4" /> : <Play size={14} />}
            Run
          </Button>
        )}
        <Link to="/workflows/$workflowId" params={{ workflowId: wf.id }}>
          <Button variant="ghost" size="icon"><ExternalLink size={14} /></Button>
        </Link>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 size={14} />
          </Button>
        )}
      </div>
    </div>
  )
}

function EmptyState({ canWrite }: { canWrite: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
      <p className="text-gray-500 mb-4">No workflow definitions yet</p>
      {canWrite && (
        <Link to="/workflows/new">
          <Button variant="outline"><Plus size={16} />Create your first workflow</Button>
        </Link>
      )}
    </div>
  )
}

function PageLoader() {
  return <div className="flex h-64 items-center justify-center"><Spinner /></div>
}

import { useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  type EdgeProps,
} from '@xyflow/react'
import { Plus } from 'lucide-react'
import { useBuilderStore, type FlowEdge } from '@/features/workflows/builder/store'
import { useExecutionOverlayStore } from '@/features/workflows/builder/execution-overlay-store'
import { useSelectedRoute, useStepOrder } from '@/features/workflows/builder/route'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { NodeExecutionStatus } from '@/features/executions/types'

// Lamp colour for track leading INTO a step the selected run reached: the
// step's own outcome, so a failure reads as a red section ending at the
// failed plate. Skipped track stays unlit.
const runLamp: Record<NodeExecutionStatus, string | null> = {
  PENDING: 'var(--primary)',
  RUNNING: 'var(--primary)',
  COMPLETED: 'var(--success)',
  FAILED: 'var(--destructive)',
  COMPLETED_WITH_ERRORS: 'var(--warning)',
  SKIPPED: null,
}

// The route lights section by section in run order, capped so a step deep in
// a long run is not left waiting seconds for its turn.
const DRAW_STEP_MS = 70
const DRAW_MAX_RANK = 10

// One section of a run's route drawing on. The delay is read once, at mount:
// the real run order can arrive after the run itself, and changing the delay
// of an animation already under way would make the section jump.
function RouteDraw({ path, lamp, rank }: { path: string; lamp: string; rank: number }) {
  const [delay] = useState(() => Math.min(Math.max(rank - 1, 0), DRAW_MAX_RANK) * DRAW_STEP_MS)
  return (
    <path
      d={path}
      fill="none"
      pathLength={1}
      className="wf-track-draw"
      style={{
        stroke: `hsl(${lamp})`,
        strokeWidth: 2.5,
        filter: `drop-shadow(0 0 3px hsl(${lamp} / 0.55))`,
        animationDelay: `${delay}ms`,
      }}
    />
  )
}

export function CustomEdge({
  id,
  source,
  target,
  sourceX, sourceY,
  targetX, targetY,
  style,
  markerEnd,
  selected,
}: EdgeProps<FlowEdge>) {
  const t = useTranslation()
  const [hovered, setHovered] = useState(false)

  // Horizontal flow: source exits right, target enters left.
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition: Position.Right,
    targetX, targetY, targetPosition: Position.Left,
    borderRadius: 12,
  })

  const openPicker     = useBuilderStore((s) => s.openPicker)
  const draggingNodeId = useBuilderStore((s) => s.draggingNodeId)
  const route          = useSelectedRoute()
  const stepOrder      = useStepOrder()

  // Taken-path highlighting (FR-C5-007): an edge is "taken" only if BOTH its
  // endpoints were reached by the selected execution — an edge into an
  // untaken condition branch has just one endpoint reached and must not
  // light up, since that would misrepresent a path that never executed.
  const overlayExecution = useExecutionOverlayStore((s) => s.data)
  const runKey           = useExecutionOverlayStore((s) => s.selectedExecutionId)
  const logOrder         = useExecutionOverlayStore((s) => s.logOrder)
  const nodeStatuses = overlayExecution?.node_statuses
  const overlayActive = nodeStatuses != null
  const targetStatus = nodeStatuses?.[target]
  const isTakenPath = overlayActive && nodeStatuses[source] !== undefined && targetStatus !== undefined
  const takenLamp = isTakenPath && targetStatus ? runLamp[targetStatus] : null

  // Precedence: a run on the panel > the selected step's route > the
  // selected edge > hover. The route is not shown while a run is overlaid:
  // two lit routes at once would make neither readable. A taken edge keeps
  // its core unlit here; the draw-on path below is what lights it.
  const onRoute = !overlayActive && route?.edgeIds.has(id) === true
  const lamp = onRoute ? 'var(--primary)' : null

  const core = lamp ? `hsl(${lamp})`
    : selected || hovered ? 'hsl(var(--foreground))'
    : style?.stroke ?? 'hsl(var(--wf-track))'
  const coreWidth = lamp || selected ? 2.5 : 2
  // Dim edges while a reorder drag is in flight, matching the node fade, and
  // let untaken track go dark while a run is on the panel.
  const opacity = draggingNodeId !== null ? 0.35 : overlayActive && !isTakenPath ? 0.28 : 1
  // Real run order when the run has logs, the graph's step order otherwise.
  const drawRank = logOrder?.[target] ?? stepOrder.get(target)?.step ?? 0

  return (
    <>
      {/* The track bed: a channel the line sits in, and a soft glow once lit. */}
      <path
        d={edgePath}
        fill="none"
        className="wf-track-bed"
        style={{
          stroke: lamp ? `hsl(${lamp} / 0.16)` : 'hsl(var(--wf-track-bed))',
          strokeWidth: lamp ? 9 : 7,
          opacity,
        }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: core,
          strokeWidth: coreWidth,
          strokeDasharray: selected && !lamp ? '6 4' : undefined,
          opacity,
          transition: 'opacity 150ms, stroke 150ms',
        }}
      />
      {/* A run draws its route on, once per selected run: keyed by the run's
          id so the 2s status poll never replays it. */}
      {takenLamp && runKey && (
        <RouteDraw key={runKey} path={edgePath} lamp={takenLamp} rank={drawRank} />
      )}
      <EdgeLabelRenderer>
        <div
          style={{
            position:  'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="flex h-9 w-9 items-center justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation()
                openPicker({ kind: 'edge', edgeId: id })
              }}
              onFocus={() => setHovered(true)}
              onBlur={() => setHovered(false)}
              className={[
                'wf-track-insert flex h-6 w-6 items-center justify-center rounded-full',
                (hovered || selected) ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
              ].join(' ')}
              title={t('workflows.canvas.insert_step')}
              aria-label={t('workflows.canvas.insert_step')}
            >
              <Plus size={13} strokeWidth={2.75} />
            </button>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

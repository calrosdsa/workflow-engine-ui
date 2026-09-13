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
  const [hovered, setHovered] = useState(false)

  // Horizontal flow: source exits right, target enters left — rounded step path
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition: Position.Right,
    targetX, targetY, targetPosition: Position.Left,
    borderRadius: 16,
  })

  const openPicker     = useBuilderStore((s) => s.openPicker)
  const draggingNodeId = useBuilderStore((s) => s.draggingNodeId)

  // Taken-path highlighting (FR-C5-007): an edge is "taken" only if BOTH its
  // endpoints were reached by the selected execution — an edge into an
  // untaken condition branch has just one endpoint reached and must not
  // light up, since that would misrepresent a path that never executed.
  const overlayExecution = useExecutionOverlayStore((s) => s.data)
  const nodeStatuses = overlayExecution?.node_statuses
  const overlayActive = nodeStatuses != null
  const isTakenPath = overlayActive && nodeStatuses[source] !== undefined && nodeStatuses[target] !== undefined
  const dimUntaken = overlayActive && !isTakenPath

  // Selected edges get a distinct accent color + thicker stroke; hover is a
  // lighter highlight. A taken path in an active overlay takes priority over
  // the idle default so the highlight reads clearly even when nothing is
  // selected/hovered. Default is the muted slate from props.
  const stroke = selected ? 'hsl(var(--primary))'
    : hovered ? 'hsl(var(--primary))'
    : isTakenPath ? 'hsl(var(--success))'
    : style?.stroke ?? 'hsl(var(--muted-foreground))'
  const strokeWidth = selected || isTakenPath ? 3 : 2
  // Dim edges while a reorder drag is in flight, matching the node fade so the
  // whole idle tree recedes and the drag/drop pair stays visually prominent.
  // An untaken path in an active overlay recedes the same way.
  const opacity = draggingNodeId !== null ? 0.35 : dimUntaken ? 0.3 : 1

  return (
    <>
      {/* Soft glow halo behind a selected edge */}
      {selected && (
        <BaseEdge
          id={`${id}-halo`}
          path={edgePath}
          style={{ stroke: 'hsl(var(--primary))', strokeWidth: 8, opacity: 0.15 }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, stroke, strokeWidth, opacity, transition: 'opacity 150ms' }}
      />
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
              className={[
                'flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--primary-foreground))] ring-4 ring-[hsl(var(--background))]',
        'transition-[opacity,transform] duration-150 hover:scale-110',
                'bg-[hsl(var(--primary))] hover:brightness-110 shadow-md shadow-[hsl(var(--primary))]/30',
                (hovered || selected) ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
              ].join(' ')}
              title="Insert node here"
            >
              <Plus size={13} strokeWidth={2.75} />
            </button>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

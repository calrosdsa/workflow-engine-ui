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

export function CustomEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  style,
  markerEnd,
  selected,
}: EdgeProps<FlowEdge>) {
  const [hovered, setHovered] = useState(false)

  // Vertical flow: source exits bottom, target enters top — rounded step path
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition: Position.Bottom,
    targetX, targetY, targetPosition: Position.Top,
    borderRadius: 16,
  })

  const openPicker = useBuilderStore((s) => s.openPicker)

  // Selected edges get a distinct accent color + thicker stroke; hover is a
  // lighter highlight. Default is the muted slate from props.
  const stroke = selected ? '#6366f1' : hovered ? '#3b82f6' : style?.stroke ?? '#cbd5e1'
  const strokeWidth = selected ? 3 : 2

  return (
    <>
      {/* Soft glow halo behind a selected edge */}
      {selected && (
        <BaseEdge
          id={`${id}-halo`}
          path={edgePath}
          style={{ stroke: '#6366f1', strokeWidth: 8, opacity: 0.15 }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, stroke, strokeWidth }}
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
                'flex h-6 w-6 items-center justify-center rounded-full text-white ring-4 ring-slate-50',
                'transition-all duration-150 hover:scale-110',
                selected ? 'bg-indigo-500 hover:bg-indigo-600 shadow-md shadow-indigo-500/30'
                         : 'bg-blue-500 hover:bg-blue-600 shadow-md shadow-blue-500/30',
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

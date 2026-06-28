import { useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  type EdgeProps,
} from '@xyflow/react'
import { Plus } from 'lucide-react'
import { useBuilderStore, type FlowEdge } from './store'

export function AddNodeEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  style,
  markerEnd,
}: EdgeProps<FlowEdge>) {
  const [hovered, setHovered] = useState(false)

  // Vertical flow: source exits bottom, target enters top
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition: Position.Bottom,
    targetX, targetY, targetPosition: Position.Top,
  })

  const openPicker = useBuilderStore((s) => s.openPicker)

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
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
          <div className="flex h-8 w-8 items-center justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation()
                openPicker({ kind: 'edge', edgeId: id })
              }}
              className={[
                'flex h-5 w-5 items-center justify-center rounded-full',
                'border-2 border-blue-400 bg-white text-blue-500 shadow-sm',
                'transition-all duration-150 hover:bg-blue-50',
                hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
              ].join(' ')}
              title="Insert node here"
            >
              <Plus size={10} strokeWidth={3} />
            </button>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

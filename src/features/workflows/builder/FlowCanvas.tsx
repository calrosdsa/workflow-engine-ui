import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type OnInit,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useBuilderStore, type FlowNode } from './store'
import { BaseNode } from './nodes/BaseNode'
import { AddNodeEdge } from './AddNodeEdge'
import { NodePickerModal } from './NodePickerModal'
import { NodePalette } from './NodePalette'
import type { NodeType } from '../types'

const nodeTypes = {
  entry:         BaseNode,
  exit:          BaseNode,
  set_variable:  BaseNode,
  condition:     BaseNode,
  subflow:       BaseNode,
  merge:         BaseNode,
  fetch_records: BaseNode,
}

const edgeTypes = {
  de1fault: AddNodeEdge,
}

export function FlowCanvas() {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    selectNode, addNode,
    pickerContext, closePicker,
    addConnectedNode, insertNodeOnEdge,
  } = useBuilderStore()

  const rfInstanceRef = useRef<ReactFlowInstance<FlowNode> | null>(null)

  const onInit: OnInit<FlowNode> = useCallback((instance) => {
    rfInstanceRef.current = instance
  }, [])

  // Drop from palette onto canvas
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/xyflow-node-type') as NodeType
    if (!type || !rfInstanceRef.current) return

    const bounds = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const position = rfInstanceRef.current.screenToFlowPosition({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    })
    addNode(type, position)
  }, [addNode])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  // Keyboard: Delete/Backspace removes selected nodes & edges
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      useBuilderStore.getState().deleteSelected()
    }
  }, [])

  // Called when user selects a node type from the picker
  const handlePickerSelect = useCallback((type: NodeType) => {
    if (!pickerContext) return
    if (pickerContext.kind === 'edge') {
      insertNodeOnEdge(type, pickerContext.edgeId)
    } else {
      addConnectedNode(type, pickerContext.sourceNodeId, pickerContext.sourceHandle)
    }
    closePicker()
  }, [pickerContext, insertNodeOnEdge, addConnectedNode, closePicker])

  return (
    <div
      className="relative flex-1"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <NodePalette />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          animated: false,
          type: 'default',
          style: { strokeWidth: 2, stroke: '#94a3b8' },
        }}
        connectionLineStyle={{ strokeWidth: 2, stroke: '#3b82f6' }}
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.3}
        maxZoom={2}
        deleteKeyCode={null}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={2}
          nodeColor={(n) => {
            const type = (n.data as FlowNode['data']).type
            const colorMap: Record<string, string> = {
              entry: '#10b981', exit: '#9ca3af', set_variable: '#3b82f6',
              condition: '#f59e0b', subflow: '#a855f7', merge: '#14b8a6',
              fetch_records: '#f43f5e',
            }
            return colorMap[type] ?? '#94a3b8'
          }}
          maskColor="rgba(240,242,247,0.7)"
          pannable
          zoomable
        />
      </ReactFlow>

      {pickerContext && (
        <NodePickerModal
          onSelect={handlePickerSelect}
          onClose={closePicker}
        />
      )}
    </div>
  )
}

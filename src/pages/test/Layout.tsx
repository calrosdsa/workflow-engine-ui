import { useCallback, useRef } from "react";
import {
  Background,
  ReactFlow,
  BackgroundVariant,
  Controls,
  type ReactFlowInstance,
  type OnInit,
  type Node,
  type Edge,
} from "@xyflow/react";

import { CustomEdge } from "./CustomEdge";
import { BaseNode } from "@/features/workflows/builder/nodes/BaseNode";
import {
  useBuilderStore,
  type FlowNode,
} from "@/features/workflows/builder/store";
import type { NodeType } from "@/features/workflows/types";
import { NodePickerModal } from "@/features/workflows/builder/NodePickerModal";

const edgeTypes = {
  default: CustomEdge,
};

const nodeTypes = {
  entry:        BaseNode,
  exit:         BaseNode,
  set_variable: BaseNode,
  condition:    BaseNode,
  subflow:      BaseNode,
  merge:        BaseNode,
};

const Flow = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    addNode,
    pickerContext,
    closePicker,
    addConnectedNode,
    insertNodeOnEdge,
  } = useBuilderStore();

  const rfInstanceRef = useRef<ReactFlowInstance<FlowNode> | null>(null);

  const onInit: OnInit<FlowNode> = useCallback((instance) => {
    rfInstanceRef.current = instance;
  }, []);

  // Drop from palette onto canvas
  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(
        "application/xyflow-node-type",
      ) as NodeType;
      if (!type || !rfInstanceRef.current) return;
      const bounds = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const position = rfInstanceRef.current.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });
      addNode(type, position);
    },
    [addNode],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // Delete/Backspace removes selected nodes & edges
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      useBuilderStore.getState().deleteSelected();
      // Re-layout after deletion settles
      setTimeout(() => useBuilderStore.getState().applyDagreLayout("TB"), 0);
    }
  }, []);

  // Node picker selection
  const handlePickerSelect = useCallback(
    (type: NodeType) => {
      if (!pickerContext) return;
      if (pickerContext.kind === "edge") {
        insertNodeOnEdge(type, pickerContext.edgeId);
      } else {
        addConnectedNode(type, pickerContext.sourceNodeId, pickerContext.sourceHandle);
      }
      closePicker();
      // Re-layout after new node is added
      setTimeout(() => useBuilderStore.getState().applyDagreLayout("TB"), 0);
    },
    [pickerContext, insertNodeOnEdge, addConnectedNode, closePicker],
  );

  // Re-layout when a new connection is drawn
  const handleConnect = useCallback(
    (connection: Parameters<typeof onConnect>[0]) => {
      onConnect(connection);
      setTimeout(() => useBuilderStore.getState().applyDagreLayout("TB"), 0);
    },
    [onConnect],
  );

  // Re-layout after nodes are deleted (fired by XYFlow after the delete is applied)
  const handleNodesDelete = useCallback(
    (deleted: Node[]) => {
      console.log("nodesDelete", deleted);
      setTimeout(() => useBuilderStore.getState().applyDagreLayout("TB"), 0);
    },
    [],
  );

  // Re-layout after edges are deleted
  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      console.log("edgesDelete", deleted);
      setTimeout(() => useBuilderStore.getState().applyDagreLayout("TB"), 0);
    },
    [],
  );

  return (
    <div
      className="relative flex-1 h-screen p-10"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
        {/* {JSON.stringify(nodes)} */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          animated: false,
          type: "default",
          style: { strokeWidth: 2, stroke: "#94a3b8" },
        }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onConnect={handleConnect}
        onInit={onInit}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        connectionLineStyle={{ strokeWidth: 2, stroke: "#3b82f6" }}
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.3}
        maxZoom={2}
        deleteKeyCode={null}
        colorMode="system"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />
      </ReactFlow>

      {pickerContext && (
        <NodePickerModal onSelect={handlePickerSelect} onClose={closePicker} />
      )}
    </div>
  );
};

export function FlowLayout() {
  return (
    <div className="relative flex-1">
      <Flow />
    </div>
  );
}

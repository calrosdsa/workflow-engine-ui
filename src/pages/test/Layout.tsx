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
import "./index.css";
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
  entry: BaseNode,
  exit: BaseNode,
  set_variable: BaseNode,
  condition: BaseNode,
  subflow: BaseNode,
  merge: BaseNode,
  fetch_records: BaseNode,
  iterator: BaseNode,
  loop_end: BaseNode,
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
      const bounds = (
        e.currentTarget as HTMLDivElement
      ).getBoundingClientRect();
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
        addConnectedNode(
          type,
          pickerContext.sourceNodeId,
          pickerContext.sourceHandle,
        );
      }
      closePicker();
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

  // Re-layout after nodes are deleted
  const handleNodesDelete = useCallback((_deleted: Node[]) => {
    setTimeout(() => useBuilderStore.getState().applyDagreLayout("TB"), 0);
  }, []);

  // Re-layout after edges are deleted
  const handleEdgesDelete = useCallback((_deleted: Edge[]) => {
    setTimeout(() => useBuilderStore.getState().applyDagreLayout("TB"), 0);
  }, []);

  return (
    <div
      className="relative h-full flex-1 bg-slate-50"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      {/* <NodePalette /> */}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          animated: false,
          type: "default",
          style: { strokeWidth: 2, stroke: "#cbd5e1" },
        }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onConnect={handleConnect}
        onInit={onInit}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        nodesDraggable
        elevateEdgesOnSelect
        fitView
        // fitViewOptions={{ padding: 0.3 }}
        connectionLineStyle={{ strokeWidth: 2, stroke: "#3b82f6" }}
        snapToGrid
        // snapGrid={[16, 16]}
        minZoom={0.3}
        maxZoom={2}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="#d8dee9"
        />
        <Controls
          showInteractive={false}
          className="!rounded-xl !border !border-slate-200 !bg-white !shadow-lg overflow-hidden [&>button]:!border-slate-100 [&>button]:!text-slate-500 [&>button:hover]:!bg-slate-50"
        />
        {/* <MiniMap
          pannable
          zoomable
          className="!rounded-xl !border !border-slate-200 !bg-white !shadow-lg"
          maskColor="rgba(241,245,249,0.7)"
          nodeColor={(n) => NODE_REGISTRY[(n.data as FlowNode["data"]).type]?.accent ?? "#94a3b8"}
          nodeStrokeWidth={0}
          nodeBorderRadius={4}
        /> */}
      </ReactFlow>

      {pickerContext && (
        <NodePickerModal onSelect={handlePickerSelect} onClose={closePicker} />
      )}
    </div>
  );
};

export function FlowLayout() {
  return (
    <div className="relative h-full flex-1">
      <Flow />
    </div>
  );
}

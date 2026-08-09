import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  ReactFlow,
  BackgroundVariant,
  Controls,
  MiniMap,
  type ReactFlowInstance,
  type OnInit,
  type Node,
  type Edge,
} from "@xyflow/react";
import { Undo2, Redo2, Wand2, Maximize, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import { CustomEdge } from "./CustomEdge";
import "./index.css";
import { BaseNode } from "@/features/workflows/builder/nodes/BaseNode";
import {
  useBuilderStore,
  type FlowNode,
} from "@/features/workflows/builder/store";
import { NODE_REGISTRY } from "@/features/workflows/builder/node-registry";
import type { NodeType } from "@/features/workflows/types";
import { NodePickerModal } from "@/features/workflows/builder/NodePickerModal";

// True when the event originates inside a text-entry control — global
// shortcuts must never fire while the user is typing.
function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return (
    t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable
  );
}

const edgeTypes = {
  default: CustomEdge,
};

const nodeTypes = {
  entry: BaseNode,
  exit: BaseNode,
  trigger: BaseNode,
  set_variable: BaseNode,
  condition: BaseNode,
  subflow: BaseNode,
  merge: BaseNode,
  fetch_records: BaseNode,
  upsert_records: BaseNode,
  update_records: BaseNode,
  delete_records: BaseNode,
  iterator: BaseNode,
  loop_end: BaseNode,
  http_request: BaseNode,
  show_message: BaseNode,
  notification: BaseNode,
  send_email: BaseNode,

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
    undo,
    redo,
    applyDagreLayout,
    closeActiveSidebar,
  } = useBuilderStore();
  const canUndo = useBuilderStore((s) => s.past.length > 0);
  const canRedo = useBuilderStore((s) => s.future.length > 0);

  const [showMiniMap, setShowMiniMap] = useState(true);

  const rfInstanceRef = useRef<ReactFlowInstance<FlowNode> | null>(null);

  const fitView = useCallback(() => {
    rfInstanceRef.current?.fitView({ padding: 0.25, duration: 300 });
  }, []);

  // ReactFlow's own `fitView` prop only fires at mount — before the seed or
  // the loaded definition lands in the store — so re-fit once real nodes
  // appear (and again if a different workflow is loaded into this canvas).
  const workflowId = useBuilderStore((s) => s.workflowId);
  const fittedForRef = useRef<string | null>(null);
  const fitKey = `${workflowId}:${nodes.length > 0}`;
  useEffect(() => {
    if (nodes.length === 0 || fittedForRef.current === fitKey) return;
    fittedForRef.current = fitKey;
    // Wait a frame so ReactFlow has measured the fresh nodes.
    const t = setTimeout(fitView, 50);
    return () => clearTimeout(t);
  }, [fitKey, nodes.length, fitView]);

  const tidyLayout = useCallback(() => {
    applyDagreLayout("TB");
    setTimeout(fitView, 50);
  }, [applyDagreLayout, fitView]);

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

  // Global editing shortcuts: undo/redo + delete. Window-level so they work
  // regardless of focus, but never while typing in an input or editor.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && !e.shiftKey && key === "z") {
        e.preventDefault();
        useBuilderStore.getState().undo();
        return;
      }
      if ((mod && e.shiftKey && key === "z") || (mod && key === "y")) {
        e.preventDefault();
        useBuilderStore.getState().redo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        useBuilderStore.getState().deleteSelected();
        setTimeout(() => useBuilderStore.getState().applyDagreLayout("TB"), 0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
    >
      {/* Canvas toolbar — undo/redo + view helpers */}
      <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/5">
        <ToolbarButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={15} />
        </ToolbarButton>
        <div className="mx-0.5 h-4 w-px bg-slate-200" />
        <ToolbarButton onClick={tidyLayout} title="Tidy up layout">
          <Wand2 size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={fitView} title="Fit to view">
          <Maximize size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setShowMiniMap((v) => !v)}
          title={showMiniMap ? "Hide minimap" : "Show minimap"}
          active={showMiniMap}
        >
          <MapIcon size={15} />
        </ToolbarButton>
      </div>

      {/* First-steps hint — only while the canvas holds nothing but the seed */}
      {nodes.length <= 2 && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm backdrop-blur">
          Hover the connection line and click <span className="mx-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 align-middle text-[10px] font-bold text-white">+</span> to add your first step
        </div>
      )}

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
        onPaneClick={() => {
          selectNode(null)
          closeActiveSidebar()
        }}
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
        {showMiniMap && (
          <MiniMap
            pannable
            zoomable
            className="!rounded-xl !border !border-slate-200 !bg-white !shadow-lg"
            maskColor="rgba(241,245,249,0.7)"
            nodeColor={(n) => NODE_REGISTRY[(n.data as FlowNode["data"]).type]?.accent ?? "#94a3b8"}
            nodeStrokeWidth={0}
            nodeBorderRadius={4}
          />
        )}
      </ReactFlow>

      {pickerContext && (
        <NodePickerModal onSelect={handlePickerSelect} onClose={closePicker} />
      )}
    </div>
  );
};

function ToolbarButton({
  onClick,
  disabled,
  title,
  active,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
        disabled
          ? "cursor-default text-slate-300"
          : active
            ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
      )}
    >
      {children}
    </button>
  );
}

export function FlowLayout() {
  return (
    <div className="relative h-full flex-1">
      <Flow />
    </div>
  );
}

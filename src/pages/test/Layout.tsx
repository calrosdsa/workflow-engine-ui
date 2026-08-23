import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useConnectorRegistry } from "@/features/workflows/builder/connector-hooks";
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

// Every BUILT-IN node type renders through the same BaseNode component (its
// body switches on data.type internally — see BaseNode.tsx's NodeBody) —
// derived from NODE_REGISTRY's own keys so a new node type can never go
// missing here the way this map previously drifted out of sync by hand
// (missing several real types, plus a stale 'send_email' entry for a type
// that no longer exists), which made React Flow silently fall back to its
// generic 'default' node renderer — no BaseNode, no data, no visible
// content — for any omitted type. Module-level (not per-render) since the
// built-in set never changes at runtime.
const builtInNodeTypes = Object.fromEntries(
  (Object.keys(NODE_REGISTRY) as NodeType[]).map((type) => [type, BaseNode]),
) as Record<NodeType, typeof BaseNode>;

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

  // Extends builtInNodeTypes with every currently-known connector type, all
  // pointing at the SAME BaseNode component — a connector-typed node has no
  // NodeBody case of its own (that's out of scope for v1, see the connector
  // plan §06's explicit "custom canvas body... did NOT select as required
  // now"), so it renders through BaseNode's own default fallback body,
  // exactly like any other omitted-but-registered type does today. Without
  // this, a connector node would hit React Flow's generic 'default'
  // renderer — the same silent-blank-node failure mode the comment on
  // builtInNodeTypes above already documents fixing for built-ins.
  // Memoized on the connector registry's data so this object is stable
  // across renders that don't change the connector set — React Flow's own
  // docs call out that a nodeTypes/edgeTypes object recreated every render
  // causes unnecessary internal remounting.
  const { data: connectorEntries } = useConnectorRegistry();
  const nodeTypes = useMemo(() => {
    if (!connectorEntries || connectorEntries.length === 0) return builtInNodeTypes;
    const merged: Record<string, typeof BaseNode> = { ...builtInNodeTypes };
    for (const c of connectorEntries) merged[c.type] = BaseNode;
    return merged;
  }, [connectorEntries]);

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

  // Drop from palette onto canvas. `type` is genuinely just a string off the
  // drag payload — was already an unchecked `as NodeType` assertion before
  // connectors existed (a drag-and-drop payload has no compile-time type
  // safety regardless), so this is a widened annotation, not a new risk.
  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(
        "application/xyflow-node-type",
      );
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

  // Node picker selection — type is NodeType | connector type string; see
  // NodePickerModal's own onSelect prop for why it's plain `string` there.
  const handlePickerSelect = useCallback(
    (type: string) => {
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
        // Free-form node dragging is disabled — position/order changes only
        // happen through BaseNode's own grip-handle "Drag to reorder"
        // mechanism (native HTML5 DnD, independent of React Flow's drag),
        // which re-splices the node into the graph and re-runs the auto
        // layout, rather than leaving nodes at arbitrary manually-dragged
        // coordinates.
        nodesDraggable={false}
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

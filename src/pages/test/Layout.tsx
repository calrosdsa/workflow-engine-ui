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
import { Undo2, Redo2, Wand2, Maximize, Map as MapIcon, Plus, Command as CommandIcon, Braces, PanelRight, History, Play, Rocket, Save, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { CustomEdge } from "./CustomEdge";
import "./index.css";
import { BaseNode } from "@/features/workflows/builder/nodes/BaseNode";
import {
  useBuilderStore,
  type FlowNode,
} from "@/features/workflows/builder/store";
import { NODE_REGISTRY } from "@/features/workflows/builder/node-registry";
import { useNodeTaxonomy } from "@/features/workflows/builder/node-taxonomy";
import type { NodeType } from "@/features/workflows/types";
import { NodePickerModal } from "@/features/workflows/builder/NodePickerModal";
import type { PickerSelection } from "@/features/workflows/builder/AppPickerPanel";
import { findTriggerNode, applyTriggerPresetPatch } from "@/features/workflows/builder/trigger-preset-apply";
import {
  WORKFLOW_COMMANDS,
  dispatchWorkflowCommand,
  rememberWorkflowCommand,
  recentWorkflowCommandIds,
  type WorkflowCommandId,
  type WorkflowCommandDefinition,
} from "@/features/workflows/builder/workflow-command-model";

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
    openPicker,
    pickerContext,
    closePicker,
    addConnectedNode,
    insertNodeOnEdge,
    updateNodeConfig,
    undo,
    redo,
    applyDagreLayout,
    closeActiveSidebar,
    toggleVarsPanel,
    toggleConfigPanel,
    toggleExecutionsPanel,
  } = useBuilderStore();
  const canUndo = useBuilderStore((s) => s.past.length > 0);
  const canRedo = useBuilderStore((s) => s.future.length > 0);

  // Extends builtInNodeTypes with every currently-known package node type,
  // all pointing at the SAME BaseNode component — a package-typed node has
  // no NodeBody case of its own (out of scope for v1 — custom canvas bodies
  // were explicitly not required for the first cut of pluggable nodes), so
  // it renders through BaseNode's own default fallback body, exactly like
  // any other omitted-but-registered type does today. Without this, a
  // package node would hit React Flow's generic 'default' renderer — the
  // same silent-blank-node failure mode the comment on builtInNodeTypes
  // above already documents fixing for built-ins.
  // Memoized on the taxonomy's own data so this object is stable across
  // renders that don't change the package node set — React Flow's own docs
  // call out that a nodeTypes/edgeTypes object recreated every render causes
  // unnecessary internal remounting.
  const { data: taxonomy } = useNodeTaxonomy();
  const nodeTypes = useMemo(() => {
    const packageTypes = (taxonomy?.nodes ?? []).filter((n) => n.kind === "package");
    if (packageTypes.length === 0) return builtInNodeTypes;
    const merged: Record<string, typeof BaseNode> = { ...builtInNodeTypes };
    for (const n of packageTypes) merged[n.type] = BaseNode;
    return merged;
  }, [taxonomy]);

  const [showMiniMap, setShowMiniMap] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const rfInstanceRef = useRef<ReactFlowInstance<FlowNode> | null>(null);

  const fitView = useCallback(() => {
    rfInstanceRef.current?.fitView({ padding: 0.25, duration: 300 });
  }, []);

  // ReactFlow's own `fitView` prop only fires at mount — before the seed or
  // the loaded definition lands in the store — so re-fit once real nodes
  // appear (and again if a different workflow is loaded into this canvas).
  const workflowId = useBuilderStore((s) => s.workflowId);
  const fittedForRef = useRef<string | null>(null);
  const fitKey = `${workflowId}:${nodes.length}:${edges.length}`;
  useEffect(() => {
    if (nodes.length === 0 || fittedForRef.current === fitKey) return;
    fittedForRef.current = fitKey;
    // Normalize legacy vertical definitions into the editor's horizontal
    // reading order without turning the visual reflow into a user edit.
    applyDagreLayout("LR", false);
    // Wait a frame so ReactFlow has measured the fresh nodes.
    const t = setTimeout(fitView, 50);
    return () => clearTimeout(t);
  }, [fitKey, nodes.length, fitView, applyDagreLayout]);

  const tidyLayout = useCallback(() => {
    applyDagreLayout("LR");
    setTimeout(fitView, 50);
  }, [applyDagreLayout, fitView]);

  const addStepToFlow = useCallback(() => {
    // The seed graph is trigger → exit, so inserting on that edge is the
    // clearest first action. Once a workflow grows, use the last visible leaf.
    const exitEdge = edges.find((edge) => nodes.some((node) => node.id === edge.target && node.data.type === "exit"));
    if (exitEdge) {
      openPicker({ kind: "edge", edgeId: exitEdge.id });
      return;
    }
    const leaf = [...nodes].reverse().find((node) =>
      node.data.type !== "exit" &&
      (node.data.outputs?.length ?? 0) > 0 &&
      !edges.some((edge) => edge.source === node.id),
    );
    if (leaf) openPicker({ kind: "node", sourceNodeId: leaf.id, sourceHandle: leaf.data.outputs?.[0]?.id ?? "out" });
  }, [edges, nodes, openPicker]);

  const onInit: OnInit<FlowNode> = useCallback((instance) => {
    rfInstanceRef.current = instance;
    // The initial `fitView` prop can run before the seed nodes have measured.
    // Re-fit once the viewport is ready so the first frame is centered and
    // readable instead of opening at the minimum zoom.
    setTimeout(() => instance.fitView({ padding: 0.25, duration: 0 }), 100);
  }, []);

  // Drop from palette onto canvas. `type` is genuinely just a string off the
  // drag payload — was already an unchecked `as NodeType` assertion before
  // package nodes existed (a drag-and-drop payload has no compile-time type
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
      if ((mod && key === "k") || (!mod && !e.altKey && e.key === "/")) {
        e.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (e.key === "Escape" && commandOpen) {
        e.preventDefault();
        setCommandOpen(false);
        return;
      }
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
      if (mod && e.shiftKey && key === "l") {
        e.preventDefault();
        tidyLayout();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        useBuilderStore.getState().deleteSelected();
        setTimeout(() => useBuilderStore.getState().applyDagreLayout("LR"), 0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandOpen, tidyLayout]);

  // Centers the viewport on one node — React Flow's own fitView above only
  // ever frames the WHOLE graph; this is the single-node equivalent used
  // when a picker selection reconfigures the singleton Trigger node rather
  // than adding a step near wherever the picker happened to open.
  const centerOnNode = useCallback((nodeId: string) => {
    const node = useBuilderStore.getState().nodes.find((n) => n.id === nodeId);
    if (node && rfInstanceRef.current) {
      // Falls back to store.ts's own dagre layout dimensions (180x80) when
      // React Flow hasn't measured the node yet — close enough for a
      // centering nudge, not pixel-exact.
      rfInstanceRef.current.setCenter(
        node.position.x + (node.width ?? 180) / 2,
        node.position.y + (node.height ?? 80) / 2,
        { zoom: 1, duration: 300 },
      );
    }
  }, []);

  // Node picker selection — a discriminated union, not just a node type
  // string: picking a package-declared trigger preset (from the picker's
  // "Apps" tab) must reconfigure the workflow's ALREADY-EXISTING singleton
  // Trigger node, never add a second graph node — the same invariant
  // graph.Lint enforces server-side ("a workflow must have exactly one
  // trigger/entry node"). Selection kind wins over picker context kind: a
  // trigger-preset pick reached through an edge's own "+" button still
  // reconfigures the trigger and leaves that edge completely untouched.
  const handlePickerSelect = useCallback(
    (selection: PickerSelection) => {
      if (!pickerContext) return;
      if (selection.kind === "trigger_preset") {
        const trigger = findTriggerNode(nodes);
        if (trigger) {
          updateNodeConfig(trigger.id, applyTriggerPresetPatch(trigger.data.configuration, selection.preset));
          selectNode(trigger.id); // auto-opens the Node Config panel (store.ts)
          centerOnNode(trigger.id);
        }
        closePicker();
        return;
      }
      const { type } = selection;
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
      setTimeout(() => useBuilderStore.getState().applyDagreLayout("LR"), 0);
    },
    [pickerContext, nodes, insertNodeOnEdge, addConnectedNode, updateNodeConfig, selectNode, centerOnNode, closePicker],
  );

  // Re-layout when a new connection is drawn
  const handleConnect = useCallback(
    (connection: Parameters<typeof onConnect>[0]) => {
      onConnect(connection);
      setTimeout(() => useBuilderStore.getState().applyDagreLayout("LR"), 0);
    },
    [onConnect],
  );

  // Re-layout after nodes are deleted
  const handleNodesDelete = useCallback((_deleted: Node[]) => {
      setTimeout(() => useBuilderStore.getState().applyDagreLayout("LR"), 0);
  }, []);

  // Re-layout after edges are deleted
  const handleEdgesDelete = useCallback((_deleted: Edge[]) => {
      setTimeout(() => useBuilderStore.getState().applyDagreLayout("LR"), 0);
  }, []);

  const runCommand = useCallback((id: WorkflowCommandId) => {
    switch (id) {
      case "add-step": addStepToFlow(); break;
      case "fit-view": fitView(); break;
      case "tidy-layout": tidyLayout(); break;
      case "toggle-minimap": setShowMiniMap((visible) => !visible); break;
      case "toggle-variables": toggleVarsPanel(); break;
      case "toggle-inspector": toggleConfigPanel(); break;
      case "toggle-executions": toggleExecutionsPanel(); break;
      case "close-panels": closeActiveSidebar(); break;
      default: dispatchWorkflowCommand(id); break;
    }
    rememberWorkflowCommand(id);
    setCommandOpen(false);
  }, [addStepToFlow, closeActiveSidebar, fitView, tidyLayout, toggleConfigPanel, toggleExecutionsPanel, toggleVarsPanel]);

  const recentCommands = commandOpen ? (() => {
    const recent = new Set(recentWorkflowCommandIds());
    return WORKFLOW_COMMANDS.filter((command) => recent.has(command.id));
  })() : [];

  const nodeNavigationCommands = useMemo(
    () => nodes.map((node) => ({ id: node.id, label: node.data.label || node.data.type, type: node.data.type })),
    [nodes],
  );

  const nodeAddCommands = useMemo(
    () => (Object.keys(NODE_REGISTRY) as NodeType[])
      .filter((type) => type !== "entry")
      .map((type) => ({ type, label: NODE_REGISTRY[type].label })),
    [],
  );

  return (
    <div
      className="workflow-builder-canvas relative h-full flex-1 bg-[hsl(var(--background))]"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* Canvas toolbar — undo/redo + view helpers */}
      <div className="workflow-builder-canvas-toolbar absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-0.5 border border-[hsl(var(--border))] p-1 shadow-lg shadow-black/20">
        <ToolbarButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={15} />
        </ToolbarButton>
        <div className="mx-0.5 h-4 w-px bg-[hsl(var(--border))]" />
        <ToolbarButton onClick={tidyLayout} title="Tidy up layout">
          <Wand2 size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => setCommandOpen(true)} title="Command bar (Ctrl+K)">
          <CommandIcon size={15} />
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
        <div className="workflow-builder-start-hint pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full border px-4 py-2 text-xs font-medium shadow-sm backdrop-blur">
          Hover the connection line and click <span className="mx-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--primary))] align-middle text-[10px] font-bold text-[hsl(var(--primary-foreground))]">+</span> to add your first step
        </div>
      )}

      <div className="workflow-builder-tool-rail" aria-label="Canvas tools">
        <ToolbarButton onClick={addStepToFlow} title="Add a workflow step" tone="primary">
          <Plus size={16} strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton onClick={fitView} title="Fit workflow to view">
          <Maximize size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setShowMiniMap((v) => !v)}
          title={showMiniMap ? "Hide minimap" : "Show minimap"}
          active={showMiniMap}
        >
          <MapIcon size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={tidyLayout} title="Tidy workflow layout">
          <Wand2 size={15} />
        </ToolbarButton>
      </div>

      <ReactFlow
        colorMode="dark"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          animated: false,
          type: "default",
          style: { strokeWidth: 2, stroke: "hsl(var(--muted-foreground))" },
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
        connectionLineStyle={{ strokeWidth: 2, stroke: "hsl(var(--primary))" }}
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
          color="hsl(var(--border))"
        />
        <Controls
          showInteractive={false}
          className="!rounded-xl !border !border-[hsl(var(--border))] !bg-[hsl(var(--card))] !shadow-lg overflow-hidden [&>button]:!border-[hsl(var(--border))] [&>button]:!text-[hsl(var(--muted-foreground))] [&>button:hover]:!bg-[hsl(var(--muted))]"
        />
        {showMiniMap && (
          <MiniMap
            pannable
            zoomable
            className="!rounded-xl !border !border-[hsl(var(--border))] !bg-[hsl(var(--card))] !shadow-lg"
            maskColor="hsl(var(--background) / 0.7)"
            nodeColor={(n) => NODE_REGISTRY[(n.data as FlowNode["data"]).type]?.accent ?? "hsl(var(--muted-foreground))"}
            nodeStrokeWidth={0}
            nodeBorderRadius={4}
          />
        )}
      </ReactFlow>

      {pickerContext && (
        <NodePickerModal onSelect={handlePickerSelect} onClose={closePicker} />
      )}

      {commandOpen && (
        <dialog
          open
          className="workflow-builder-command-backdrop"
          aria-label="Workflow command bar"
        >
          <div className="workflow-builder-command-dialog">
            <Command loop>
              <CommandInput placeholder="Type a command or search…" autoFocus />
              <CommandList>
                <CommandEmpty>No matching commands.</CommandEmpty>
                {recentCommands.length > 0 && <CommandGroup heading="Recent actions">
                  {recentCommands.map((command) => <WorkflowCommandItem key={command.id} command={command} onSelect={() => runCommand(command.id)} />)}
                </CommandGroup>}
                {(["Canvas", "Navigate", "Workflow"] as const).map((group) => {
                  const commands = WORKFLOW_COMMANDS.filter((command) => command.group === group)
                  return <CommandGroup key={group} heading={group}>
                    {commands.map((command) => <WorkflowCommandItem key={command.id} command={command} onSelect={() => runCommand(command.id)} />)}
                  </CommandGroup>
                })}
                <CommandGroup heading="Add node">
                  {nodeAddCommands.map((node) => <CommandItem key={node.type} value={`add ${node.label} ${node.type}`} onSelect={() => { addNode(node.type); rememberWorkflowCommand("add-step"); setCommandOpen(false) }}><Plus size={15} /><span>Add {node.label}</span></CommandItem>)}
                </CommandGroup>
                <CommandGroup heading="Go to node">
                  {nodeNavigationCommands.map((node) => <CommandItem key={node.id} value={`go to ${node.label} ${node.type}`} onSelect={() => { selectNode(node.id); setCommandOpen(false) }}><PanelRight size={15} /><span>{node.label}</span><kbd>{node.type}</kbd></CommandItem>)}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </dialog>
      )}
    </div>
  );
};

function WorkflowCommandItem({ command, onSelect }: { command: WorkflowCommandDefinition; onSelect: () => void }) {
  const Icon = command.id === "add-step" ? Plus
    : command.id === "fit-view" ? Maximize
      : command.id === "tidy-layout" ? Wand2
        : command.id === "toggle-minimap" ? MapIcon
          : command.id === "toggle-variables" ? Braces
            : command.id === "toggle-inspector" ? PanelRight
              : command.id === "toggle-executions" ? History
                : command.id === "open-setup" ? Settings2
                  : command.id === "save-workflow" ? Save
                    : command.id === "run-workflow" ? Play
                      : command.id === "open-lifecycle" || command.id === "checkpoint" ? Rocket
                        : PanelRight;
  return <CommandItem value={`${command.label} ${command.keywords}`} onSelect={onSelect}><Icon size={15} /><span>{command.label}</span>{command.shortcut && <kbd>{command.shortcut}</kbd>}</CommandItem>;
}

function ToolbarButton({
  onClick,
  disabled,
  title,
  active,
  tone,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  active?: boolean;
  tone?: "primary";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "workflow-builder-tool",
        active ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]" : "",
      )}
      data-active={active}
      data-tone={tone}
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

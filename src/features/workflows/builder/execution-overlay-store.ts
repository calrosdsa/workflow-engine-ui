import { create } from 'zustand'
import type { Execution } from '@/features/executions/types'

// View-only state for the Executions sidebar's canvas overlay (FR-C5-007) —
// deliberately separate from useBuilderStore, since selecting an execution to
// inspect is not an edit to the workflow graph. BaseNode/CustomEdge read this
// directly (the same selector idiom they already use for useBuilderStore)
// since React Flow renders them internally, with no prop-drilling path in.
//
// `data` is populated once, centrally, by whichever component holds the
// useExecution(selectedExecutionId) query (WorkflowBuilderPage) — every
// BaseNode/CustomEdge instance reads the same resolved object instead of each
// re-fetching/re-polling the same execution independently.
interface ExecutionOverlayState {
  selectedExecutionId: string | null
  data: Execution | null
  /** REAL chronological node order (FR-C5-007), computed from the selected
   *  execution's log rows via executionOrder.ts's computeLogOrder — nodeId ->
   *  1-based rank. null means "no log data for this execution" (a run
   *  predating this feature), the signal BaseNode uses to keep rendering
   *  today's static graph-authoring heuristic instead. Populated centrally
   *  alongside `data`, same reasoning: one fetch/compute, every BaseNode
   *  instance reads the same resolved map. */
  logOrder: Record<string, number> | null
  /** A read-only execution snapshot deliberately brought into the editor as
   * reproduction context. It never writes values into the graph or becomes
   * part of the saved workflow definition. */
  copiedExecution: Execution | null
  /** Whether the Workflow Builder's bottom Logs dock is expanded. Lives here,
   *  not in useBuilderStore's exclusive activeSidebar group, on purpose: the
   *  dock sits UNDER the canvas alongside whichever sidebar is open (n8n
   *  shows its executions list and logs panel together), so opening
   *  Executions must never collapse it, nor vice versa. Also independent of
   *  selection — picking another run keeps the user's own expand/collapse
   *  choice instead of fighting it. */
  logsDockOpen: boolean
  select: (executionId: string | null) => void
  /** Unconditional set — unlike select(), never toggles off when the id is
   *  already selected. For programmatic selection (e.g. a just-completed
   *  Run being surfaced) where the caller genuinely wants "this one, for
   *  sure," not "toggle whatever's there." */
  setSelected: (executionId: string | null) => void
  setData: (data: Execution | null) => void
  setLogOrder: (logOrder: Record<string, number> | null) => void
  copyToEditor: (execution: Execution) => void
  clearCopiedExecution: () => void
  setLogsDockOpen: (open: boolean) => void
}

export const useExecutionOverlayStore = create<ExecutionOverlayState>((set) => ({
  selectedExecutionId: null,
  data: null,
  logOrder: null,
  copiedExecution: null,
  logsDockOpen: false,
  select: (executionId) => set((s) => ({
    selectedExecutionId: s.selectedExecutionId === executionId ? null : executionId,
    data: null,
    logOrder: null,
  })),
  setSelected: (executionId) => set({ selectedExecutionId: executionId, data: null, logOrder: null }),
  setData: (data) => set({ data }),
  setLogOrder: (logOrder) => set({ logOrder }),
  copyToEditor: (execution) => set({ copiedExecution: structuredClone(execution) }),
  clearCopiedExecution: () => set({ copiedExecution: null }),
  setLogsDockOpen: (open) => set({ logsDockOpen: open }),
}))

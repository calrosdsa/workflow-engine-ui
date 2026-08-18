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
  select: (executionId: string | null) => void
  /** Unconditional set — unlike select(), never toggles off when the id is
   *  already selected. For programmatic selection (e.g. a just-completed
   *  Run being surfaced) where the caller genuinely wants "this one, for
   *  sure," not "toggle whatever's there." */
  setSelected: (executionId: string | null) => void
  setData: (data: Execution | null) => void
}

export const useExecutionOverlayStore = create<ExecutionOverlayState>((set) => ({
  selectedExecutionId: null,
  data: null,
  select: (executionId) => set((s) => ({
    selectedExecutionId: s.selectedExecutionId === executionId ? null : executionId,
    data: null,
  })),
  setSelected: (executionId) => set({ selectedExecutionId: executionId, data: null }),
  setData: (data) => set({ data }),
}))

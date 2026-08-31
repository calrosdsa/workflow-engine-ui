import { create } from 'zustand'
import type { ReportDefinition, ReportBlock, ReportBlockRegion, ReportVisibility, BlockStyle, ReportSettings, ReportWorkbook, ReportDataSource, ReportArgument, ArgumentBinding } from './types'
import { emptyReportDefinition } from './types'
import { createReportBlock, duplicateReportBlock } from './factory'

// Direct mirror of features/dashboard/store.ts's mutate()-chokepoint +
// undo/redo + coalescing pattern, applied to ReportDefinition instead of
// DashboardSchema — see that file's own extensive doc comments for the full
// reasoning (why not builder-kit/tree-store.ts, why full-snapshot history
// entries, why coalesceKey exists). Not duplicated here at the same length;
// the design rationale is identical, only the schema being mutated differs.

const HISTORY_LIMIT = 50
const COALESCE_WINDOW_MS = 800

export interface ReportStoreState {
  definition: ReportDefinition
  selectedBlockId: string | null
  dirty: boolean

  loadDefinition: (definition: ReportDefinition) => void
  reset: () => void
  markSaved: () => void
  markDirty: () => void

  selectBlock: (id: string | null) => void

  addBlock: (type: string, region?: Partial<ReportBlockRegion>) => string
  updateBlockRegion: (id: string, region: ReportBlockRegion) => void
  updateBlockConfig: (id: string, config: unknown) => void
  updateBlockStyle: (id: string, style: BlockStyle | undefined) => void
  updateBlockName: (id: string, name: string) => void
  duplicateBlockById: (id: string) => void
  removeBlock: (id: string) => void

  // Data sources, arguments, and bindings (FR-J1-005 schema, FR-J1-006 panel).
  // Report-level rather than per-block, so they live beside `blocks` here
  // rather than going through updateBlockConfig.
  addDataSource: (source: ReportDataSource) => void
  updateDataSource: (id: string, patch: Partial<ReportDataSource>) => void
  removeDataSource: (id: string) => void

  addArgument: (argument: ReportArgument, binding?: ArgumentBinding) => void
  updateArgument: (key: string, patch: Partial<ReportArgument>) => void
  removeArgument: (key: string) => void

  addBinding: (binding: ArgumentBinding) => void
  updateBinding: (index: number, patch: Partial<ArgumentBinding>) => void
  removeBinding: (index: number) => void

  updateName: (name: string) => void
  updateVisibility: (visibility: ReportVisibility) => void
  updateSettings: (patch: Partial<ReportSettings>) => void
  updateStyleDefaults: (style: BlockStyle | undefined) => void
  syncWorkbookSnapshot: (workbook: ReportWorkbook) => void

  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

interface HistoryEntry {
  definition: ReportDefinition
  key: string | null
  at: number
}

export const useReportStore = create<ReportStoreState>((set, get) => {
  let undoStack: HistoryEntry[] = []
  let redoStack: ReportDefinition[] = []

  function mutate(fn: (definition: ReportDefinition) => ReportDefinition, coalesceKey: string | null = null) {
    const prevDefinition = get().definition
    const last = undoStack[undoStack.length - 1]
    const canCoalesce =
      coalesceKey !== null &&
      last !== undefined &&
      last.key === coalesceKey &&
      Date.now() - last.at < COALESCE_WINDOW_MS

    if (canCoalesce) {
      last.at = Date.now()
    } else {
      undoStack.push({ definition: prevDefinition, key: coalesceKey, at: Date.now() })
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift()
    }
    redoStack = []
    set(() => ({ definition: fn(prevDefinition), dirty: true, canUndo: true, canRedo: false }))
  }

  return {
    definition: emptyReportDefinition(),
    selectedBlockId: null,
    dirty: false,
    canUndo: false,
    canRedo: false,

    loadDefinition: (definition) => {
      undoStack = []
      redoStack = []
      set({ definition, selectedBlockId: null, dirty: false, canUndo: false, canRedo: false })
    },
    reset: () => {
      undoStack = []
      redoStack = []
      set({ definition: emptyReportDefinition(), selectedBlockId: null, dirty: false, canUndo: false, canRedo: false })
    },
    markSaved: () => set({ dirty: false }),
    markDirty: () => set({ dirty: true }),

    selectBlock: (id) => set({ selectedBlockId: id }),

    addBlock: (type, region) => {
      const created = createReportBlock(type, get().definition.blocks)
      const instance = region
        ? { ...created, ...region, layout: region.layout ?? created.layout }
        : created
      mutate((definition) => ({ ...definition, blocks: [...definition.blocks, instance] }))
      set({ selectedBlockId: instance.id })
      return instance.id
    },

    // Workbook-mode placement changes the block's sheet and grid anchor as
    // one atomic report mutation. The block config is intentionally untouched
    // so a table/group/image never becomes a static cell when it is moved.
    updateBlockRegion: (id, region) => {
      mutate((definition) => ({
        ...definition,
        blocks: definition.blocks.map((b) => (b.id === id ? { ...b, ...region } : b)),
      }), `region:${id}`)
    },

    updateBlockConfig: (id, config) => {
      mutate((definition) => ({
        ...definition,
        blocks: definition.blocks.map((b) => (b.id === id ? { ...b, config } : b)),
      }), `config:${id}`)
    },

    // Coalesced per-block, same reasoning as updateBlockConfig — a style
    // editor's color picker or padding input can fire once per drag/
    // keystroke.
    updateBlockStyle: (id, style) => {
      mutate((definition) => ({
        ...definition,
        blocks: definition.blocks.map((b) => (b.id === id ? { ...b, style } : b)),
      }), `style:${id}`)
    },

    // Coalesced per block, like config and style: naming a region is typed
    // one character at a time and should undo as a single edit.
    updateBlockName: (id, name) => {
      mutate((definition) => ({
        ...definition,
        blocks: definition.blocks.map((b) => (b.id === id ? { ...b, name: name || undefined } : b)),
      }), `name:${id}`)
    },

    duplicateBlockById: (id) => {
      const original = get().definition.blocks.find((b) => b.id === id)
      if (!original) return
      const copy = duplicateReportBlock(original)
      mutate((definition) => ({ ...definition, blocks: [...definition.blocks, copy] }))
      set({ selectedBlockId: copy.id })
    },

    removeBlock: (id) => {
      mutate((definition) => ({ ...definition, blocks: definition.blocks.filter((b) => b.id !== id) }))
      set((state) => (state.selectedBlockId === id ? { selectedBlockId: null } : {}))
    },

    addDataSource: (source) => {
      mutate((definition) => ({
        ...definition,
        data_sources: [...(definition.data_sources ?? []), source],
      }))
    },

    // Coalesced per source: the name and limit fields are typed a character
    // at a time and should undo as one edit, matching updateBlockName.
    updateDataSource: (id, patch) => {
      mutate((definition) => ({
        ...definition,
        data_sources: (definition.data_sources ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }), `source:${id}`)
    },

    // Removing a source also drops the bindings that pointed at it. Leaving
    // them would make the definition fail validation on save ("binding
    // references unknown source_id"), turning a delete into a save error the
    // author cannot see the cause of. Blocks are deliberately NOT rewritten —
    // the panel warns about those first, and silently blanking a region's
    // data is worse than leaving it pointing at a missing source.
    removeDataSource: (id) => {
      mutate((definition) => ({
        ...definition,
        data_sources: (definition.data_sources ?? []).filter((s) => s.id !== id),
        argument_bindings: (definition.argument_bindings ?? []).filter((b) => b.source_id !== id),
      }))
    },

    addArgument: (argument, binding) => {
      mutate((definition) => ({
        ...definition,
        arguments: [...(definition.arguments ?? []), argument],
        argument_bindings: binding
          ? [...(definition.argument_bindings ?? []), binding]
          : definition.argument_bindings,
      }))
    },

    // A key change has to carry its bindings with it, since a binding refers
    // to an argument by key — otherwise renaming an argument orphans every
    // binding it had and fails validation on save.
    updateArgument: (key, patch) => {
      mutate((definition) => {
        const nextKey = patch.key ?? key
        return {
          ...definition,
          arguments: (definition.arguments ?? []).map((a) => (a.key === key ? { ...a, ...patch } : a)),
          argument_bindings: (definition.argument_bindings ?? []).map((b) => (
            b.argument_key === key ? { ...b, argument_key: nextKey } : b
          )),
        }
      }, `argument:${key}`)
    },

    removeArgument: (key) => {
      mutate((definition) => ({
        ...definition,
        arguments: (definition.arguments ?? []).filter((a) => a.key !== key),
        argument_bindings: (definition.argument_bindings ?? []).filter((b) => b.argument_key !== key),
      }))
    },

    addBinding: (binding) => {
      mutate((definition) => ({
        ...definition,
        argument_bindings: [...(definition.argument_bindings ?? []), binding],
      }))
    },

    updateBinding: (index, patch) => {
      mutate((definition) => ({
        ...definition,
        argument_bindings: (definition.argument_bindings ?? []).map((b, i) => (i === index ? { ...b, ...patch } : b)),
      }), `binding:${index}`)
    },

    removeBinding: (index) => {
      mutate((definition) => ({
        ...definition,
        argument_bindings: (definition.argument_bindings ?? []).filter((_, i) => i !== index),
      }))
    },

    updateName: (name) => {
      mutate((definition) => ({ ...definition, name }), 'name')
    },

    updateVisibility: (visibility) => {
      mutate((definition) => ({ ...definition, visibility }))
    },

    // Coalesced by which settings field the caller is touching — a select
    // dropdown's default_format/allowed_formats changes are discrete
    // choices (no coalescing needed, always its own history entry), while
    // style_defaults edits (color pickers, padding inputs) benefit from the
    // same per-field coalescing updateBlockStyle/updateBlockConfig already
    // use. updateSettings itself stays generic (any Partial<ReportSettings>
    // patch) rather than one setter per field, since Settings only has 3
    // fields today and a 4th would otherwise need its own new action.
    updateSettings: (patch) => {
      const coalesceKey = 'style_defaults' in patch ? 'settings:style_defaults' : null
      mutate((definition) => ({
        ...definition,
        settings: { ...definition.settings, ...patch },
      }), coalesceKey)
    },

    updateStyleDefaults: (style) => {
      mutate((definition) => ({
        ...definition,
        settings: { ...definition.settings, style_defaults: style },
      }), 'settings:style_defaults')
    },

    // Keeps the live Univer snapshot beside the semantic definition without
    // creating a separate undo step. The next semantic mutation records this
    // synchronized workbook in its own history entry, so undoing that action
    // cannot resurrect an older grid and discard author cell edits.
    syncWorkbookSnapshot: (workbook) => {
      set((state) => ({
        definition: { ...state.definition, version: 2, workbook },
      }))
    },

    undo: () => {
      const entry = undoStack.pop()
      if (!entry) return
      redoStack.push(get().definition)
      set({ definition: entry.definition, dirty: true, canUndo: undoStack.length > 0, canRedo: true })
    },
    redo: () => {
      const next = redoStack.pop()
      if (next === undefined) return
      undoStack.push({ definition: get().definition, key: null, at: Date.now() })
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift()
      set({ definition: next, dirty: true, canUndo: true, canRedo: redoStack.length > 0 })
    },
  }
})

export function findBlock(definition: ReportDefinition, id: string): ReportBlock | undefined {
  return definition.blocks.find((b) => b.id === id)
}

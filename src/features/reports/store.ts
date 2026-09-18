import { create } from 'zustand'
import type { ReportDefinition, ReportBlock, ReportBlockRegion, ReportVisibility, BlockStyle, ReportSettings, ReportWorkbook, ReportDataSource, ReportArgument, ArgumentBinding, PageSetup, SheetPrintSettings } from './types'
import { emptyReportDefinition } from './types'
import { createReportBlock, duplicateReportBlock } from './factory'
import { normalizeFilterGroup } from './data-sources'

// The backend's `graph.FilterGroup` carries `omitempty` on both its Conditions
// and Groups slices (see normalizeFilterGroup's own doc comment), so a report
// fetched straight from the API can have data-source filters missing `groups`
// (or even `conditions`) entirely — a shape the FilterGroup type promises never
// happens. Left unnormalized, that gap made Save look inert: pruneIncompleteFilters
// always fills those fields back in before POSTing, so the freshly-loaded
// definition and the one just sent to the server were never byte-identical,
// so handleSave's post-save equality check always failed and the editor stayed
// stuck on "Unsaved" even though the save itself had succeeded. Found live.
function normalizeLoadedDefinition(definition: ReportDefinition): ReportDefinition {
  if (!definition.data_sources?.length) return definition
  return {
    ...definition,
    data_sources: definition.data_sources.map((source) =>
      source.filter ? { ...source, filter: normalizeFilterGroup(source.filter) } : source,
    ),
  }
}

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
  updatePageSetup: (page: PageSetup | undefined) => void
  updateSheetPrint: (sheetId: string, print: SheetPrintSettings | undefined) => void
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
      set({ definition: normalizeLoadedDefinition(definition), selectedBlockId: null, dirty: false, canUndo: false, canRedo: false })
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
    // style_defaults/page edits (color pickers, margin inputs, header/footer
    // text typed a character at a time) benefit from the same per-field
    // coalescing updateBlockStyle/updateBlockConfig already use.
    // updateSettings itself stays generic (any Partial<ReportSettings>
    // patch) rather than one setter per field, since a caller that already
    // has a whole ReportSettings patch (e.g. loading a template) shouldn't
    // need to fan it out into several calls.
    updateSettings: (patch) => {
      const coalesceKey =
        'style_defaults' in patch ? 'settings:style_defaults' :
        'page' in patch ? 'settings:page' :
        null
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

    // Dedicated action (rather than always going through updateSettings)
    // for the same reason updateStyleDefaults is: the Page Setup panel edits
    // one field with a known, typed shape, and gets the same coalesced-per-
    // field undo behavior without spreading a Partial<ReportSettings> at
    // every call site.
    updatePageSetup: (page) => {
      mutate((definition) => ({
        ...definition,
        settings: { ...definition.settings, page },
      }), 'settings:page')
    },

    // Print settings live on the sheet they apply to (inside
    // definition.workbook.sheets), not on report-wide Settings — mirrors
    // how column_widths/row_heights/freeze are per-sheet fields today.
    // Coalesced per sheet id, like updateDataSource/updateBlockName: the
    // Page Setup panel's margin/header-text fields are edited one keystroke
    // or one drag at a time and should undo as a single action.
    updateSheetPrint: (sheetId, print) => {
      mutate((definition) => {
        if (!definition.workbook) return definition
        return {
          ...definition,
          workbook: {
            ...definition.workbook,
            sheets: definition.workbook.sheets.map((sheet) =>
              sheet.id === sheetId ? { ...sheet, print } : sheet,
            ),
          },
        }
      }, `sheet-print:${sheetId}`)
    },

    // Keeps the live Univer snapshot beside the semantic definition without
    // creating a separate undo step. The next semantic mutation records this
    // synchronized workbook in its own history entry, so undoing (or
    // redoing) that action cannot resurrect an older grid and discard
    // author cell edits.
    //
    // That guarantee needs an explicit patch to BOTH stacks here, not just a
    // fresh read at the next mutate()/undo()/redo() call:
    //  - undoStack: a COALESCED mutation (region/config/style/name/source/
    //    settings:page/sheet-print) only refreshes its existing undo
    //    entry's timestamp on a repeat call within COALESCE_WINDOW_MS — it
    //    never re-captures `definition`, because the whole point of
    //    coalescing is that a whole burst of same-field edits undoes as the
    //    ORIGINAL pre-burst snapshot in one step. A flush landing between
    //    two calls in that burst would otherwise sit only in the CURRENT
    //    definition, never reach the frozen undo entry, and undo would
    //    silently discard it.
    //  - redoStack: undo() itself pushes the pre-undo definition onto
    //    redoStack (store.ts's own undo()) and that entry is equally frozen
    //    — a flush after an undo, followed by redo(), would otherwise
    //    restore that pre-flush snapshot and discard the flush the same way.
    // Both reproduced empirically before this fix (two coalesced
    // updatePageSetup calls with a sync between them, for undoStack; an
    // undo→sync→redo sequence, for redoStack). Patching the workbook field
    // onto whichever entry is currently on top of EITHER stack keeps that
    // entry able to restore "everything except this specific mutation's own
    // field", exactly like the always-fresh non-coalesced case already
    // does, without needing to know which field any given entry owns.
    syncWorkbookSnapshot: (workbook) => {
      const topUndo = undoStack[undoStack.length - 1]
      if (topUndo) topUndo.definition = { ...topUndo.definition, version: 2, workbook }
      const topRedoIndex = redoStack.length - 1
      if (topRedoIndex >= 0) redoStack[topRedoIndex] = { ...redoStack[topRedoIndex], version: 2, workbook }
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

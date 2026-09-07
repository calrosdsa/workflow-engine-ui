import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import {
  BooleanNumber,
  LocaleType,
  mergeLocales,
  createUniver,
  type IWorkbookData,
} from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import sheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'
import '@univerjs/preset-sheets-core/lib/index.css'
// The table preset is what makes a structured reference resolve while
// authoring: registering a region as a sheet table feeds the formula engine's
// super-table service, so =SUM(Charges[Amount]) evaluates live in the editor
// instead of showing #NAME? until export.
import { UniverSheetsTablePreset } from '@univerjs/preset-sheets-table'
import sheetsTableEnUS from '@univerjs/preset-sheets-table/locales/en-US'
import '@univerjs/preset-sheets-table/lib/index.css'
import { useForms } from '@/features/forms/hooks'
import type { NumberFormat, ReportBlockRegion, ReportDefinition, ReportWorkbook } from '../types'
import { createReportWorkbookBlueprint, type ReportWorkbookBlueprint } from './blueprint'
import { fromUniverWorkbook, numberFormatIndex, toUniverWorkbook } from './contract'
import { excelPattern, patternIndex } from './number-format'
import { withReportRegionGuides } from './guides'
import { InsertDataMenu } from './InsertDataMenu'
import { FormulaSuggestions } from './FormulaSuggestions'
import {
  applySuggestion,
  completionContextAt,
  suggestReferences,
  type ReferenceSuggestion,
} from './formula-autocomplete'
import {
  isValidRegionName,
  projectDefinitionRegions,
  projectedRegionBounds,
  sourceCompletionColumns,
  type FormLookup,
} from './region-projection'

// Univer's own number-format controls are hidden, and this is the decision
// the whole feature turns on rather than a cosmetic tidy-up.
//
// They were live: the toolbar's "General" dropdown, the percent and currency
// buttons, and the two decimal steppers all applied a format that rendered
// on the canvas and was then DISCARDED on save, because Univer stores an
// Excel pattern and a report stores a semantic descriptor. Leaving them
// alongside the report's own Number format panel would mean two authoring
// surfaces writing one field through two vocabularies, disagreeing silently
// because both render identically on the canvas.
//
// They are also strictly less capable for what this feature is for: Univer's
// dropdown cannot express a currency symbol, Bolivian separators, or
// accounting-style negatives. Its date, time, scientific and duration
// entries have never persisted either — they only ever looked like they did.
const SUPPRESSED_NUMFMT_MENU = {
  'sheet.operation.open.numfmt.panel': { hidden: true },
  'sheet.command.numfmt.set.percent': { hidden: true },
  'sheet.command.numfmt.set.currency': { hidden: true },
  'sheet.command.numfmt.add.decimal.command': { hidden: true },
  'sheet.command.numfmt.subtract.decimal.command': { hidden: true },
}

const WORKBOOK_ID = 'report-builder-workbook'
const SHEET_ID = 'report-layout'
const SHEET_NAME = 'Report layout'

export interface UniverWorkbookSurfaceProps {
  definition: ReportDefinition
  onEdited?: () => void
  /** Flushes the live grid into report state before a semantic mutation can
   *  refresh this adapter — the same guard the panel's own controls use, now
   *  needed here because Insert data mutates the definition from inside the
   *  sheet's own toolbar. */
  onBeforeChange?: () => void
}

export interface WorkbookSurfaceHandle {
  save: () => ReportWorkbook | undefined
  getSelection: () => ReportBlockRegion | undefined
  /** Applies (or with undefined, clears) a number format on the current
   *  selection. Owned by the surface rather than the panel because the live
   *  grid is deliberately not rebuilt from the definition on a cell change
   *  — see the workbook memo's dependency list — so a store update alone
   *  would leave the canvas showing the old value. */
  applyNumberFormat: (format: NumberFormat | undefined) => void
  /** The format on the selection's anchor cell, so the panel can show what
   *  is currently set rather than always opening blank. */
  selectedNumberFormat: () => NumberFormat | undefined
}

interface TableHostSheet {
  addTable?: (
    tableName: string,
    range: { startRow: number; startColumn: number; endRow: number; endColumn: number },
    tableId?: string,
  ) => Promise<boolean> | boolean
}

interface NumberFormattableRange {
  getRange: () => { startRow: number; endRow: number; startColumn: number; endColumn: number }
  setNumberFormat?: (pattern: string) => unknown
}

interface EditableSheet {
  getSheetId: () => string
  getActiveRange: () => NumberFormattableRange | null
  getRange?: (row: number, column: number) => {
    getCellRect?: () => DOMRect
    // Narrowed to the shape this file writes — a formula cell. The real
    // signature is (ICellData | CellValue), which this satisfies.
    setValue?: (value: { f: string }) => unknown
  } | null
}

interface ActiveWorkbookHandle {
  save: () => IWorkbookData
  getActiveSheet?: () => EditableSheet
  getSheetBySheetId?: (sheetId: string) => TableHostSheet | null
  endEditingAsync?: (save?: boolean) => Promise<boolean>
}

// The editor remains an adapter: Univer owns interactions, but ReportWorkbook
// is the persisted source of truth. Dynamic report blocks stay semantic
// regions beside that static grid, rather than becoming editor-specific data.
export const UniverWorkbookSurface = forwardRef<WorkbookSurfaceHandle, UniverWorkbookSurfaceProps>(function UniverWorkbookSurface(
  { definition, onEdited, onBeforeChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeWorkbookRef = useRef<ActiveWorkbookHandle | null>(null)
  const [completion, setCompletion] = useState<{
    suggestions: ReferenceSuggestion[]
    anchor: { left: number; top: number; bottom: number }
    apply: (suggestion: ReferenceSuggestion) => void
  } | null>(null)
  // Descriptors applied during THIS editing session. Univer only carries
  // the derived pattern, so without keeping the descriptors a format set and
  // then saved in the same sitting could not be recovered — the definition
  // does not have it yet, and the pattern cannot be parsed back.
  const sessionFormatsRef = useRef<NumberFormat[]>([])
  const definitionRef = useRef(definition)
  definitionRef.current = definition

  // Column headers and per-section styles are resolved from the source form,
  // so a region can only be drawn as a real table once its form is loaded.
  const { data: formList } = useForms()
  const forms: FormLookup = useMemo(
    () => new Map((formList ?? []).map((form) => [form.id, form])),
    [formList],
  )
  const formsRef = useRef(forms)
  formsRef.current = forms

  // AC-01/AC-02's vocabulary. Resolved through the same column pipeline the
  // drawn header row uses, so a suggestion always matches what exports.
  const completionSources = useMemo(
    () => sourceCompletionColumns(definition, forms),
    [definition, forms],
  )
  const completionSourcesRef = useRef(completionSources)
  completionSourcesRef.current = completionSources

  const regionSignature = useMemo(
    () => JSON.stringify(definition.blocks.map((block) => ({
      id: block.id,
      type: block.type,
      sheet_id: block.sheet_id,
      layout: block.layout,
      // A data-configuration or style change now alters the drawn table
      // (its columns and their formatting), so it has to rebuild the guides
      // the way a placement change does.
      config: block.config,
      style: block.style,
    }))),
    [definition.blocks],
  )
  // Loaded forms participate in the signature for the same reason: headers
  // resolve to real labels only once their form arrives.
  const formSignature = useMemo(() => [...forms.keys()].sort().join(','), [forms])

  const initialWorkbook = useMemo(
    () => {
      // Reading the signatures intentionally keys this snapshot to guide
      // placement while the latest full definition stays available by ref.
      void regionSignature
      void formSignature
      const currentDefinition = definitionRef.current
      const currentForms = formsRef.current
      const workbook = currentDefinition.workbook
        ? toUniverWorkbook(currentDefinition.name, currentDefinition.workbook)
        : createProjectedUniverWorkbook(createReportWorkbookBlueprint(currentDefinition, currentForms))
      return withReportRegionGuides(workbook, currentDefinition, currentForms)
    },
    // Name and settings remain outside the live workbook instance,
    // preserving selection and native cell undo.
    [regionSignature, formSignature],
  )

  // The definition's own formats plus this session's, so a format set and
  // saved without a reload still resolves.
  const mergedFormatIndex = () => patternIndex([
    ...numberFormatIndex(definitionRef.current.workbook).values(),
    ...sessionFormatsRef.current,
  ])

  useImperativeHandle(ref, () => ({
    save: () => activeWorkbookRef.current
      // The index comes from the definition being edited plus anything set
      // since it loaded, not from Univer: Univer holds only the derived
      // Excel pattern, and a descriptor cannot be recovered from one.
      // Without this every number format an author set is silently dropped
      // on save, which is what used to happen.
      ? fromUniverWorkbook(
        activeWorkbookRef.current.save(),
        mergedFormatIndex(),
      )
      : definition.workbook,
    applyNumberFormat: (format) => {
      const range = activeWorkbookRef.current?.getActiveSheet?.()?.getActiveRange()
      if (!range?.setNumberFormat) return
      onBeforeChange?.()
      if (format) sessionFormatsRef.current.push(format)
      // Clearing sets Univer's own "General", which carries no pattern — so
      // the descriptor lookup finds nothing on save and the cell comes back
      // with no number_format at all, which is the intent.
      range.setNumberFormat(format ? excelPattern(format) : 'General')
      onEdited?.()
    },
    selectedNumberFormat: () => {
      const workbook = activeWorkbookRef.current
      const sheet = workbook?.getActiveSheet?.()
      const range = sheet?.getActiveRange()?.getRange()
      if (!workbook || !sheet || !range) return undefined
      const snapshot = workbook.save()
      const sheetData = snapshot.sheets?.[sheet.getSheetId()]
      const cell = sheetData?.cellData?.[range.startRow]?.[range.startColumn]
      const style = typeof cell?.s === 'string' ? snapshot.styles?.[cell.s] : cell?.s
      const pattern = (style as { n?: { pattern?: string } } | undefined)?.n?.pattern
      return pattern ? mergedFormatIndex().get(pattern) : undefined
    },
    getSelection: () => {
      const sheet = activeWorkbookRef.current?.getActiveSheet?.()
      const range = sheet?.getActiveRange()?.getRange()
      if (!sheet || !range) return undefined
      return {
        sheet_id: sheet.getSheetId(),
        layout: {
          row: range.startRow,
          col: range.startColumn,
          row_span: range.endRow - range.startRow + 1,
          col_span: range.endColumn - range.startColumn + 1,
        },
      }
    },
  }), [definition.workbook])

  useEffect(() => {
    if (!containerRef.current) return

    const { univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: {
        [LocaleType.EN_US]: mergeLocales(sheetsCoreEnUS, sheetsTableEnUS),
      },
      presets: [
        UniverSheetsCorePreset({
          container: containerRef.current,
          footer: { sheetBar: true, statisticBar: false },
          menu: SUPPRESSED_NUMFMT_MENU,
        }),
        UniverSheetsTablePreset(),
      ],
    })

    const workbook = univerAPI.createWorkbook(initialWorkbook)
    activeWorkbookRef.current = workbook
    registerRegionTables(workbook, definitionRef.current, formsRef.current)
    const subscription = univerAPI.addEvent(univerAPI.Event.CommandExecuted, (event) => {
      // Selecting a cell is an operation, not a report edit. Every other
      // command (typing, formulas, formatting, merges) should activate the
      // report page's normal unsaved-change protection.
      if (!event.id.includes('set-selections')) onEdited?.()
    })

    // --- Structured-reference autocomplete (AC-01..AC-03) ---
    //
    // SheetEditChanging fires per keystroke with the editor's current value.
    // It carries no caret offset, so completion is anchored to the END of the
    // text — correct while typing forward, which is how a formula is written.
    // Editing back into the middle of an existing formula simply offers
    // nothing rather than guessing at a position it cannot see.
    const editing = univerAPI.addEvent(univerAPI.Event.SheetEditChanging, (params) => {
      try {
        const text = params.value?.toPlainText?.() ?? ''
        const context = completionContextAt(text, text.length)
        if (!context) return setCompletion(null)

        const suggestions = suggestReferences(context, completionSourcesRef.current)
        if (suggestions.length === 0) return setCompletion(null)

        const sheet = activeWorkbookRef.current?.getActiveSheet?.()
        const rect = sheet?.getRange?.(params.row, params.column)?.getCellRect?.()
        if (!rect) return setCompletion(null)

        setCompletion({
          suggestions,
          anchor: { left: rect.left, top: rect.top, bottom: rect.bottom },
          apply: (suggestion) => {
            const completed = applySuggestion(text, context, suggestion)
            // The editor is canvas-rendered with its own document model, so
            // there is no text node to splice into: end the edit discarding
            // the partial text, then write the finished formula through the
            // range. applySuggestion balances the parens precisely so what
            // lands here is always a valid formula.
            void Promise.resolve(activeWorkbookRef.current?.endEditingAsync?.(false))
              .then(() => {
                activeWorkbookRef.current
                  ?.getActiveSheet?.()
                  ?.getRange?.(params.row, params.column)
                  ?.setValue?.({ f: completed })
                onEdited?.()
              })
              .catch(() => {
                // Completion is a convenience; a failure here must never take
                // the editor down with it.
              })
            setCompletion(null)
          },
        })
      } catch {
        setCompletion(null)
      }
    })

    // The popup is only meaningful while a cell is being edited.
    const editEnded = univerAPI.addEvent(univerAPI.Event.SheetEditEnded, () => setCompletion(null))

    return () => {
      subscription.dispose()
      editing.dispose()
      editEnded.dispose()
      setCompletion(null)
      activeWorkbookRef.current = null
      univerAPI.dispose()
    }
  }, [initialWorkbook, onEdited])

  return (
    <section
      className="flex min-w-0 flex-1 flex-col bg-[hsl(var(--background))]"
      aria-label="Spreadsheet report layout"
      data-report-workbook
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 py-2 text-xs text-[hsl(var(--muted-foreground))]">
        {/* SN-01: placing data starts from the sheet — select a range, choose a
            source. This is the affordance the panel's old "Insert region" grid
            became. */}
        <InsertDataMenu
          getSelection={() => {
            const sheet = activeWorkbookRef.current?.getActiveSheet?.()
            const range = sheet?.getActiveRange()?.getRange()
            if (!sheet || !range) return undefined
            return {
              sheet_id: sheet.getSheetId(),
              layout: {
                row: range.startRow,
                col: range.startColumn,
                row_span: range.endRow - range.startRow + 1,
                col_span: range.endColumn - range.startColumn + 1,
              },
            }
          }}
          onBeforeChange={onBeforeChange}
        />
        <span className="h-3 w-px bg-[hsl(var(--border))]" aria-hidden="true" />
        <span>Static cell values, formulas, formatting, and merges save with this report.</span>
        <span className="ml-auto rounded-full bg-[hsl(var(--primary))]/10 px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--primary))]">
          Data regions are semantic guides
        </span>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />

      {completion && (
        <FormulaSuggestions
          suggestions={completion.suggestions}
          anchor={completion.anchor}
          onAccept={completion.apply}
        />
      )}
    </section>
  )
})

/**
 * Registers every named data region as a sheet table.
 *
 * This is what lets `=SUM(Charges[Amount])` resolve while the author is still
 * editing: Univer's table feature feeds the formula engine's super-table
 * service, so the structured reference the backend resolves at export is the
 * same one the editor evaluates against the drawn header row and placeholder
 * rows. Without it the formula is valid but shows #NAME? until download.
 *
 * Registration is best-effort and never throws into the render path — a
 * duplicate or rejected table name must not take the whole editor down, and
 * the export still resolves the reference on its own.
 */
function registerRegionTables(
  workbook: ActiveWorkbookHandle | null,
  definition: ReportDefinition,
  forms: FormLookup,
): void {
  if (!workbook?.getSheetBySheetId) return

  const projections = projectDefinitionRegions(definition, forms)
  const defaultSheetID = definition.workbook?.sheets[0]?.id ?? SHEET_ID

  definition.blocks.forEach((block) => {
    // Only a named region with real columns is addressable; a single-cell
    // placeholder has no header row for a reference to resolve against.
    if (!isValidRegionName(block.name)) return
    const cells = projections.get(block.id)
    if (!cells || cells.length < 2) return
    const bounds = projectedRegionBounds(cells)
    if (!bounds) return

    try {
      const sheet = workbook.getSheetBySheetId?.(block.sheet_id || defaultSheetID)
      void sheet?.addTable?.(block.name as string, bounds, `report-region-${block.id}`)
    } catch {
      // Registration is an editor convenience; export resolves regardless.
    }
  })
}

// Builds the empty grid a report without a saved workbook starts from.
// Region content is drawn afterwards by withReportRegionGuides, which is the
// single place a semantic block becomes cells.
function createProjectedUniverWorkbook(blueprint: ReportWorkbookBlueprint): Partial<IWorkbookData> {
  return {
    id: WORKBOOK_ID,
    name: blueprint.name,
    sheetOrder: [SHEET_ID],
    sheets: {
      [SHEET_ID]: {
        id: SHEET_ID,
        name: SHEET_NAME,
        rowCount: blueprint.rowCount,
        columnCount: blueprint.columnCount,
        defaultColumnWidth: 112,
        defaultRowHeight: 28,
        freeze: { xSplit: 0, ySplit: 0, startRow: 0, startColumn: 0 },
        cellData: {},
        mergeData: [],
        showGridlines: BooleanNumber.TRUE,
        rowHeader: { width: 46 },
        columnHeader: { height: 30 },
      },
    },
  }
}

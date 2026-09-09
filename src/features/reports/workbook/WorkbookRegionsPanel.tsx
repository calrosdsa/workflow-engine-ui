import { Copy, Database, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { StyleEditor } from '../StyleEditor'
import { allReportBlocks, getReportBlock } from '../report-block-registry'
import { useReportStore, findBlock } from '../store'
import { DataSourcesSection } from './DataSourcesSection'
import { ArgumentsSection } from './ArgumentsSection'
import type { BlockLayout, NumberFormat, ReportBlockRegion } from '../types'
import { NumberFormatSection } from './NumberFormatSection'

/** Block types that read a report DATA SOURCE, and so are placed by the
 *  sheet-native "Insert data" gesture (SN-01) rather than by a panel button
 *  — table/group have a source_id to pick, so InsertDataMenu's own
 *  source-keyed list is where they belong. "related" is NOT a data-source
 *  block despite reading data: RelatedBlockConfig has no source_id at all
 *  (it names a parent/child form pair directly, block_related.go), so
 *  InsertDataMenu's "place THIS source here" gesture cannot express it —
 *  it keeps a direct insert here instead, the same as text/image, and its
 *  own ConfigPanel is where its parent/child forms get picked afterwards. */
const DATA_SOURCE_BLOCK_TYPES = new Set(['table', 'group'])

const FALLBACK_SHEET = { id: 'report-layout', name: 'Report layout' }

interface WorkbookRegionsPanelProps {
  getSelection?: () => ReportBlockRegion | undefined
  /** Reads and writes the number format on the sheet's current selection.
   *  Both are owned by the workbook surface rather than this panel: the live
   *  grid is deliberately not rebuilt from the definition on a cell change,
   *  so a store update alone would leave the canvas stale. */
  readNumberFormat?: () => NumberFormat | undefined
  applyNumberFormat?: (format: NumberFormat | undefined) => void
  /** Saves the live workbook before a semantic-region mutation can cause the
   * editor adapter to refresh from report state. */
  onBeforeChange?: () => void
}

// The Workbook is the report's sole authoring surface. This panel owns the
// semantic layer beside the grid: creating data regions, configuring their
// source/output, styling them, and binding them to selected worksheet cells.
export function WorkbookRegionsPanel({ getSelection, readNumberFormat, applyNumberFormat, onBeforeChange }: WorkbookRegionsPanelProps) {
  const definition = useReportStore((state) => state.definition)
  const selectedBlockId = useReportStore((state) => state.selectedBlockId)
  const addBlock = useReportStore((state) => state.addBlock)
  const selectBlock = useReportStore((state) => state.selectBlock)
  const updateBlockRegion = useReportStore((state) => state.updateBlockRegion)
  const updateBlockConfig = useReportStore((state) => state.updateBlockConfig)
  const updateBlockStyle = useReportStore((state) => state.updateBlockStyle)
  const updateBlockName = useReportStore((state) => state.updateBlockName)
  const duplicateBlockById = useReportStore((state) => state.duplicateBlockById)
  const removeBlock = useReportStore((state) => state.removeBlock)

  const sheets = definition.workbook?.sheets ?? [FALLBACK_SHEET]
  const selectedBlock = selectedBlockId ? findBlock(definition, selectedBlockId) : undefined
  const selectedSheetID = selectedBlock?.sheet_id || sheets[0].id
  const selectedDefinition = selectedBlock ? getReportBlock(selectedBlock.type) : undefined

  const mutateRegionSafely = (mutation: () => void) => {
    onBeforeChange?.()
    mutation()
  }

  const addRegion = (type: string) => {
    const selection = getSelection?.()
    mutateRegionSafely(() => addBlock(type, selection ?? { sheet_id: sheets[0].id }))
  }

  const updateLayout = (patch: Partial<BlockLayout>) => {
    if (!selectedBlock) return
    mutateRegionSafely(() => updateBlockRegion(selectedBlock.id, {
      sheet_id: selectedSheetID,
      layout: { ...selectedBlock.layout, ...patch },
    }))
  }

  const updateSheet = (sheetID: string) => {
    if (!selectedBlock) return
    mutateRegionSafely(() => updateBlockRegion(selectedBlock.id, { sheet_id: sheetID, layout: selectedBlock.layout }))
  }

  const placeAtSelection = () => {
    if (!selectedBlock) return
    const region = getSelection?.()
    if (region) mutateRegionSafely(() => updateBlockRegion(selectedBlock.id, region))
  }

  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]" aria-label="Report data and regions">
      <div className="border-b border-[hsl(var(--border))] px-4 py-3">
        <div className="flex items-center gap-2">
          <Database size={15} className="text-[hsl(var(--primary))]" />
          <h2 className="text-xs font-semibold text-[hsl(var(--foreground))]">Report data</h2>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
          Add semantic regions, configure their data, then place them on selected cells.
        </p>
      </div>

      <ScrollArea className="flex-1">
        {/* DP-06: the five-block insert grid is gone. Placing data is now a
            sheet gesture (select a range, insert a source) — see InsertDataBar
            above the grid. The block *types* remain in the schema and registry;
            only the panel-driven insertion affordance was removed. Non-data
            regions (text, image) keep a direct insert here, since there is no
            data source to choose for them. */}
        <DataSourcesSection onBeforeChange={onBeforeChange} />
        <ArgumentsSection onBeforeChange={onBeforeChange} />

        <section className="border-b border-[hsl(var(--border))] p-3" aria-labelledby="insert-static-heading">
          <h3 id="insert-static-heading" className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Insert
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {allReportBlocks().filter((b) => !DATA_SOURCE_BLOCK_TYPES.has(b.type)).map((blockDefinition) => {
              const Icon = blockDefinition.icon
              return (
                <Button
                  key={blockDefinition.type}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto min-h-9 justify-start gap-2 px-2 py-1.5 text-xs"
                  aria-label={`Add ${blockDefinition.label} region`}
                  title={blockDefinition.description}
                  onClick={() => addRegion(blockDefinition.type)}
                >
                  <Plus size={12} className="shrink-0 text-[hsl(var(--primary))]" />
                  <Icon size={13} className="shrink-0" />
                  <span className="truncate">{blockDefinition.label}</span>
                </Button>
              )
            })}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
            To place data, select cells in the sheet and use <strong>Insert data</strong> above the grid.
          </p>
        </section>

        {readNumberFormat && applyNumberFormat && (
          <section className="border-b border-[hsl(var(--border))] p-3" aria-labelledby="number-format-heading">
            <h3 id="number-format-heading" className="sr-only">Number format</h3>
            <NumberFormatSection read={readNumberFormat} apply={applyNumberFormat} getSelection={getSelection} />
          </section>
        )}

        <section className="border-b border-[hsl(var(--border))] p-2" aria-labelledby="regions-heading">
          <h3 id="regions-heading" className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Regions
          </h3>
          {definition.blocks.length === 0 ? (
            <p className="px-2 py-3 text-xs text-[hsl(var(--muted-foreground))]">
              Select worksheet cells and add your first region.
            </p>
          ) : (
            <div className="space-y-1">
              {definition.blocks.map((block) => {
                const blockDefinition = getReportBlock(block.type)
                const selected = selectedBlockId === block.id
                return (
                  <button
                    key={block.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectBlock(block.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors',
                      selected
                        ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                        : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
                    )}
                  >
                    <GripVertical size={13} className="shrink-0 opacity-50" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{blockDefinition?.label ?? block.type} · {block.id}</span>
                      <span className="block text-[10px] opacity-70">{sheetName(sheets, block.sheet_id)} · R{block.layout.row + 1} C{block.layout.col + 1}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {selectedBlock && (
          <section className="space-y-4 p-4" aria-label="Selected region settings">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[hsl(var(--foreground))]">{selectedDefinition?.label ?? selectedBlock.type}</p>
                <p className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">{selectedBlock.id}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Duplicate region" onClick={() => mutateRegionSafely(() => duplicateBlockById(selectedBlock.id))}>
                  <Copy size={13} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[hsl(var(--destructive))]"
                  aria-label="Remove region"
                  onClick={() => {
                    if (window.confirm('Remove this region from the report?')) {
                      mutateRegionSafely(() => removeBlock(selectedBlock.id))
                    }
                  }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-[hsl(var(--border))] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Placement</p>
              <div className="space-y-1.5">
                <Label htmlFor="report-region-sheet" className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Sheet</Label>
                <select
                  id="report-region-sheet"
                  value={selectedSheetID}
                  onChange={(event) => updateSheet(event.target.value)}
                  className="flex h-8 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-sm text-[hsl(var(--foreground))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                >
                  {sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <CoordinateInput id="report-region-row" label="Row" value={selectedBlock.layout.row + 1} onChange={(value) => updateLayout({ row: Math.max(0, value - 1) })} />
                <CoordinateInput id="report-region-column" label="Column" value={selectedBlock.layout.col + 1} onChange={(value) => updateLayout({ col: Math.max(0, value - 1) })} />
                <CoordinateInput id="report-region-height" label="Height" value={Math.max(1, selectedBlock.layout.row_span || 1)} onChange={(value) => updateLayout({ row_span: Math.max(1, value) })} />
                <CoordinateInput id="report-region-width" label="Width" value={Math.max(1, selectedBlock.layout.col_span || 1)} onChange={(value) => updateLayout({ col_span: Math.max(1, value) })} />
              </div>

              {getSelection && (
                <Button type="button" variant="outline" size="sm" onClick={placeAtSelection} className="w-full text-xs">
                  Place at selected cells
                </Button>
              )}
            </div>

            <div className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Reference name</p>
              <input
                id="report-region-name"
                type="text"
                value={selectedBlock.name ?? ''}
                placeholder="e.g. Charges"
                onChange={(event) => mutateRegionSafely(() => updateBlockName(selectedBlock.id, event.target.value))}
                className="h-8 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/15"
              />
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {selectedBlock.name
                  ? `Reference this region from any cell — e.g. =SUM(${selectedBlock.name}[Amount])`
                  : 'Name this region to reference its columns from a cell formula.'}
              </p>
            </div>

            <div className="space-y-3 rounded-md border border-[hsl(var(--border))] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Data and content</p>
              {selectedDefinition ? (
                <selectedDefinition.ConfigPanel
                  config={selectedDefinition.parseConfig(selectedBlock.config)}
                  onChange={(config) => mutateRegionSafely(() => updateBlockConfig(selectedBlock.id, config))}
                />
              ) : (
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  This region type is unavailable. Its saved configuration and placement are preserved.
                </p>
              )}
            </div>

            <details className="rounded-md border border-[hsl(var(--border))] p-3">
              <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Region formatting</summary>
              <p className="mt-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
                Applies to this region in previews and supported exports. Cell formatting remains available in the workbook toolbar.
              </p>
              <div className="mt-3">
                <StyleEditor
                  style={selectedBlock.style ?? {}}
                  onChange={(style) => mutateRegionSafely(() => updateBlockStyle(selectedBlock.id, Object.keys(style).length === 0 ? undefined : style))}
                  isBlockOverride
                />
              </div>
            </details>
          </section>
        )}
      </ScrollArea>
    </aside>
  )
}

function sheetName(sheets: Array<{ id: string; name: string }>, sheetID?: string): string {
  return sheets.find((sheet) => sheet.id === sheetID)?.name ?? sheets[0]?.name ?? 'Sheet'
}

function CoordinateInput({ id, label, value, onChange }: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{label}</Label>
      <Input
        id={id}
        type="number"
        min={1}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next) && next > 0) onChange(Math.floor(next))
        }}
        className="h-8 text-sm"
      />
    </div>
  )
}

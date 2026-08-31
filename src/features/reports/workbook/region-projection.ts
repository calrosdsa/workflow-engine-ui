import type { FormDefinition } from '@/features/forms/types'
import type { BlockStyle, ReportBlock, ReportDefinition } from '../types'
import { parseTableBlockConfig, type ColumnConfig, type TableStyles } from '../blocks/table/schema'
import { parseRelatedBlockConfig } from '../blocks/related/schema'
import { parseGroupBlockConfig } from '../blocks/group/schema'
import { parseTextBlockConfig } from '../blocks/text/schema'
import { parseImageBlockConfig } from '../blocks/image/schema'

// A semantic region is drawn in the editor as REAL per-column, per-row cells
// rather than one merged placeholder, so a data region reads as an actual
// spreadsheet table an author can see and style.
//
// Every header string and style-resolution rule below deliberately mirrors
// its Go counterpart (internal/reports/block_table.go's resolveColumnHeaders
// and defaultColumns, block_group.go's header assembly, style.go's
// HeaderCellStyle/BodyCellStyle). The editor is a preview of the export, so a
// divergence here would show the author a table that the generated file does
// not actually produce.
export interface ProjectedRegionCell {
  row: number
  col: number
  value: string
  style?: BlockStyle
  /** Header cells are the region's first row; body cells are its placeholders. */
  isHeader: boolean
}

export type FormLookup = ReadonlyMap<string, FormDefinition>

/** Data-source id to the form it reads. A source-backed block names a source,
 *  not a form, so headers can only resolve once that indirection is followed
 *  — without this a region inserted from the sheet would draw its "configure
 *  data" placeholder even though it is fully configured. */
export type SourceLookup = ReadonlyMap<string, string>

/** The form a block actually reads: its data source's form when it has one,
 *  otherwise the form it names directly (the pre-FR-J1-005 shape, DS-07). */
function resolveFormID(configFormID: string | undefined, sourceID: string | undefined, sources?: SourceLookup): string | undefined {
  if (sourceID) return sources?.get(sourceID)
  return configFormID || undefined
}

/** Placeholder body rows drawn beneath a region's header row. Real row counts
 *  are only known at generation time, so the editor shows a fixed, small
 *  sample of the table's shape rather than implying a specific size. */
const PLACEHOLDER_ROW_COUNT = 3
const PLACEHOLDER_VALUE = '···'

// Mirrors defaultColumns (block_table.go): every field except the two virtual
// parent-side line-item types, which have no column representation.
const NON_COLUMN_FIELD_TYPES = new Set(['line_item_count', 'line_item_adopted'])

/** Field-by-field merge mirroring Go's ResolveStyle: a set field on the
 *  override wins, an unset one inherits the base. */
export function mergeBlockStyle(base?: BlockStyle, override?: BlockStyle): BlockStyle {
  const out: BlockStyle = { ...(base ?? {}) }
  if (!override) return out
  if (override.border !== undefined) out.border = override.border
  if (override.bold !== undefined) out.bold = override.bold
  if (override.italic !== undefined) out.italic = override.italic
  if (override.align) out.align = override.align
  if (override.padding !== undefined) out.padding = override.padding
  if (override.text_color) out.text_color = override.text_color
  if (override.fill_color) out.fill_color = override.fill_color
  return out
}

/** Mirrors ResolvedTable.HeaderCellStyle: the base style merged with the
 *  table's header override, with bold defaulting on unless the author
 *  explicitly set it. */
function headerCellStyle(base: BlockStyle, styles?: TableStyles): BlockStyle {
  const style = mergeBlockStyle(base, styles?.header)
  if (styles?.header?.bold === undefined) style.bold = true
  return style
}

/** Mirrors ResolvedTable.BodyCellStyle. */
function bodyCellStyle(base: BlockStyle, styles?: TableStyles): BlockStyle {
  return mergeBlockStyle(base, styles?.body)
}

/** The block's own resolved base style: report-wide defaults with the block's
 *  style layered over them, matching ResolveBlock's own ResolveStyle call. */
function baseBlockStyle(block: ReportBlock, styleDefaults?: BlockStyle): BlockStyle {
  return mergeBlockStyle(styleDefaults, block.style)
}

function defaultColumns(form?: FormDefinition): ColumnConfig[] {
  if (!form) return []
  return form.fields
    .filter((f) => !NON_COLUMN_FIELD_TYPES.has(f.type))
    .map((f) => ({ key: f.name }))
}

/** Mirrors resolveColumnHeaders (block_table.go): explicit label wins, then a
 *  computed column falls back to its key, then the source field's own label,
 *  then the raw key. */
function columnHeaders(columns: ColumnConfig[], form?: FormDefinition): string[] {
  const labelByKey = new Map((form?.fields ?? []).map((f) => [f.name, f.label]))
  return columns.map((c) => {
    if (c.label) return c.label
    if (c.expression) return c.key
    return labelByKey.get(c.key) || c.key
  })
}

/** Mirrors block_group.go's header assembly. Note the group-by dimension uses
 *  its raw field NAME (not the field's label) — matching the backend exactly,
 *  even though the table blocks resolve labels. */
function groupHeaders(block: ReportBlock): string[] {
  const cfg = parseGroupBlockConfig(block.config)
  const headers: string[] = []
  if (cfg.group_by?.field) headers.push(cfg.group_by.field)
  for (const s of cfg.series) {
    if (s.label) headers.push(s.label)
    else if (s.field) headers.push(`${s.fn}(${s.field})`)
    else headers.push(s.fn)
  }
  return headers
}

/** Resolves the header row a tabular block will export, or undefined for a
 *  block type that is not tabular. */
function tabularHeaders(block: ReportBlock, forms: FormLookup, sources?: SourceLookup): string[] | undefined {
  switch (block.type) {
    case 'table': {
      const cfg = parseTableBlockConfig(block.config)
      const formID = resolveFormID(cfg.form_id, cfg.source_id, sources)
      if (!formID) return undefined
      const form = forms.get(formID)
      const columns = cfg.columns?.length ? cfg.columns : defaultColumns(form)
      return columns.length > 0 ? columnHeaders(columns, form) : undefined
    }
    case 'related': {
      const cfg = parseRelatedBlockConfig(block.config)
      if (!cfg.child_form_id) return undefined
      const form = forms.get(cfg.child_form_id)
      const columns = cfg.columns?.length ? cfg.columns : defaultColumns(form)
      return columns.length > 0 ? columnHeaders(columns, form) : undefined
    }
    case 'group': {
      const headers = groupHeaders(block)
      return headers.length > 0 ? headers : undefined
    }
    default:
      return undefined
  }
}

/** The table styles a block carries, if its type supports per-section styling. */
function tableStylesFor(block: ReportBlock): TableStyles | undefined {
  return block.type === 'table' ? parseTableBlockConfig(block.config).style : undefined
}

/** Single-cell label for a block that has no tabular shape — either a
 *  non-tabular type, or a tabular one that is not configured far enough to
 *  know its columns yet. */
function describeBlock(block: ReportBlock): string {
  switch (block.type) {
    case 'text': {
      const config = parseTextBlockConfig(block.config)
      return config.text || 'Text'
    }
    case 'image': {
      const config = parseImageBlockConfig(block.config)
      return config.alt ? `Image · ${config.alt}` : 'Image'
    }
    case 'table':
      return 'Table · configure data'
    case 'related':
      return 'Related records · configure data'
    case 'group':
      return 'Summary · configure grouping'
    default:
      return block.type || 'Block'
  }
}

/**
 * Projects one block into the cells the editor should draw for it.
 *
 * A configured tabular block yields a real header row (one cell per column,
 * in the header style) plus placeholder body rows in the body style. Every
 * other block stays a single labelled cell.
 */
export function projectRegionCells(
  block: ReportBlock,
  forms: FormLookup,
  styleDefaults?: BlockStyle,
  sources?: SourceLookup,
): ProjectedRegionCell[] {
  const row = Math.max(0, block.layout.row)
  const col = Math.max(0, block.layout.col)
  const base = baseBlockStyle(block, styleDefaults)
  const headers = tabularHeaders(block, forms, sources)

  if (!headers) {
    return [{ row, col, value: describeBlock(block), style: base, isHeader: false }]
  }

  const styles = tableStylesFor(block)
  const header = headerCellStyle(base, styles)
  const body = bodyCellStyle(base, styles)

  const cells: ProjectedRegionCell[] = headers.map((value, index) => ({
    row,
    col: col + index,
    value,
    style: header,
    isHeader: true,
  }))

  for (let offset = 0; offset < PLACEHOLDER_ROW_COUNT; offset++) {
    for (let index = 0; index < headers.length; index++) {
      cells.push({
        row: row + 1 + offset,
        col: col + index,
        value: PLACEHOLDER_VALUE,
        style: body,
        isHeader: false,
      })
    }
  }

  return cells
}

// A region name becomes a formula identifier (Charges[Amount]), so it has to
// match what the backend resolver accepts — internal/reports/structured_ref.go
// uses this same shape. A name with a space or punctuation would register a
// table the exported formula could never reference.
const REGION_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.]*$/

export function isValidRegionName(name: string | undefined): boolean {
  return !!name && REGION_NAME_PATTERN.test(name)
}

export interface RegionBounds {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

/** The rectangle a projection occupies, used to register the region as a
 *  spreadsheet table the formula engine can resolve references against. */
export function projectedRegionBounds(cells: ProjectedRegionCell[]): RegionBounds | undefined {
  if (cells.length === 0) return undefined
  let startRow = cells[0].row
  let endRow = cells[0].row
  let startColumn = cells[0].col
  let endColumn = cells[0].col
  for (const cell of cells) {
    if (cell.row < startRow) startRow = cell.row
    if (cell.row > endRow) endRow = cell.row
    if (cell.col < startColumn) startColumn = cell.col
    if (cell.col > endColumn) endColumn = cell.col
  }
  return { startRow, endRow, startColumn, endColumn }
}

/** Every block's projected cells, for sizing and drawing the editor grid. */
export function projectDefinitionRegions(
  definition: Pick<ReportDefinition, 'blocks' | 'settings' | 'data_sources'>,
  forms: FormLookup,
): Map<string, ProjectedRegionCell[]> {
  const styleDefaults = definition.settings?.style_defaults
  const sources = sourceLookup(definition)
  return new Map(
    definition.blocks.map((block) => [block.id, projectRegionCells(block, forms, styleDefaults, sources)]),
  )
}

/** Builds the source-id to form-id index every projection needs. */
export function sourceLookup(definition: Pick<ReportDefinition, 'data_sources'>): SourceLookup {
  return new Map((definition.data_sources ?? []).map((source) => [source.id, source.form_id]))
}

/** A data source's resolved column labels, for formula autocomplete (AC-02).
 *
 *  Deliberately routed through the SAME `defaultColumns`/`columnHeaders` pair
 *  the drawn header row uses, so a suggested column is always one the export
 *  actually produces — including the exclusions `defaultColumns` applies. A
 *  second, parallel notion of "this source's columns" would drift from the
 *  header row the author is looking at. */
export function sourceCompletionColumns(
  definition: Pick<ReportDefinition, 'data_sources'>,
  forms: FormLookup,
): Array<{ name: string; columns: string[] }> {
  return (definition.data_sources ?? []).map((source) => {
    const form = forms.get(source.form_id)
    return { name: source.name, columns: columnHeaders(defaultColumns(form), form) }
  })
}

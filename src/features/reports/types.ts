// Mirrors internal/reports.ReportDefinition (Go) and its sub-types exactly
// (FR-J1-003). This is the report-definition JSON schema's frontend-side
// type — the same shape whether authored by the (not-yet-built) drag-and-
// drop canvas, hand-constructed by this codebase's own minimal create form,
// or, per FR-J1-003's own explicit design goal, a future report-authoring
// agent calling the API directly.

import type { FilterGroup } from '@/features/workflows/types'

export type ExportFormat = 'csv' | 'xlsx' | 'xls' | 'pdf' | 'docx' | 'markdown'

/** Display label per export format. Lives here beside ExportFormat rather
 *  than in whichever component happened to need it first, so the settings
 *  panel's format picker and the preview screen's cannot drift apart. */
export const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV',
  xlsx: 'Excel (.xlsx)',
  xls: 'Excel 97-2003 (.xls)',
  pdf: 'PDF',
  docx: 'Word (.docx)',
  markdown: 'Markdown',
}

export const ALL_FORMATS = Object.keys(FORMAT_LABELS) as ExportFormat[]

/**
 * How a generated file of this format can be shown on screen.
 *
 *  - 'pdf'  — the browser renders it natively in an iframe (the app's CSP
 *             allows blob: under frame-src; note object-src is 'none', so it
 *             must be an <iframe>, never an <object>/<embed>).
 *  - 'text' — plain text we can read out of the blob and print as-is.
 *  - 'none' — a binary office format with no renderer in this app. There is
 *             deliberately no client-side xlsx/docx renderer: showing a
 *             re-rendered approximation is exactly how a preview starts
 *             disagreeing with the file it claims to preview.
 */
export const FORMAT_PREVIEW_KIND: Record<ExportFormat, 'pdf' | 'text' | 'none'> = {
  pdf: 'pdf',
  markdown: 'text',
  csv: 'text',
  xlsx: 'none',
  xls: 'none',
  docx: 'none',
}

export type VisibilityMode = 'public' | 'specific_roles' | 'specific_people'

export interface ReportVisibility {
  mode: VisibilityMode
  role_ids?: string[]
  user_ids?: string[]
}

export interface BlockLayout {
  row: number
  col: number
  row_span: number
  col_span: number
}

export interface BorderStyle {
  width?: number
  color?: string
}

export interface Padding {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

// bold/italic are tri-state despite the TS type reading like plain
// booleans: `boolean | undefined` already distinguishes "unset" (the key
// omitted from the JSON, inherits the report default) from "explicitly
// false" (the key present with value false, overrides an inherited true
// back off) — the same tri-state internal/reports.BlockStyle's *bool
// Bold/Italic fields represent explicitly in Go, where a plain bool's zero
// value can't be told apart from "unspecified" (found and fixed 2026-08-30,
// see that Go type's own doc comment for the full bug history).
export interface BlockStyle {
  border?: BorderStyle
  bold?: boolean
  italic?: boolean
  align?: 'left' | 'center' | 'right'
  padding?: Padding
  text_color?: string
  fill_color?: string
}

export interface ReportBlock {
  id: string
  /** Author-facing handle a structured reference targets: a region named
   *  "Charges" is addressable as `=SUM(Charges[Amount])` from any static
   *  cell. Optional — an unnamed region simply isn't addressable. */
  name?: string
  type: string
  sheet_id?: string
  layout: BlockLayout
  config: unknown
  style?: BlockStyle
}

// ReportBlockRegion is the workbook-facing placement of a semantic block.
// It deliberately carries no cell contents or editor-specific state: the
// block remains responsible for its own query/configuration while this shape
// only says where its resolved output belongs.
export interface ReportBlockRegion {
  sheet_id: string
  layout: BlockLayout
}

export type WorkbookCellValue = string | number | boolean

export interface WorkbookCellStyle extends BlockStyle {
  font_family?: string
  font_size?: number
  vertical_align?: 'top' | 'middle' | 'bottom'
  wrap?: boolean
}

export interface WorkbookCell {
  row: number
  col: number
  value?: WorkbookCellValue
  formula?: string
  style?: WorkbookCellStyle
}

export interface WorkbookMerge {
  start_row: number
  end_row: number
  start_col: number
  end_col: number
}

// ColumnWidth is one sheet column's author-set width, in the same pixel
// unit Univer's own column resize uses (IColumnData.w) — see contract.ts's
// fromUniverSheet/toUniverWorkbook for the round-trip with the editor.
export interface ColumnWidth {
  col: number
  width: number
}

export interface ReportWorkbookSheet {
  id: string
  name: string
  row_count: number
  column_count: number
  cells?: WorkbookCell[]
  merges?: WorkbookMerge[]
  column_widths?: ColumnWidth[]
}

// Version 2 adds a portable spreadsheet template while retaining `blocks`
// for semantic, data-backed report regions. The editor is free to change;
// this is the JSON contract persisted by the API, not a vendor snapshot.
export interface ReportWorkbook {
  sheets: ReportWorkbookSheet[]
}

export interface ReportSettings {
  default_format?: ExportFormat
  allowed_formats?: ExportFormat[]
  style_defaults?: BlockStyle
}

// Mirrors internal/reports' data-source and argument schema (FR-J1-005)
// field-for-field, snake_case matching the Go JSON tags.

/** A comparison operator from graph.CompareOp. Deliberately has no `between`:
 *  none exists in the backend's operator set, which is exactly why a date
 *  range is expressed by an argument's `range` flag instead. */
export type CompareOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'starts_with' | 'in' | 'is_null' | 'not_null'

export interface SortRule {
  field: string
  dir: 'asc' | 'desc'
}

export interface DataSourceParent {
  source_id: string
  relationship_field?: string
}

/** A named dataset the report reads. `name` doubles as the structured-
 *  reference identifier (`Charges[Amount]`), so it must be a valid
 *  identifier — see isValidRegionName. */
export interface ReportDataSource {
  id: string
  name: string
  form_id: string
  /** Authored with the shared FilterBuilder, so this carries that editor's
   *  `FilterGroup` shape (ids, value_mode, expression). Go's decoder drops the
   *  editor-only fields, leaving the `graph.FilterGroup` the engine reads —
   *  the same round trip a workflow node's filter already makes. */
  filter?: FilterGroup
  sort?: SortRule[]
  limit?: number
  parent?: DataSourceParent
}

export type ArgumentType = 'date' | 'number' | 'text' | 'boolean' | 'reference'

export interface ReportArgument {
  key: string
  label: string
  type: ArgumentType
  /** Required when and only when type is 'reference'. */
  form_id?: string
  /** Makes the value a {from,to} pair compiled into a gte/lte pair. Only
   *  meaningful for date and number. */
  range?: boolean
  required?: boolean
  default?: unknown
}

/** The operator lives here rather than on the argument, so one argument can
 *  be `gte` against one source and `eq` against another. */
export interface ArgumentBinding {
  argument_key: string
  source_id: string
  /** A form field's key, or {@link RECORD_ID_FIELD} to narrow the source to
   *  specific records by identity. */
  field: string
  op: CompareOp
}

/** The binding field that narrows a source to specific records rather than
 *  filtering on a column (FR-J1-005 BIND-07). "id" is a reserved field name no
 *  form may define, so it can never collide with a real field key — which is
 *  exactly why the backend can treat it as this sentinel. Only `eq` (one
 *  record) and `in` (several) are legal operators with it. */
export const RECORD_ID_FIELD = 'id'

/** Whether a binding narrows by record identity — the shape behind
 *  export_report's "Use the current record" mode. */
export function isRecordIDBinding(binding: ArgumentBinding): boolean {
  return binding.field === RECORD_ID_FIELD
}

/** A range argument's value. Either bound may be absent — a half-open range
 *  is a legitimate query, not partial input. */
export interface RangeValue {
  from?: unknown
  to?: unknown
}

export interface ReportDefinition {
  version: number
  name: string
  blocks: ReportBlock[]
  workbook?: ReportWorkbook
  data_sources?: ReportDataSource[]
  arguments?: ReportArgument[]
  argument_bindings?: ArgumentBinding[]
  settings: ReportSettings
  visibility: ReportVisibility
}

export function emptyReportDefinition(name = ''): ReportDefinition {
  return {
    version: 1,
    name,
    blocks: [],
    settings: {},
    visibility: { mode: 'public' },
  }
}

// Mirrors api/reports/handler.go's definitionResponse.
export interface ReportDefinitionRow {
  id: string
  name: string
  definition: ReportDefinition
  created_at: string
  updated_at: string
}

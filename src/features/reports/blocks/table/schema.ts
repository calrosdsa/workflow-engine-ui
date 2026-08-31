import type { BlockStyle } from '../../types'

// Mirrors internal/reports.TableBlockConfig (Go, block_table.go) exactly —
// snake_case field names matching the wire schema (FR-J1-002 §1).
export interface ColumnConfig {
  key: string
  label?: string
  expression?: string
}

export interface TableStyles {
  header?: BlockStyle
  body?: BlockStyle
}

export interface TableBlockConfig {
  /** A named report data source (FR-J1-005). When set it supplies the form,
   *  filter, sort, and limit, and `form_id` below is ignored. */
  source_id?: string
  /** The form this block reads directly — the pre-data-source way, kept so a
   *  report authored before FR-J1-005 still resolves (DS-07). */
  form_id: string
  columns?: ColumnConfig[]
  limit?: number
  style?: TableStyles
}

export function emptyTableBlockConfig(): TableBlockConfig {
  return { form_id: '', columns: [] }
}

/** Defensive parse — never throws, heals a malformed/stale blob, mirroring
 *  every other block/widget/custom-action type's identical contract. */
export function parseTableBlockConfig(raw: unknown): TableBlockConfig {
  const empty = emptyTableBlockConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  return {
    source_id: typeof r.source_id === 'string' && r.source_id ? r.source_id : undefined,
    form_id: typeof r.form_id === 'string' ? r.form_id : empty.form_id,
    columns: Array.isArray(r.columns) ? (r.columns as ColumnConfig[]) : empty.columns,
    limit: typeof r.limit === 'number' ? r.limit : undefined,
    style: parseTableStyles(r.style),
  }
}

function parseTableStyles(raw: unknown): TableStyles | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const header = parseBlockStyle(r.header)
  const body = parseBlockStyle(r.body)
  return header || body ? { header, body } : undefined
}

function parseBlockStyle(raw: unknown): BlockStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const style: BlockStyle = {}

  if (typeof r.bold === 'boolean') style.bold = r.bold
  if (typeof r.italic === 'boolean') style.italic = r.italic
  if (r.align === 'left' || r.align === 'center' || r.align === 'right') style.align = r.align
  if (typeof r.text_color === 'string') style.text_color = r.text_color
  if (typeof r.fill_color === 'string') style.fill_color = r.fill_color

  if (r.border && typeof r.border === 'object') {
    const border = r.border as Record<string, unknown>
    const width = typeof border.width === 'number' ? border.width : undefined
    const color = typeof border.color === 'string' ? border.color : undefined
    if (width !== undefined || color !== undefined) style.border = { width, color }
  }

  if (r.padding && typeof r.padding === 'object') {
    const padding = r.padding as Record<string, unknown>
    const top = typeof padding.top === 'number' ? padding.top : undefined
    const right = typeof padding.right === 'number' ? padding.right : undefined
    const bottom = typeof padding.bottom === 'number' ? padding.bottom : undefined
    const left = typeof padding.left === 'number' ? padding.left : undefined
    if (top !== undefined || right !== undefined || bottom !== undefined || left !== undefined) {
      style.padding = { top, right, bottom, left }
    }
  }

  return hasBlockStyle(style) ? style : undefined
}

function hasBlockStyle(style: BlockStyle): boolean {
  return style.bold !== undefined
    || style.italic !== undefined
    || style.align !== undefined
    || style.text_color !== undefined
    || style.fill_color !== undefined
    || style.border !== undefined
    || style.padding !== undefined
}

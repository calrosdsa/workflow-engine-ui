import { nanoid } from 'nanoid'
import type { ReportBlock, BlockLayout } from './types'
import { getReportBlock } from './report-block-registry'

// Mirror of features/dashboard/factory.ts's createWidget/duplicateWidget —
// same structuredClone-based duplication with a fresh nanoid id, same
// bottom-append placement for newly-added blocks. col is always 0; widths
// beyond one row are left to the user to reposition, keeping this placement
// logic trivial and predictable (same tradeoff dashboard's factory documents).
function nextPlacement(existing: ReportBlock[], colSpan: number, rowSpan: number): BlockLayout {
  const maxRow = existing.reduce((max, b) => Math.max(max, b.layout.row + b.layout.row_span), 0)
  return { row: maxRow, col: 0, row_span: rowSpan, col_span: colSpan }
}

/** Creates a new ReportBlock of `type`, placed after any existing blocks.
 *  Throws if `type` isn't registered — callers (the toolbox) only ever offer
 *  registered types, so this indicates a bug rather than user input to
 *  recover from. */
export function createReportBlock(type: string, existing: ReportBlock[]): ReportBlock {
  const def = getReportBlock(type)
  if (!def) throw new Error(`cannot create report block: type "${type}" is not registered`)
  const { col_span, row_span } = def.defaultLayout
  return {
    id: nanoid(),
    type,
    layout: nextPlacement(existing, col_span, row_span),
    config: def.createDefaultConfig(),
  }
}

/** Deep-clones a block with a fresh id, offset one row down so it doesn't
 *  land exactly on top of the original. */
export function duplicateReportBlock(instance: ReportBlock): ReportBlock {
  return {
    ...structuredClone(instance),
    id: nanoid(),
    layout: { ...structuredClone(instance.layout), row: instance.layout.row + instance.layout.row_span },
  }
}

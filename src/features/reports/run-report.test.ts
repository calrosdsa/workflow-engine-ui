import { describe, expect, it } from 'vitest'
import { hasRenderableContent } from './run-report'
import { emptyReportDefinition } from './types'
import type { ReportDefinition } from './types'

function definition(overrides: Partial<ReportDefinition> = {}): ReportDefinition {
  return { ...emptyReportDefinition('Test report'), ...overrides }
}

describe('hasRenderableContent', () => {
  it('is false for a definition with no blocks and no workbook', () => {
    expect(hasRenderableContent(definition())).toBe(false)
  })

  it('is true when at least one block exists', () => {
    const def = definition({ blocks: [{ id: 'b1', type: 'text', layout: { row: 0, col: 0, row_span: 1, col_span: 1 }, config: {} }] })
    expect(hasRenderableContent(def)).toBe(true)
  })

  it('is true for a workbook-only report with a real static cell value', () => {
    // The exact shape that was incorrectly rejected as "empty": zero
    // blocks, a hand-authored workbook grid with real content.
    const def = definition({
      version: 2,
      workbook: { sheets: [{ id: 's1', name: 'Sheet', row_count: 1, column_count: 1, cells: [{ row: 0, col: 0, value: 'Invoice #1' }] }] },
    })
    expect(hasRenderableContent(def)).toBe(true)
  })

  it('is true for a workbook-only report whose only content is a formula', () => {
    const def = definition({
      version: 2,
      workbook: { sheets: [{ id: 's1', name: 'Sheet', row_count: 1, column_count: 1, cells: [{ row: 0, col: 0, formula: '=COUNTA(A1:A5)' }] }] },
    })
    expect(hasRenderableContent(def)).toBe(true)
  })

  it('treats a literal 0 or false cell value as real content, not blank', () => {
    const def = definition({
      version: 2,
      workbook: { sheets: [{ id: 's1', name: 'Sheet', row_count: 1, column_count: 2, cells: [{ row: 0, col: 0, value: 0 }, { row: 0, col: 1, value: false }] }] },
    })
    expect(hasRenderableContent(def)).toBe(true)
  })

  it('is false for a workbook whose cells are all blank (no value, no formula)', () => {
    const def = definition({
      version: 2,
      workbook: { sheets: [{ id: 's1', name: 'Sheet', row_count: 1, column_count: 1, cells: [{ row: 0, col: 0 }] }] },
    })
    expect(hasRenderableContent(def)).toBe(false)
  })

  it('is false for a workbook with sheets but no cells at all', () => {
    const def = definition({
      version: 2,
      workbook: { sheets: [{ id: 's1', name: 'Sheet', row_count: 5, column_count: 5 }] },
    })
    expect(hasRenderableContent(def)).toBe(false)
  })
})

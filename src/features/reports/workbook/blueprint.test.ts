import { describe, expect, it } from 'vitest'
import type { FormDefinition } from '@/features/forms/types'
import { createReportWorkbookBlueprint } from './blueprint'
import type { ReportDefinition } from '../types'

const dealsForm = {
  id: 'deals',
  name: 'Deals',
  fields: [
    { name: 'name', label: 'Name', type: 'text' },
    { name: 'stage', label: 'Stage', type: 'text' },
  ],
} as unknown as FormDefinition

function definitionWith(blocks: ReportDefinition['blocks']): ReportDefinition {
  return { version: 1, name: 'Monthly pipeline', settings: {}, visibility: { mode: 'public' }, blocks }
}

describe('createReportWorkbookBlueprint', () => {
  it('keeps the report name and a comfortable minimum grid', () => {
    const blueprint = createReportWorkbookBlueprint(definitionWith([]))

    expect(blueprint.name).toBe('Monthly pipeline')
    expect(blueprint.rowCount).toBeGreaterThanOrEqual(36)
    expect(blueprint.columnCount).toBeGreaterThanOrEqual(12)
  })

  it('grows the grid so a drawn table fits past its authored span', () => {
    // The span says one row, but a drawn table needs its header row plus
    // placeholder body rows — the grid has to reach all of them.
    const blueprint = createReportWorkbookBlueprint(
      definitionWith([{
        id: 'table',
        type: 'table',
        layout: { row: 40, col: 0, row_span: 1, col_span: 2 },
        config: { form_id: 'deals', columns: [{ key: 'name' }, { key: 'stage' }] },
      }]),
      new Map([['deals', dealsForm]]),
    )

    // Header at row 40 plus three placeholder rows reaches row 43.
    expect(blueprint.rowCount).toBeGreaterThan(43)
  })

  it('falls back to a default name for an untitled report', () => {
    const definition = { ...definitionWith([]), name: '' }
    expect(createReportWorkbookBlueprint(definition).name).toBe('Untitled report')
  })
})

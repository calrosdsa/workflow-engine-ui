import { describe, expect, it } from 'vitest'
import {
  cellAddress,
  createBinding,
  effectiveSources,
  findBlockReferences,
  findFormulaReferences,
  normalizeFilterGroup,
  operatorsFor,
  pruneIncompleteFilters,
  suggestSourceName,
  supportsRange,
  validateSourceName,
} from './data-sources'
import { emptyReportDefinition } from './types'
import type { ReportArgument, ReportDataSource, ReportDefinition } from './types'

const sources: ReportDataSource[] = [
  { id: 'src_a', name: 'Charges', form_id: 'form-charges' },
  { id: 'src_b', name: 'Invoices', form_id: 'form-invoices' },
]

describe('validateSourceName', () => {
  it('accepts a legal identifier', () => {
    expect(validateSourceName('LineCharges', sources)).toBeUndefined()
  })

  it('explains WHY a name with a space is refused', () => {
    const problem = validateSourceName('Line Charges', sources)
    // The author's real question is why, so the message has to name the
    // consequence — being unwritable in a formula — not just say "invalid".
    expect(problem?.message).toContain('Line Charges[Column]')
  })

  it('rejects a leading digit', () => {
    expect(validateSourceName('2Charges', sources)?.message).toContain('must start with a letter')
  })

  it('rejects a case-insensitive duplicate, since references are case-insensitive', () => {
    expect(validateSourceName('charges', sources)?.message).toContain('already called')
  })

  it('lets a source keep its own name while editing', () => {
    expect(validateSourceName('Charges', sources, 'src_a')).toBeUndefined()
  })

  it('rejects an empty name', () => {
    expect(validateSourceName('   ', sources)?.message).toContain('needs a name')
  })
})

describe('suggestSourceName', () => {
  it('strips characters that would make the name unreferenceable', () => {
    expect(suggestSourceName('Line Charges', [])).toBe('LineCharges')
  })

  it('avoids colliding with an existing name', () => {
    expect(suggestSourceName('Charges', sources)).toBe('Charges2')
  })

  it('prefixes a name that would start with a digit', () => {
    expect(suggestSourceName('2026 Invoices', [])).toBe('S2026Invoices')
  })

  it('falls back when a form name has nothing usable', () => {
    expect(suggestSourceName('—', [])).toBe('Source')
  })
})

describe('operatorsFor', () => {
  it('offers only inclusion operators for an id binding', () => {
    // `id = ANY(...)` cannot express exclusion; the backend rejects anything
    // else, so offering it would let an author save a config that only fails
    // at run time.
    expect(operatorsFor('id')).toEqual(['eq', 'in'])
  })

  it('never offers `between`, which does not exist in this codebase', () => {
    expect(operatorsFor('amount')).not.toContain('between')
  })
})

describe('supportsRange', () => {
  it('is offered for ordered types only', () => {
    expect(supportsRange('date')).toBe(true)
    expect(supportsRange('number')).toBe(true)
    expect(supportsRange('text')).toBe(false)
    expect(supportsRange('reference')).toBe(false)
  })
})

describe('createBinding', () => {
  it('starts a reference argument on the record-id narrowing', () => {
    const argument: ReportArgument = { key: 'invoice', label: 'Invoice', type: 'reference', form_id: 'form-invoices' }
    expect(createBinding(argument, sources)).toMatchObject({ field: 'id', op: 'eq', source_id: 'src_a' })
  })

  it('leaves a non-reference argument unbound so the author picks a real field', () => {
    const argument: ReportArgument = { key: 'q', label: 'Search', type: 'text' }
    expect(createBinding(argument, sources)).toMatchObject({ field: '', op: 'contains' })
  })

  it('returns nothing when there is no source to bind to', () => {
    expect(createBinding({ key: 'q', label: 'Q', type: 'text' }, [])).toBeUndefined()
  })
})

describe('cellAddress', () => {
  it('maps zero-based coordinates to A1 notation', () => {
    expect(cellAddress(0, 0)).toBe('A1')
    expect(cellAddress(4, 2)).toBe('C5')
    expect(cellAddress(0, 25)).toBe('Z1')
    expect(cellAddress(0, 26)).toBe('AA1')
  })
})

function definitionWithFormulas(formulas: string[]): ReportDefinition {
  return {
    ...emptyReportDefinition('R'),
    workbook: {
      sheets: [{
        id: 'report-layout',
        name: 'Report layout',
        row_count: 20,
        column_count: 10,
        cells: formulas.map((formula, i) => ({ row: i, col: 0, formula })),
      }],
    },
  }
}

describe('findFormulaReferences', () => {
  it('finds a structured reference and names the cell', () => {
    const def = definitionWithFormulas(['=SUM(Charges[Amount])'])
    const [hit] = findFormulaReferences(def, 'Charges')
    expect(hit).toMatchObject({ address: 'A1', sheetName: 'Report layout' })
  })

  it('matches case-insensitively, like the resolver does', () => {
    expect(findFormulaReferences(definitionWithFormulas(['=SUM(charges[Amount])']), 'Charges')).toHaveLength(1)
  })

  it('does not match a longer name that merely starts the same', () => {
    // "ChargesTax[...]" is a different source; a substring match would report
    // a break that renaming "Charges" would not actually cause.
    expect(findFormulaReferences(definitionWithFormulas(['=SUM(ChargesTax[Amount])']), 'Charges')).toHaveLength(0)
  })

  it('ignores the name where it is not a structured reference', () => {
    expect(findFormulaReferences(definitionWithFormulas(['="Charges total"']), 'Charges')).toHaveLength(0)
  })

  it('returns nothing for an unnamed source rather than matching everything', () => {
    expect(findFormulaReferences(definitionWithFormulas(['=SUM(Charges[Amount])']), '')).toHaveLength(0)
  })
})

describe('findBlockReferences', () => {
  it('lists blocks pointing at a source by id', () => {
    const def: ReportDefinition = {
      ...emptyReportDefinition('R'),
      blocks: [
        { id: 'b1', name: 'Charges', type: 'table', sheet_id: 's', layout: { row: 0, col: 0, row_span: 1, col_span: 1 }, config: { source_id: 'src_a' } },
        { id: 'b2', type: 'table', sheet_id: 's', layout: { row: 5, col: 0, row_span: 1, col_span: 1 }, config: { source_id: 'src_b' } },
      ],
    }
    expect(findBlockReferences(def, 'src_a')).toEqual(['Charges'])
    expect(findBlockReferences(def, 'src_b')).toEqual(['b2'])
  })
})

describe('effectiveSources', () => {
  const names = (id: string) => ({ 'form-legacy': 'Legacy Form' }[id])

  it('surfaces a legacy block\'s form as an implicit source', () => {
    // Otherwise the panel shows an empty data-source list beside a populated
    // region, which reads as "this report has no data".
    const def: ReportDefinition = {
      ...emptyReportDefinition('R'),
      blocks: [{ id: 'b1', type: 'table', sheet_id: 's', layout: { row: 0, col: 0, row_span: 1, col_span: 1 }, config: { form_id: 'form-legacy' } }],
    }
    const result = effectiveSources(def, names)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ form_id: 'form-legacy', implicit: true, name: 'Legacy Form' })
  })

  it('does not duplicate a form that is already a declared source', () => {
    const def: ReportDefinition = {
      ...emptyReportDefinition('R'),
      data_sources: [{ id: 'src_a', name: 'Charges', form_id: 'form-legacy' }],
      blocks: [{ id: 'b1', type: 'table', sheet_id: 's', layout: { row: 0, col: 0, row_span: 1, col_span: 1 }, config: { form_id: 'form-legacy' } }],
    }
    expect(effectiveSources(def, names)).toHaveLength(1)
  })

  it('ignores a block that already references a source', () => {
    const def: ReportDefinition = {
      ...emptyReportDefinition('R'),
      data_sources: [{ id: 'src_a', name: 'Charges', form_id: 'form-charges' }],
      blocks: [{ id: 'b1', type: 'table', sheet_id: 's', layout: { row: 0, col: 0, row_span: 1, col_span: 1 }, config: { source_id: 'src_a', form_id: 'form-legacy' } }],
    }
    expect(effectiveSources(def, names).filter((s) => s.implicit)).toHaveLength(0)
  })
})

describe('pruneIncompleteFilters', () => {
  const withFilter = (filter: unknown): ReportDefinition => ({
    ...emptyReportDefinition('R'),
    data_sources: [{ id: 'src_a', name: 'Charges', form_id: 'f', filter: filter as never }],
  })
  const filterOf = (d: ReportDefinition) => d.data_sources?.[0].filter

  it('drops a condition whose field is not set yet', () => {
    // The state between clicking "+ Condition" and picking a field. The
    // backend rejects the whole definition for it, so an author would be
    // unable to save mid-edit.
    const pruned = pruneIncompleteFilters(withFilter({
      id: 'g1', combinator: 'and', groups: [],
      conditions: [
        { id: 'c1', field: '', op: 'eq', value_mode: 'static', value: '' },
        { id: 'c2', field: 'status', op: 'eq', value_mode: 'static', value: 'active' },
      ],
    }))
    expect(filterOf(pruned)?.conditions).toHaveLength(1)
    expect(filterOf(pruned)?.conditions[0].field).toBe('status')
  })

  it('drops a group left entirely empty rather than sending editor leftovers', () => {
    const pruned = pruneIncompleteFilters(withFilter({
      id: 'g1', combinator: 'and', conditions: [], groups: [],
    }))
    expect(filterOf(pruned)).toBeUndefined()
  })

  it('prunes nested groups too', () => {
    const pruned = pruneIncompleteFilters(withFilter({
      id: 'g1', combinator: 'and', conditions: [],
      groups: [
        { id: 'g2', combinator: 'or', conditions: [{ id: 'c1', field: '', op: 'eq', value_mode: 'static', value: '' }], groups: [] },
        { id: 'g3', combinator: 'or', conditions: [{ id: 'c2', field: 'city', op: 'eq', value_mode: 'static', value: 'X' }], groups: [] },
      ],
    }))
    expect(filterOf(pruned)?.groups).toHaveLength(1)
    expect(filterOf(pruned)?.groups[0].id).toBe('g3')
  })

  it('leaves a fully completed filter untouched', () => {
    const filter = {
      id: 'g1', combinator: 'and', groups: [],
      conditions: [{ id: 'c1', field: 'status', op: 'eq', value_mode: 'static', value: 'active' }],
    }
    expect(filterOf(pruneIncompleteFilters(withFilter(filter)))).toMatchObject(filter)
  })

  it('is a no-op for a report with no data sources', () => {
    const def = emptyReportDefinition('R')
    expect(pruneIncompleteFilters(def)).toBe(def)
  })
})

describe('normalizeFilterGroup', () => {
  it('restores the arrays Go omits on the way back', () => {
    // graph.FilterGroup's slices carry omitempty, so a saved-then-reloaded
    // filter has no `groups` key at all. FilterBuilder maps over it unguarded.
    const fromServer = { combinator: 'and', conditions: [{ field: 'status', op: 'eq', value: 'x' }] } as never
    const normalized = normalizeFilterGroup(fromServer)
    expect(Array.isArray(normalized.groups)).toBe(true)
    expect(normalized.groups).toHaveLength(0)
  })

  it('gives every group and condition the id the editor keys on', () => {
    const normalized = normalizeFilterGroup({ combinator: 'and', conditions: [{ field: 'a', op: 'eq', value: '' }] } as never)
    expect(normalized.id).toBeTruthy()
    expect(normalized.conditions[0].id).toBeTruthy()
  })

  it('builds a usable empty group from nothing', () => {
    const normalized = normalizeFilterGroup(undefined)
    expect(normalized).toMatchObject({ combinator: 'and', conditions: [], groups: [] })
  })

  it('normalizes nested groups recursively', () => {
    const normalized = normalizeFilterGroup({
      combinator: 'and', conditions: [],
      groups: [{ combinator: 'or', conditions: [{ field: 'a', op: 'eq', value: '' }] }],
    } as never)
    expect(Array.isArray(normalized.groups[0].groups)).toBe(true)
    expect(normalized.groups[0].id).toBeTruthy()
  })

  it('preserves ids that are already present', () => {
    const normalized = normalizeFilterGroup({ id: 'keep', combinator: 'or', conditions: [], groups: [] } as never)
    expect(normalized.id).toBe('keep')
  })
})

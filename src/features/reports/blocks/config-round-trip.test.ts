import { describe, expect, it } from 'vitest'
import { parseTableBlockConfig } from './table/schema'
import { parseGroupBlockConfig } from './group/schema'
import { parseRelatedBlockConfig } from './related/schema'

// THE BUG THESE PIN.
//
// WorkbookRegionsPanel does:
//     config={selectedDefinition.parseConfig(selectedBlock.config)}
//     onChange={(config) => updateBlockConfig(selectedBlock.id, config)}
//
// so a parse result is not merely displayed — it is fed to the ConfigPanel,
// whose every control spreads it and writes it straight back, and
// updateBlockConfig REPLACES block.config wholesale. Any field the parser
// forgot to mention was therefore destroyed the moment a user touched any
// control on that block, including a control for something unrelated.
//
// The lost fields had no editor control at all — filter, totals, source_id,
// sort_by, sort_dir are authored through MCP or the API — which is precisely
// why nothing ever put them back. `totals` had shipped one day before this
// was found.
//
// These assert NAMED fields rather than "an unknown key survives" on
// purpose: the parsers must NOT round-trip unknown keys. ValidateBlockConfigs
// decodes with DisallowUnknownFields and runs on create, update AND preview,
// so a stale key that survived parsing would stop being silently healed away
// and start hard-failing the save.

const FILTER = { op: 'and', conditions: [{ field: 'status', op: 'eq', value: 'open' }] }

describe('table block config survives an editor round trip', () => {
  const raw = {
    source_id: 'src-1',
    form_id: 'f1',
    columns: [{ key: 'amount' }],
    limit: 10,
    filter: FILTER,
    totals: [
      { column: 'name', label: 'Total' },
      { column: 'amount', fn: 'sum' },
    ],
  }

  it('keeps the filter', () => {
    expect(parseTableBlockConfig(raw).filter).toEqual(FILTER)
  })

  it('keeps the totals row', () => {
    const totals = parseTableBlockConfig(raw).totals
    expect(totals).toHaveLength(2)
    expect(totals?.[1]).toEqual({ column: 'amount', fn: 'sum' })
  })

  // The exact gesture that destroyed them: read the config, change one
  // unrelated control, write it back.
  it('survives a panel edit of an unrelated control', () => {
    const parsed = parseTableBlockConfig(raw)
    const afterEdit = { ...parsed, limit: 25 }
    expect(afterEdit.filter).toEqual(FILTER)
    expect(afterEdit.totals).toHaveLength(2)
  })

  // The healing contract must survive: a junk key must NOT round-trip, or
  // ValidateBlockConfigs' DisallowUnknownFields turns a silent heal into a
  // hard 400 on save.
  it('still drops an unknown key rather than round-tripping it', () => {
    const parsed = parseTableBlockConfig({ ...raw, bogus_legacy_key: 'x' })
    expect('bogus_legacy_key' in parsed).toBe(false)
  })
})

describe('group block config survives an editor round trip', () => {
  const raw = {
    source_id: 'src-1',
    form_id: '',
    series: [{ fn: 'sum', field: 'amount' }],
    filter: FILTER,
    sort_by: 'amount',
    sort_dir: 'desc',
  }

  // The worst of the losses: Go treats source_id as winning over form_id, so
  // a group block created by the sheet's "Insert data" gesture — which sets
  // source_id and never sets form_id — fell back to an empty form_id on the
  // first panel touch and then could not generate at all.
  it('keeps source_id, without which the block cannot resolve its data', () => {
    expect(parseGroupBlockConfig(raw).source_id).toBe('src-1')
  })

  it('keeps filter and sort', () => {
    const parsed = parseGroupBlockConfig(raw)
    expect(parsed.filter).toEqual(FILTER)
    expect(parsed.sort_by).toBe('amount')
    expect(parsed.sort_dir).toBe('desc')
  })

  it('survives a panel edit of an unrelated control', () => {
    const afterEdit = { ...parseGroupBlockConfig(raw), limit: 5 }
    expect(afterEdit.source_id).toBe('src-1')
    expect(afterEdit.filter).toEqual(FILTER)
  })
})

describe('related block config survives an editor round trip', () => {
  it('keeps the filter', () => {
    const parsed = parseRelatedBlockConfig({
      parent_form_id: 'p', child_form_id: 'c', filter: FILTER,
    })
    expect(parsed.filter).toEqual(FILTER)
  })
})

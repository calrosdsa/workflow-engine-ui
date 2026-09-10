import { describe, it, expect } from 'vitest'
import { groupByCategory, categoryLabel, type PaletteEntry, type CategoryInfo } from './node-taxonomy'
import { PALETTE_NODES, NODE_REGISTRY } from './node-registry'

const cats: CategoryInfo[] = [
  { id: 'data', label: 'Data', description: '', order: 20 },
  { id: 'logic', label: 'Logic', description: '', order: 30 },
  { id: 'integration', label: 'Integration', description: '', order: 40 },
  { id: 'utility', label: 'Utility', description: '', order: 80 },
]

const entry = (type: string, category: string, kind: PaletteEntry['kind'] = 'core'): PaletteEntry => ({
  type, category, kind, label: type, description: '',
})

describe('groupByCategory', () => {
  it('orders groups by the served order, not by encounter', () => {
    // The whole point of serving `order`: the frontend must not decide it.
    const groups = groupByCategory(
      [entry('a', 'integration'), entry('b', 'data'), entry('c', 'logic')],
      cats,
    )
    expect(groups.map((g) => g.id)).toEqual(['data', 'logic', 'integration'])
  })

  it('drops categories with no members', () => {
    // 'utility' is in the vocabulary ahead of the package nodes that will
    // fill it. Rendering a tab per vocabulary entry rather than per occupied
    // category would show an empty tab today.
    const groups = groupByCategory([entry('a', 'data')], cats)
    expect(groups.map((g) => g.id)).toEqual(['data'])
  })

  it('keeps core nodes ahead of package nodes in the same group', () => {
    // This is the property the old separate-Connectors-tab layout was
    // protecting: grouping by function must not let a package node displace
    // a built-in from where an author is used to finding it.
    const groups = groupByCategory(
      [
        entry('slack_post', 'integration', 'package'),
        entry('http_request', 'integration', 'core'),
        entry('stripe_charge', 'integration', 'package'),
      ],
      cats,
    )
    expect(groups[0].entries.map((e) => e.type)).toEqual(['http_request', 'slack_post', 'stripe_charge'])
  })

  it('preserves authored order within the same kind', () => {
    // The palette list is ordered by rough authoring frequency, deliberately
    // not alphabetically — sorting must not destroy that.
    const groups = groupByCategory(
      [entry('z_first', 'data'), entry('a_second', 'data')],
      cats,
    )
    expect(groups[0].entries.map((e) => e.type)).toEqual(['z_first', 'a_second'])
  })

  it('still renders a category the server sent that this build has no label for', () => {
    // The forward-compatibility property. A backend that adds a category and
    // puts a node in it must not have that node vanish from a palette built
    // before the category existed — which is exactly what a hardcoded
    // TypeScript union of category ids used to guarantee.
    const groups = groupByCategory([entry('novel', 'quantum')], cats)
    expect(groups).toHaveLength(1)
    expect(groups[0].entries.map((e) => e.type)).toEqual(['novel'])
    // Falls back to showing the raw id: odd-looking, but present and
    // selectable, which beats silently swallowing it.
    expect(groups[0].label).toBe('quantum')
  })

  it('sorts an unknown category after every known one', () => {
    const groups = groupByCategory(
      [entry('novel', 'quantum'), entry('known', 'data')],
      cats,
    )
    expect(groups.map((g) => g.id)).toEqual(['data', 'quantum'])
  })
})

describe('categoryLabel', () => {
  it('prefers the served label over the compiled-in fallback', () => {
    // Renaming a category server-side must take effect without a release.
    expect(categoryLabel('data', [{ id: 'data', label: 'Records', description: '', order: 20 }])).toBe('Records')
  })

  it('falls back to the compiled-in label when the server has not answered', () => {
    expect(categoryLabel('integration', [])).toBe('Integration')
  })
})

describe('the compiled-in fallback categories', () => {
  it('uses the shared vocabulary, not the frontend-only names it replaced', () => {
    // The old union was 'Data' | 'Logic' | 'Integrations' | 'Notify' |
    // 'Knowledge' | 'Debug' | 'Agent' — capitalised, plural, and carrying two
    // ids ('Knowledge', 'Agent') plus 'Debug' that the backend had never had.
    // Pinned by name because a silent revert here would put every built-in
    // into its own unknown-category group and still render, just wrongly.
    const retired = ['Data', 'Logic', 'Integrations', 'Notify', 'Knowledge', 'Debug', 'Agent', 'io']
    for (const type of PALETTE_NODES) {
      const category = NODE_REGISTRY[type].category
      expect(category, `${type} has no fallback category`).toBeTruthy()
      expect(retired, `${type} still uses retired category "${category}"`).not.toContain(category)
    }
  })

  it('files generate_report under output', () => {
    // It said 'Knowledge' here while the backend had always classified it
    // 'output' — a live drift found by lining the two vocabularies up.
    expect(NODE_REGISTRY.generate_report.category).toBe('output')
  })
})

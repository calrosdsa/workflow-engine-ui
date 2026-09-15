import { describe, it, expect } from 'vitest'
import {
  groupByCategory, groupByPaletteCategory, groupBySource, categoryLabel, findTriggerPreset, groupNodesByApp, groupTriggerPresetsByApp, searchApps,
  type PaletteEntry, type CategoryInfo, type NodeTaxonomy, type TriggerPresetInfo, type NodeTaxonomyEntry, type AppInfo,
} from './node-taxonomy'
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

describe('groupByPaletteCategory', () => {
  it('merges Flow and Core presentation buckets while keeping the backend ids intact', () => {
    const groups = groupByPaletteCategory([
      entry('iterator', 'structure'),
      entry('condition', 'logic'),
      entry('http_request', 'integration'),
      entry('notification', 'notify'),
      entry('format_reference', 'utility', 'package'),
      entry('knowledge', 'ai'),
    ], [
      ...cats,
      { id: 'structure', label: 'Structure', description: '', order: 10 },
      { id: 'notify', label: 'Notify', description: '', order: 60 },
      { id: 'ai', label: 'AI', description: '', order: 50 },
    ])

    expect(groups.map((group) => group.id)).toEqual(['ai', 'flow', 'core'])
    expect(groups.find((group) => group.id === 'flow')?.entries.map((item) => item.type)).toEqual(['iterator', 'condition'])
    expect(groups.find((group) => group.id === 'core')?.entries.map((item) => item.type)).toEqual([
      'http_request', 'notification',
    ])
    expect(groups.flatMap((group) => group.entries).map((item) => item.type)).not.toContain('format_reference')
  })

  it('keeps an unknown server category visible as its own fallback group', () => {
    const groups = groupByPaletteCategory([entry('novel', 'quantum')], cats)

    expect(groups).toEqual([
      expect.objectContaining({ id: 'quantum', label: 'quantum' }),
    ])
  })
})

describe('groupBySource', () => {
  it('keeps built-ins first and groups package actions by app', () => {
    const groups = groupBySource([
      { ...entry('whatsapp_send', 'integration', 'package'), appName: 'whatsapp', appLabel: 'WhatsApp' },
      entry('http_request', 'integration'),
      { ...entry('slack_post', 'integration', 'package'), appName: 'slack', appLabel: 'Slack' },
    ])

    expect(groups.map((group) => group.label)).toEqual(['Built-in', 'WhatsApp', 'Slack'])
    expect(groups.map((group) => group.entries.map((item) => item.type))).toEqual([
      ['http_request'],
      ['whatsapp_send'],
      ['slack_post'],
    ])
  })

  it('gives package entries without app metadata a visible fallback group', () => {
    const groups = groupBySource([entry('unknown_package', 'integration', 'package')])

    expect(groups).toEqual([
      expect.objectContaining({ label: 'Other apps', kind: 'app' }),
    ])
  })
})

describe('findTriggerPreset', () => {
  const preset: TriggerPresetInfo = {
    name: 'whatsapp_on_message',
    display_name: 'WhatsApp — On Message',
    description: 'Fires when a message arrives.',
    icon_hint: 'message-square',
    provider: 'meta',
    default_events: ['messages'],
  }
  const taxonomy: NodeTaxonomy = { categories: [], kinds: [], nodes: [], trigger_presets: [preset], apps: [] }

  it('finds the preset matching a trigger\'s saved webhook_preset', () => {
    // This is what makes a WhatsApp trigger render its own icon/label on the
    // canvas instead of the generic webhook trigger's — BaseNode.tsx feeds
    // this straight into iconForHint/headerLabel.
    expect(findTriggerPreset(taxonomy, 'whatsapp_on_message')).toEqual(preset)
  })

  it('returns undefined for an unset webhook_preset', () => {
    // The common case: a plain webhook trigger, or any non-webhook mode —
    // must fall back to the built-in trigger icon/label, not crash on a
    // missing field.
    expect(findTriggerPreset(taxonomy, undefined)).toBeUndefined()
    expect(findTriggerPreset(taxonomy, '')).toBeUndefined()
  })

  it('returns undefined for a preset name this build has never heard of', () => {
    // A preset removed server-side (or from a package no longer loaded)
    // after a workflow saved it — the trigger must still render, just
    // without the preset's icon/label, not throw.
    expect(findTriggerPreset(taxonomy, 'some_removed_preset')).toBeUndefined()
  })

  it('returns undefined before the taxonomy has loaded', () => {
    expect(findTriggerPreset(undefined, 'whatsapp_on_message')).toBeUndefined()
  })
})

describe('groupNodesByApp', () => {
  const whatsappSend: NodeTaxonomyEntry = { type: 'whatsapp_send', kind: 'package', category: 'integration', package: 'whatsapp' }
  const slackPost: NodeTaxonomyEntry = { type: 'slack_post_message', kind: 'package', category: 'integration', package: 'slack' }
  const coreNode: NodeTaxonomyEntry = { type: 'http_request', kind: 'core', category: 'integration' }
  const packageNoApp: NodeTaxonomyEntry = { type: 'format_reference', kind: 'package', category: 'utility' }

  it('groups package nodes by their declaring app', () => {
    const grouped = groupNodesByApp([whatsappSend, slackPost])
    expect(grouped.get('whatsapp')).toEqual([whatsappSend])
    expect(grouped.get('slack')).toEqual([slackPost])
  })

  it('excludes core nodes — built-ins belong to no app', () => {
    expect(groupNodesByApp([coreNode]).size).toBe(0)
  })

  it('excludes a package node with no package field, rather than crashing', () => {
    // A build old enough to predate this field, or a genuinely appless
    // package node — either way it's simply absent from every group.
    expect(groupNodesByApp([packageNoApp]).size).toBe(0)
  })
})

describe('groupTriggerPresetsByApp', () => {
  const whatsappPreset: TriggerPresetInfo = { name: 'whatsapp_on_message', display_name: 'd', provider: 'meta', package: 'whatsapp' }
  const noPackagePreset: TriggerPresetInfo = { name: 'orphan', display_name: 'd', provider: 'generic' }

  it('groups presets by their declaring app', () => {
    expect(groupTriggerPresetsByApp([whatsappPreset]).get('whatsapp')).toEqual([whatsappPreset])
  })

  it('excludes a preset with no package field', () => {
    expect(groupTriggerPresetsByApp([noPackagePreset]).size).toBe(0)
  })
})

describe('searchApps', () => {
  const apps: AppInfo[] = [
    { name: 'whatsapp', display_name: 'WhatsApp', description: 'Send WhatsApp Business Cloud API messages.', icon_hint: 'message-square' },
    { name: 'slack', display_name: 'Slack', description: 'Post to Slack channels.', icon_hint: 'message-square' },
  ]

  it('returns every app for an empty query', () => {
    expect(searchApps(apps, '')).toEqual(apps)
  })

  it('matches case-insensitively on display_name', () => {
    expect(searchApps(apps, 'whatsapp')).toEqual([apps[0]])
  })

  it('matches on description too', () => {
    expect(searchApps(apps, 'business cloud')).toEqual([apps[0]])
  })

  it('returns an empty list when nothing matches', () => {
    expect(searchApps(apps, 'discord')).toEqual([])
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

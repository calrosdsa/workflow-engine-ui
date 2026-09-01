// The generator AND the freshness guard for ui-catalog.json, in one
// mechanism: vitest file snapshots. `npm test` fails while the committed
// file no longer matches the registries; `npm run gen:ui-catalog` (vitest
// with --update) rewrites it. No separate script runner needed — vitest is
// the one tool here that can execute the registry modules with the app's
// own Vite transforms (aliases, CSS, JSX).
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildUiCatalog, buildUiCatalogJson } from './ui-catalog'

const here = dirname(fileURLToPath(import.meta.url))

// workflow-engine is a SIBLING repo (workflow-engine and workflow-engine-ui
// are independent git repos side by side). When it isn't checked out there
// is nowhere to write or compare, so this skips — the same honest gap the
// backend's own frontend-scanning test declares from its side.
const targetDir = resolve(here, '../../../workflow-engine/api/meta')
const snapshotPath = '../../../workflow-engine/api/meta/ui-catalog.json'

describe('ui-catalog generation', () => {
  it.skipIf(!existsSync(targetDir))(
    'the committed ui-catalog.json matches the live registries',
    async () => {
      await expect(buildUiCatalogJson()).toMatchFileSnapshot(snapshotPath)
    },
  )

  it('every registered type describes itself', () => {
    const catalog = buildUiCatalog()

    expect(catalog.menu_types.length).toBeGreaterThanOrEqual(5)
    expect(catalog.custom_actions.length).toBeGreaterThanOrEqual(3)
    expect(catalog.detail_tabs.length).toBeGreaterThanOrEqual(8)
    expect(catalog.detail_layouts.length).toBeGreaterThanOrEqual(3)

    for (const list of [catalog.menu_types, catalog.custom_actions, catalog.detail_tabs]) {
      for (const entry of list) {
        // The contract makes configSchema required at compile time; this
        // guards the half TypeScript cannot — that the schema is an object
        // schema with real content, since the backend serves it verbatim.
        expect(entry.config_schema.type, `${entry.type} config schema`).toBe('object')
        expect(entry.summary, `${entry.type} summary`).toBeTruthy()
      }
    }
  })
})

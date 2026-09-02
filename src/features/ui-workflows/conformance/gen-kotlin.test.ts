// The generator AND the freshness guard for the Kotlin copy of the corpus, in
// one mechanism — the same vitest file-snapshot shape ui-catalog.gen.test.ts
// uses for the Go backend's ui-catalog.json, and for the same reason: `npm
// test` fails while the committed copy is stale, and `npm run gen:conformance`
// rewrites it.
//
// Embedded as a Kotlin string constant rather than a resource file because
// reading a file from KMP commonTest has no portable API — the same problem
// go:embed solves on the backend, solved the same way.
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import corpus from './corpus.json'

const here = dirname(fileURLToPath(import.meta.url))

// runtime-app is a SIBLING repo. When it isn't checked out there is nowhere
// to write, so this skips — the same honest gap every other cross-repo guard
// here declares from its own side.
const targetDir = resolve(here, '../../../../../runtime-app/shared/domain/src/commonTest/kotlin/com/appbuilder/runtime/domain/model')
const snapshotPath = '../../../../../runtime-app/shared/domain/src/commonTest/kotlin/com/appbuilder/runtime/domain/model/ConformanceCorpus.kt'

function buildKotlin(): string {
  // Emitted into a Kotlin raw string, which can hold the corpus's quotes and
  // newlines verbatim — but NOT a `$`, which would open a template. The corpus
  // simply contains none (its comment key is `_comment`, not `$comment`, for
  // exactly this reason), so no escaping is needed and the value stays a real
  // compile-time `const val`. The test below fails loudly if one ever appears,
  // because the alternative — `${'$'}` — would silently make this non-const.
  const json = JSON.stringify(corpus, null, 2)
  return `package com.appbuilder.runtime.domain.model

// GENERATED FILE - do not edit by hand.
// Source: workflow-engine-ui/src/features/ui-workflows/conformance/corpus.json
// Regenerate with \`npm run gen:conformance\` in workflow-engine-ui;
// \`npm test\` there fails while this copy is stale.
//
// The corpus is the shared specification both UI workflow interpreters run.
// See that directory's README for why it is authored rather than recorded.
internal const val CONFORMANCE_CORPUS_JSON: String = """${json}"""
`
}

describe('UI workflow conformance corpus (Kotlin copy)', () => {
  it.skipIf(!existsSync(targetDir))(
    'the committed Kotlin corpus matches corpus.json',
    async () => {
      await expect(buildKotlin()).toMatchFileSnapshot(snapshotPath)
    },
  )

  it('emits valid Kotlin raw-string content', () => {
    const out = buildKotlin()
    const body = out.slice(out.indexOf('"""') + 3, out.lastIndexOf('"""'))

    // A `$` anywhere in the corpus would open a Kotlin template and break the
    // build in the SIBLING repo rather than here. Caught on this side, where
    // the failure is actionable and the fix is obvious: rename the key.
    expect(body, 'the corpus must contain no "$" — it would open a Kotlin template').not.toContain('$')

    // A raw string also cannot contain """, which would close it early.
    expect(body).not.toContain('"""')

    // And it is still the corpus on the other side of the transfer.
    expect(JSON.parse(body)).toHaveProperty('cases')
  })
})

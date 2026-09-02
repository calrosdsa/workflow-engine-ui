// The web interpreter, run against the shared corpus.
//
// Its Kotlin twin (UiWorkflowConformanceTest.kt) runs the same file through
// the same assertions. A case failing on one side and passing on the other is
// exactly the drift this exists to catch.
import { describe, it, expect } from 'vitest'
import '../nodes'
import corpus from './corpus.json'
import { runCase, type Corpus, type CorpusCase } from './runner'

const { cases } = corpus as unknown as Corpus

describe('UI workflow conformance corpus', () => {
  it('is not empty, and every case is named and explains itself', () => {
    // A corpus that silently stopped loading would make every check below
    // vacuous, and a case with no `why` is one nobody can safely change later.
    expect(cases.length).toBeGreaterThanOrEqual(15)
    for (const c of cases) {
      expect(c.name, 'every case needs a name').toBeTruthy()
      expect(c.expect?.status, `${c.name}: needs an expected status`).toBeTruthy()
    }
  })

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const outcome = await runCase(testCase as CorpusCase)
      const { expect: want } = testCase

      expect(outcome.status, `${testCase.name}: status`).toBe(want.status)

      if (want.failedStepId !== undefined) {
        expect(outcome.failedStepId, `${testCase.name}: failed step`).toBe(want.failedStepId)
      }
      if (want.errorContains !== undefined) {
        expect(outcome.error ?? '', `${testCase.name}: error text`).toContain(want.errorContains)
      }
      if (want.trace !== undefined) {
        expect(outcome.trace, `${testCase.name}: trace`).toEqual(want.trace)
      }
      if (want.calls !== undefined) {
        // Order matters as much as content: the corpus pins what each
        // interpreter DID, not only where it ended up.
        expect(outcome.calls, `${testCase.name}: host calls`).toEqual(want.calls)
      }
      if (want.variables !== undefined) {
        // A SUBSET check, so a case stays about the one decision it names
        // rather than freezing every incidental variable a step happens to
        // set alongside it.
        for (const [key, value] of Object.entries(want.variables)) {
          expect(outcome.variables[key], `${testCase.name}: variable "${key}"`).toEqual(value)
        }
      }
    })
  }
})

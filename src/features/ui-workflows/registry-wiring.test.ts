// The one test in this feature that must NOT import './nodes'.
//
// Every other test here imports the barrel itself, which means they were all
// setting up state the real app never did: nodes/index.ts was reachable only
// from tests and the catalog generator, so in the shipped build the registry
// was EMPTY and every step read as "Unknown step type" in the live builder.
// ~685 passing tests could not see it; opening the app once did.
//
// So this file imports only the feature's two entry points and asserts the
// registry is populated as a consequence. Delete the `import './nodes'` from
// either entry point and this fails while nothing else does.
import { describe, it, expect } from 'vitest'
import { runUiWorkflow } from './interpreter'
import { emptyRunContext } from './host'
import { allUiWorkflowNodes } from './node-registry'

describe('importing an entry point registers the nodes', () => {
  it('populates the registry via the interpreter alone', () => {
    // Not a count — a count would need updating with every new node and would
    // pass just as well with one node registered. The named types are the
    // claim: these specific ones are reachable from a bare interpreter import.
    const types = allUiWorkflowNodes().map((n) => n.type)
    for (const expected of ['show_message', 'condition', 'update_record', 'show_dialog']) {
      expect(types, `${expected} must be registered by importing interpreter.ts`).toContain(expected)
    }
  })

  it('runs a real step rather than skipping it as unknown', async () => {
    // The user-visible symptom, pinned directly: an unregistered node is
    // *skipped* with a trace entry, not failed, so a run still "completes" —
    // which is exactly why the bug was invisible until someone looked at the
    // screen. Asserting on the trace is what makes it detectable.
    const shown: string[] = []
    const result = await runUiWorkflow({
      steps: [{ id: 's', type: 'show_message', config: { message: 'hi', message_type: 'info' } }],
      ctx: emptyRunContext(),
      host: {
        showMessage: (t) => shown.push(t),
        navigate: () => {},
        refresh: () => {},
        searchRecords: async () => ({ records: [], total: 0 }),
        createRecord: async () => ({ id: 'x' }),
        updateRecord: async () => {},
        runServerWorkflow: async () => ({ status: 'COMPLETED' }),
      },
    })
    expect(result.status).toBe('completed')
    expect(result.trace[0].status).toBe('ok')
    expect(shown).toEqual(['hi'])
  })
})

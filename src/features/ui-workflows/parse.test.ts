import { describe, it, expect } from 'vitest'
import './nodes'
import { parseUiWorkflow, parseStep, validateUiWorkflow } from './parse'
import { allUiWorkflowNodes, getUiWorkflowNode, walkSteps, graphPlatforms } from './node-registry'
import { UI_WORKFLOW_VERSION } from './types'
import type { ConditionStepConfig } from './types'

describe('parseUiWorkflow never throws', () => {
  it('heals every kind of junk into a usable workflow', () => {
    // A stored graph is opaque JSON read straight off the wire, and the MCP
    // server accepts nested config without validating this shape — so these
    // are reachable inputs, not hypotheticals.
    for (const junk of [null, undefined, 0, '', 'nope', [], true, { steps: 'no' }, { steps: [1, 2] }]) {
      const wf = parseUiWorkflow(junk)
      expect(Array.isArray(wf.steps)).toBe(true)
      expect(typeof wf.version).toBe('number')
    }
  })

  it('defaults an absent version to the current one', () => {
    expect(parseUiWorkflow({ steps: [] }).version).toBe(UI_WORKFLOW_VERSION)
  })

  it('keeps a version it does not recognise rather than rewriting it', () => {
    // Silently stamping the current version onto a newer graph would hide the
    // fact that this client may not understand it.
    expect(parseUiWorkflow({ version: 99, steps: [] }).version).toBe(99)
  })

  it('drops malformed steps but keeps the good ones', () => {
    const wf = parseUiWorkflow({
      steps: [
        null,
        { type: 'show_message', config: { message: 'hi', message_type: 'success' } },
        { noType: true },
        { type: '' },
      ],
    })
    expect(wf.steps).toHaveLength(1)
    expect(wf.steps[0].type).toBe('show_message')
  })

  it('mints an id for a step that has none', () => {
    const step = parseStep({ type: 'show_message' })
    expect(step?.id).toBeTruthy()
  })

  it('heals a known step config through its own parser', () => {
    const step = parseStep({ type: 'show_message', config: { message_type: 'nonsense' } })
    expect(step?.config).toEqual({ message: '', message_type: 'info' })
  })
})

describe('unknown node types survive a round-trip', () => {
  // The forward-compatibility property: opening a graph in a client that
  // predates one of its node types must not silently delete those steps on
  // save. Losing an author's work is far worse than rendering a warning.
  const stored = {
    version: 1,
    steps: [
      { id: 's1', type: 'show_message', config: { message: 'a', message_type: 'info' } },
      { id: 's2', type: 'from_the_future', config: { some: 'payload', nested: { deep: 1 } } },
    ],
  }

  it('preserves the unknown step and its config verbatim', () => {
    const wf = parseUiWorkflow(stored)
    expect(wf.steps).toHaveLength(2)
    expect(wf.steps[1]).toEqual({
      id: 's2',
      type: 'from_the_future',
      config: { some: 'payload', nested: { deep: 1 } },
    })
  })

  it('reports it as a problem instead of failing the parse', () => {
    const problems = validateUiWorkflow(parseUiWorkflow(stored))
    expect(problems.map((p) => p.code)).toContain('unknown_node')
    expect(problems.find((p) => p.code === 'unknown_node')?.stepId).toBe('s2')
  })
})

describe('branching', () => {
  const branching = {
    version: 1,
    steps: [
      {
        id: 'if1',
        type: 'condition',
        config: {
          when: { combinator: 'and', conditions: [{ id: 'c', field: 'stage', op: 'eq', value: 'won' }], groups: [] },
          then: [{ id: 't1', type: 'show_message', config: { message: 'won', message_type: 'success' } }],
          else: [{ id: 'e1', type: 'show_message', config: { message: 'not yet', message_type: 'info' } }],
        },
      },
    ],
  }

  it('parses nested branch steps', () => {
    const wf = parseUiWorkflow(branching)
    const cfg = wf.steps[0].config as ConditionStepConfig
    expect(cfg.then).toHaveLength(1)
    expect(cfg.else).toHaveLength(1)
    expect(cfg.then[0].type).toBe('show_message')
  })

  it('walks into branches without knowing which node types branch', () => {
    // walkSteps consults childStepLists from the registry, so a future
    // branching node needs no change here.
    const ids = walkSteps(parseUiWorkflow(branching).steps).map((s) => s.id)
    expect(ids).toEqual(['if1', 't1', 'e1'])
  })

  it('validates steps nested inside branches', () => {
    const withBadChild = {
      steps: [{ id: 'if1', type: 'condition', config: { when: {}, then: [{ id: 'x', type: 'bogus' }], else: [] } }],
    }
    const problems = validateUiWorkflow(parseUiWorkflow(withBadChild))
    expect(problems.find((p) => p.code === 'unknown_node')?.stepId).toBe('x')
  })

  it('treats an empty condition as matching everything', () => {
    // Consistent with FilterGroup.IsEmpty() compiling to the literal `true`
    // everywhere else here: an empty filter constrains nothing.
    const cfg = parseStep({ type: 'condition', config: {} })!.config as ConditionStepConfig
    expect(cfg.when.conditions).toEqual([])
    expect(cfg.when.combinator).toBe('and')
  })
})

describe('platform reporting', () => {
  it('reports the platforms that can run every step', () => {
    const wf = parseUiWorkflow({ steps: [{ id: 'a', type: 'show_message' }] })
    expect(graphPlatforms(wf.steps)).toContain('web')
  })

  it('treats an unknown node as runnable nowhere', () => {
    // The honest answer: this build can't say a step it doesn't know will run
    // anywhere, and claiming otherwise is how a graph silently no-ops.
    expect(graphPlatforms([{ id: 'x', type: 'bogus', config: null }])).toEqual([])
  })
})

describe('the registry contract', () => {
  it('registered the expected node set', () => {
    const types = allUiWorkflowNodes().map((n) => n.type).sort()
    expect(types).toEqual([
      'condition', 'create_record', 'fetch_records', 'navigate',
      'run_workflow', 'set_field', 'set_field_state', 'set_variable',
      'show_dialog', 'show_message', 'update_record',
    ])
  })

  it('every node describes itself and parses junk without throwing', () => {
    for (const node of allUiWorkflowNodes()) {
      expect(node.configSchema.type, `${node.type} schema`).toBe('object')
      expect(node.description, `${node.type} description`).toBeTruthy()
      expect(node.platforms.length, `${node.type} platforms`).toBeGreaterThan(0)
      for (const junk of [null, undefined, 0, 'x', [], { nope: true }]) {
        expect(() => node.parseConfig(junk), `${node.type} parseConfig(${String(junk)})`).not.toThrow()
      }
      expect(() => node.createDefaultConfig()).not.toThrow()
    }
  })

  it('keeps show_message wire-compatible with the server node of the same name', () => {
    // Same type string AND same keys, so the two builders' vocabularies agree
    // and the generated catalog stays coherent.
    const def = getUiWorkflowNode('show_message')!
    expect(Object.keys(def.createDefaultConfig() as object).sort()).toEqual(['message', 'message_type'])
  })

  it('clamps fetch_records page size rather than trusting it', () => {
    const def = getUiWorkflowNode('fetch_records')!
    const big = def.parseConfig({ form_id: 'f', page_size: 100000 }) as { page_size: number }
    expect(big.page_size).toBe(500)
    const zero = def.parseConfig({ form_id: 'f', page_size: 0 }) as { page_size: number }
    expect(zero.page_size).toBe(1)
  })

  it('exposes no node that could hold a credential', () => {
    // The boundary in a test: anything needing a secret, a connector or an
    // agent must go through run_workflow, never a client node of its own.
    const types = allUiWorkflowNodes().map((n) => n.type)
    for (const forbidden of ['http_request', 'run_agent', 'connector', 'send_email', 'notification']) {
      expect(types, `${forbidden} must not be a client node`).not.toContain(forbidden)
    }
  })
})

describe('validateUiWorkflow', () => {
  it('flags an empty workflow', () => {
    expect(validateUiWorkflow(parseUiWorkflow({ steps: [] })).map((p) => p.code)).toContain('empty')
  })

  it('is quiet on a well-formed one', () => {
    const wf = parseUiWorkflow({ steps: [{ id: 'a', type: 'show_message', config: { message: 'hi' } }] })
    expect(validateUiWorkflow(wf)).toEqual([])
  })
})

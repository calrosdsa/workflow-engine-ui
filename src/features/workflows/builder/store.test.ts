// @vitest-environment jsdom
//
// Covers the fix for a real bug a user hit live: dropping a node on an
// Iterator that already has its Loop End wired up ("+"/branch-toolbar,
// same handler either way) forked a dead-end sibling branch off the
// iterator instead of nesting the new node inside the loop body. The fix
// generalizes to "whatever node currently sits at the tail of a loop body"
// (the empty iterator itself, or the last node already inside a non-empty
// body) — both must splice new nodes onto the tail→loop_end edge, not fork.
import { describe, it, expect, beforeEach } from 'vitest'
import { useBuilderStore } from './store'
import type { IteratorConfig, WorkflowDefinitionGraph } from '../types'

// seedNew() itself now leaves the canvas empty (the onboarding modal is
// what creates the singleton Trigger node on a real page) — these tests
// aren't about seeding, they just need a trigger node to build a graph
// from, so create one directly via the same store action the modal uses.
function reset() {
  useBuilderStore.getState().seedNew()
  useBuilderStore.getState().applyTriggerConfig({ mode: 'on_demand', enabled: true })
}

function nodesByType(type: string) {
  return useBuilderStore.getState().nodes.filter((n) => n.data.type === type)
}

function outgoingFrom(sourceId: string) {
  return useBuilderStore.getState().edges.filter((e) => e.source === sourceId)
}

beforeEach(() => {
  reset()
})

describe('addConnectedNode — loop-body-tail splicing', () => {
  it('adding an iterator creates a paired loop_end wired directly to it', () => {
    const trigger = nodesByType('trigger')[0]
    useBuilderStore.getState().addConnectedNode('iterator', trigger.id)

    const iterator = nodesByType('iterator')[0]
    const loopEnd = nodesByType('loop_end')[0]
    expect(iterator).toBeDefined()
    expect(loopEnd).toBeDefined()
    expect((iterator.data.configuration as IteratorConfig).loop_end_id).toBe(loopEnd.id)

    const iteratorOut = outgoingFrom(iterator.id)
    expect(iteratorOut).toHaveLength(1)
    expect(iteratorOut[0].target).toBe(loopEnd.id)
  })

  it('adding a node on an empty iterator splices it between the iterator and loop_end, not a sibling branch', () => {
    const trigger = nodesByType('trigger')[0]
    useBuilderStore.getState().addConnectedNode('iterator', trigger.id)
    const iterator = nodesByType('iterator')[0]
    const loopEnd = nodesByType('loop_end')[0]

    useBuilderStore.getState().addConnectedNode('set_variable', iterator.id)

    const setVar = nodesByType('set_variable')[0]
    expect(setVar).toBeDefined()

    // The iterator must still have exactly ONE outgoing edge — into the new
    // node, not a second fork alongside the loop_end edge.
    const iteratorOut = outgoingFrom(iterator.id)
    expect(iteratorOut).toHaveLength(1)
    expect(iteratorOut[0].target).toBe(setVar.id)

    // The new node must lead into loop_end, completing the splice.
    const setVarOut = outgoingFrom(setVar.id)
    expect(setVarOut).toHaveLength(1)
    expect(setVarOut[0].target).toBe(loopEnd.id)

    // loop_end must have no other incoming edge left dangling from the old
    // iterator→loop_end edge (it should have been removed, not duplicated).
    const loopEndIn = useBuilderStore.getState().edges.filter((e) => e.target === loopEnd.id)
    expect(loopEndIn).toHaveLength(1)
    expect(loopEndIn[0].source).toBe(setVar.id)
  })

  it('adding a second node continues extending the tail, not forking off the first body node', () => {
    const trigger = nodesByType('trigger')[0]
    useBuilderStore.getState().addConnectedNode('iterator', trigger.id)
    const iterator = nodesByType('iterator')[0]
    const loopEnd = nodesByType('loop_end')[0]

    useBuilderStore.getState().addConnectedNode('set_variable', iterator.id)
    const firstBodyNode = nodesByType('set_variable')[0]

    useBuilderStore.getState().addConnectedNode('debug', firstBodyNode.id)
    const debugNode = nodesByType('debug')[0]

    // The chain must now read iterator -> set_variable -> debug -> loop_end,
    // all single-child, nothing branching off to a dead end.
    expect(outgoingFrom(iterator.id)).toEqual([expect.objectContaining({ target: firstBodyNode.id })])
    expect(outgoingFrom(firstBodyNode.id)).toEqual([expect.objectContaining({ target: debugNode.id })])
    expect(outgoingFrom(debugNode.id)).toEqual([expect.objectContaining({ target: loopEnd.id })])
  })

  it('a real second branch off a non-tail node (e.g. the trigger) still forks normally, unaffected by the loop-tail fix', () => {
    // Give the trigger an existing outgoing edge first, so the next
    // addConnectedNode call on it is inherently "add a second branch."
    const trigger = nodesByType('trigger')[0]
    useBuilderStore.getState().addConnectedNode('exit', trigger.id)
    const exit = nodesByType('exit')[0]

    useBuilderStore.getState().addConnectedNode('http_request', trigger.id)
    const httpNode = nodesByType('http_request')[0]

    const triggerOut = outgoingFrom(trigger.id)
    expect(triggerOut).toHaveLength(2)
    const targets = triggerOut.map((e) => e.target).sort()
    expect(targets).toEqual([exit.id, httpNode.id].sort())
  })

  it('adding a node on a plain leaf node (not a loop tail) still links normally', () => {
    const trigger = nodesByType('trigger')[0]
    useBuilderStore.getState().addConnectedNode('http_request', trigger.id)
    const httpNode = nodesByType('http_request')[0]

    useBuilderStore.getState().addConnectedNode('set_variable', httpNode.id)
    const setVar = nodesByType('set_variable')[0]

    expect(outgoingFrom(httpNode.id)).toEqual([expect.objectContaining({ target: setVar.id })])
  })
})

describe('insertNodeOnEdge — iterator auto-pairing on edge-hover insert', () => {
  it('inserting an iterator on an edge auto-creates its paired loop_end, not a dangling half-loop', () => {
    const trigger = nodesByType('trigger')[0]
    useBuilderStore.getState().addConnectedNode('exit', trigger.id)
    const exit = nodesByType('exit')[0]
    const triggerToExit = outgoingFrom(trigger.id)[0]

    useBuilderStore.getState().insertNodeOnEdge('iterator', triggerToExit.id)

    const iterator = nodesByType('iterator')[0]
    const loopEnd = nodesByType('loop_end')[0]
    expect(iterator).toBeDefined()
    expect(loopEnd).toBeDefined()
    expect((iterator.data.configuration as IteratorConfig).loop_end_id).toBe(loopEnd.id)

    // The graph must read trigger -> iterator -> loop_end -> exit, with the
    // original trigger->exit edge fully replaced, not left dangling.
    expect(outgoingFrom(trigger.id)).toEqual([expect.objectContaining({ target: iterator.id })])
    expect(outgoingFrom(iterator.id)).toEqual([expect.objectContaining({ target: loopEnd.id })])
    expect(outgoingFrom(loopEnd.id)).toEqual([expect.objectContaining({ target: exit.id })])

    const allEdges = useBuilderStore.getState().edges
    expect(allEdges.find((e) => e.id === triggerToExit.id)).toBeUndefined()
  })

  it('a node subsequently added via "+" on that same iterator still splices into the body (both fixes compose)', () => {
    const trigger = nodesByType('trigger')[0]
    useBuilderStore.getState().addConnectedNode('exit', trigger.id)
    const triggerToExit = outgoingFrom(trigger.id)[0]
    useBuilderStore.getState().insertNodeOnEdge('iterator', triggerToExit.id)

    const iterator = nodesByType('iterator')[0]
    const loopEnd = nodesByType('loop_end')[0]
    useBuilderStore.getState().addConnectedNode('set_variable', iterator.id)
    const setVar = nodesByType('set_variable')[0]

    expect(outgoingFrom(iterator.id)).toEqual([expect.objectContaining({ target: setVar.id })])
    expect(outgoingFrom(setVar.id)).toEqual([expect.objectContaining({ target: loopEnd.id })])
  })
})

describe('seedNew / applyTriggerConfig — brand-new workflow lifecycle', () => {
  it('seedNew leaves a genuinely empty canvas — no Trigger, no End node', () => {
    useBuilderStore.getState().seedNew()
    expect(useBuilderStore.getState().nodes).toEqual([])
    expect(useBuilderStore.getState().edges).toEqual([])
  })

  it('applyTriggerConfig creates the singleton Trigger node when none exists yet', () => {
    useBuilderStore.getState().seedNew()
    useBuilderStore.getState().applyTriggerConfig({ mode: 'scheduled', cron: '* * * * *' })

    const nodes = useBuilderStore.getState().nodes
    expect(nodes).toHaveLength(1)
    expect(nodes[0].data.type).toBe('trigger')
    expect(nodes[0].data.configuration).toEqual({ mode: 'scheduled', cron: '* * * * *' })
    expect(useBuilderStore.getState().selectedNodeId).toBe(nodes[0].id)
    expect(useBuilderStore.getState().configPanelOpen).toBe(true)
  })

  it('applyTriggerConfig reconfigures the existing Trigger node in place instead of adding a second one', () => {
    useBuilderStore.getState().seedNew()
    useBuilderStore.getState().applyTriggerConfig({ mode: 'on_demand' })
    const firstId = useBuilderStore.getState().nodes[0].id

    useBuilderStore.getState().applyTriggerConfig({ mode: 'scheduled', cron: '0 * * * *' })

    const nodes = useBuilderStore.getState().nodes
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe(firstId)
    expect(nodes[0].data.configuration).toEqual({ mode: 'scheduled', cron: '0 * * * *' })
  })
})

// Covers a real bug found while wiring the canvas's left/right drag zones to
// this splice: the old before/after branches never actually detached the
// dragged node from its old parent (or, for 'after', cross-wired dragged's
// old parents to target's old children) — reordering nodes already in a
// chain produced a cycle instead of a clean line. There's no way to drive
// native HTML5 drag-and-drop from this harness, so these pin the store-level
// splice directly: detach dragged from its old spot (bridging its old
// parent straight to its old child so neither side is stranded), then
// splice it in immediately before/after the target.
describe('reorderNode — before/after splice', () => {
  function edgeSet() {
    return useBuilderStore.getState().edges.map((e) => `${e.source}->${e.target}`).sort()
  }

  function loadChain() {
    useBuilderStore.getState().loadDefinition('wf-chain', 'Chain', {
      id: 'wf-chain',
      variables: [],
      metadata: { version: 1 },
      nodes: [
        { id: 'A', type: 'trigger', label: 'A', position: { x: 0, y: 0 }, configuration: { mode: 'on_demand' }, inputs: [], outputs: [] },
        { id: 'B', type: 'set_variable', label: 'B', position: { x: 240, y: 0 }, configuration: {}, inputs: [], outputs: [] },
        { id: 'C', type: 'set_variable', label: 'C', position: { x: 480, y: 0 }, configuration: {}, inputs: [], outputs: [] },
      ],
      edges: [
        { id: 'e1', source: 'A', target: 'B', source_handle: '', target_handle: '' },
        { id: 'e2', source: 'B', target: 'C', source_handle: '', target_handle: '' },
      ],
    } as unknown as WorkflowDefinitionGraph)
  }

  it('before: dragging the tail before the root makes it the new root, leaving a clean line', () => {
    loadChain()
    useBuilderStore.getState().reorderNode('C', 'A', 'before')
    // C->A->B — no cycle back through the old B->C edge.
    expect(edgeSet()).toEqual(['A->B', 'C->A'].sort())
  })

  it('before: dragging the tail in front of the middle node bridges around the gap it leaves', () => {
    loadChain()
    useBuilderStore.getState().reorderNode('C', 'B', 'before')
    // A->C->B — A keeps feeding the line, B becomes the new tail.
    expect(edgeSet()).toEqual(['A->C', 'C->B'].sort())
  })

  it('after: dragging the root after the tail makes the middle node the new root', () => {
    loadChain()
    useBuilderStore.getState().reorderNode('A', 'C', 'after')
    // B->C->A — B (previously fed only by A) becomes the root.
    expect(edgeSet()).toEqual(['B->C', 'C->A'].sort())
  })

  it('after: dragging the middle node after the tail bridges the root straight to the tail', () => {
    loadChain()
    useBuilderStore.getState().reorderNode('B', 'C', 'after')
    // A->C->B — A bridges past B directly to C, then C feeds B.
    expect(edgeSet()).toEqual(['A->C', 'C->B'].sort())
  })

  it('before/after: preserves the branch handle when bridging around a dragged node', () => {
    useBuilderStore.getState().loadDefinition('wf-branch', 'Branch', {
      id: 'wf-branch',
      variables: [],
      metadata: { version: 1 },
      nodes: [
        { id: 'T', type: 'trigger', label: 'T', position: { x: 0, y: 0 }, configuration: { mode: 'on_demand' }, inputs: [], outputs: [] },
        { id: 'cond', type: 'condition', label: 'cond', position: { x: 240, y: 0 }, configuration: { expression: 'true' }, inputs: [], outputs: [] },
        { id: 'M', type: 'set_variable', label: 'M', position: { x: 480, y: 0 }, configuration: {}, inputs: [], outputs: [] },
        { id: 'N', type: 'set_variable', label: 'N', position: { x: 720, y: 0 }, configuration: {}, inputs: [], outputs: [] },
      ],
      edges: [
        { id: 'e1', source: 'T', target: 'cond', source_handle: '', target_handle: '' },
        { id: 'e2', source: 'cond', target: 'M', source_handle: 'true', target_handle: '' },
        { id: 'e3', source: 'M', target: 'N', source_handle: '', target_handle: '' },
      ],
    } as unknown as WorkflowDefinitionGraph)

    // Move M to right after T — cond's 'true' branch must now go straight
    // to N, still tagged 'true', not silently flattened to the default 'out'.
    useBuilderStore.getState().reorderNode('M', 'T', 'after')

    const edges = useBuilderStore.getState().edges
    const bridged = edges.find((e) => e.source === 'cond' && e.target === 'N')
    expect(bridged?.sourceHandle).toBe('true')
    expect(edgeSet()).toEqual(['T->M', 'M->cond', 'cond->N'].sort())
  })
})

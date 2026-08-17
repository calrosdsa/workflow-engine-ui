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
import type { IteratorConfig } from '../types'

function reset() {
  useBuilderStore.getState().seedNew()
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
    // seedNew() already wires trigger -> exit, so the trigger already has
    // one outgoing edge (to exit) before this test even starts — every
    // addConnectedNode call on it is inherently "add a second branch."
    const trigger = nodesByType('trigger')[0]
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

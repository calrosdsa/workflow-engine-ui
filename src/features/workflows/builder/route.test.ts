import { describe, expect, it } from 'vitest'
import { upstreamRoute } from './route'
import type { FlowEdge } from './store'

const edge = (id: string, source: string, target: string) => ({ id, source, target }) as FlowEdge

describe('upstreamRoute', () => {
  // trigger -> fetch -> condition -> (true) notify
  //                              -> (false) email
  const edges = [
    edge('e1', 'trigger', 'fetch'),
    edge('e2', 'fetch', 'condition'),
    edge('e3', 'condition', 'notify'),
    edge('e4', 'condition', 'email'),
  ]

  it('lights the path back to the trigger and nothing downstream or sideways', () => {
    const route = upstreamRoute(edges, 'notify')
    expect([...route.edgeIds].sort()).toEqual(['e1', 'e2', 'e3'])
    expect([...route.nodeIds].sort()).toEqual(['condition', 'fetch', 'notify', 'trigger'])
  })

  it('lights nothing but the step itself for the trigger', () => {
    const route = upstreamRoute(edges, 'trigger')
    expect(route.edgeIds.size).toBe(0)
    expect([...route.nodeIds]).toEqual(['trigger'])
  })

  it('includes every branch that joins at a merge', () => {
    const route = upstreamRoute([...edges, edge('e5', 'notify', 'merge'), edge('e6', 'email', 'merge')], 'merge')
    expect([...route.edgeIds].sort()).toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'e6'])
  })

  it('terminates on a loop back edge', () => {
    const loop = [
      edge('a', 'trigger', 'iterator'),
      edge('b', 'iterator', 'body'),
      edge('c', 'body', 'loop_end'),
      edge('d', 'loop_end', 'iterator'),
      edge('e', 'loop_end', 'after'),
    ]
    const route = upstreamRoute(loop, 'after')
    expect([...route.edgeIds].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

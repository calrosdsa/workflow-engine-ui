import { describe, it, expect } from 'vitest'
import { nodeSetupIssue } from './node-validation'
import type { GraphNode } from '../types'

// Execute Workflow (subflow) now has real execution-time dispatch (see
// internal/graph.SubflowConfig, internal/subflow) — the setup-issue check
// mirrors every other node's own "what's the one thing this can't run
// without" convention: a target workflow must be selected, everything else
// (mappings, sync mode) is optional.
describe('nodeSetupIssue — subflow', () => {
  it('flags a subflow node with no workflow selected', () => {
    const node = { type: 'subflow', configuration: { definition_id: '' } } as unknown as GraphNode
    expect(nodeSetupIssue(node)).toBe('Pick a workflow to run')
  })

  it('flags a subflow node with no configuration at all', () => {
    const node = { type: 'subflow', configuration: undefined } as unknown as GraphNode
    expect(nodeSetupIssue(node)).toBe('Pick a workflow to run')
  })

  it('is satisfied once a workflow is selected', () => {
    const node = { type: 'subflow', configuration: { definition_id: 'a-real-uuid', sync: true } } as unknown as GraphNode
    expect(nodeSetupIssue(node)).toBeNull()
  })
})

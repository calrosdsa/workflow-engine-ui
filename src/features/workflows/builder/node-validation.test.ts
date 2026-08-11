import { describe, it, expect } from 'vitest'
import { nodeSetupIssue } from './node-validation'
import type { GraphNode } from '../types'

// FR-B2-003: subflow has no execution-time dispatch in the backend at all —
// a saved workflow reaching that node failed at runtime with a generic
// "unknown node type" error. The backend now hard-rejects it at save time
// (internal/graph/configs.go's SubflowConfig.Validate), and it's no longer
// addable from the palette (node-registry.ts's PALETTE_NODES) — this only
// still matters for a workflow saved before that change, whose existing
// subflow node needs a clear reason to remove it rather than a cryptic save
// failure or (previously) an all-clear "Link a workflow" once a UUID was
// pasted in.
describe('nodeSetupIssue — subflow', () => {
  it('flags a subflow node even when definition_id is set', () => {
    const node = { type: 'subflow', configuration: { definition_id: 'a-real-uuid' } } as unknown as GraphNode
    expect(nodeSetupIssue(node)).toBe('Not supported — remove this node')
  })

  it('flags a subflow node with no configuration at all', () => {
    const node = { type: 'subflow', configuration: undefined } as unknown as GraphNode
    expect(nodeSetupIssue(node)).toBe('Not supported — remove this node')
  })
})

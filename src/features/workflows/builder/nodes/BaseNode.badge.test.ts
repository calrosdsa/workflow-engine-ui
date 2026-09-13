// Covers FR-C5-007's per-node duration badge: the canvas overlay's existing
// status badge (BaseNode.tsx, bottom-right corner) must APPEND the node's
// duration rather than gaining a new element — there is no free corner left
// (bottom-left: message/error, right-middle: debug snapshot, top-left:
// warning). statusBadgeText is the pure composition BaseNode renders both
// the badge's visible text and its title from, tested directly rather than
// through a full ReactFlow-provider render (see this file's sibling for why:
// BaseNode's only OTHER new/changed behavior worth a render test is the
// executionOrder per-execution mode switch, covered instead by
// executionOrder.test.ts's computeLogOrder tests plus manual inspection of
// the realOrderActive branch, since standing up ReactFlowProvider +
// node-taxonomy mocking here would spend a lot of setup on a branch that's
// mostly conditional JSX, not new logic).
import { describe, it, expect } from 'vitest'
import { statusBadgeText } from './BaseNode'

describe('statusBadgeText', () => {
  it('renders just the status label when no timing is available (unreached, or a structurally untimed node type)', () => {
    expect(statusBadgeText('COMPLETED')).toBe('Completed')
    expect(statusBadgeText('FAILED')).toBe('Failed')
  })

  it('appends the tiered duration when a node_timings entry is present', () => {
    expect(statusBadgeText('COMPLETED', { status: 'COMPLETED', duration_ms: 340, attempt: 1 }))
      .toBe('Completed · 340ms')
  })

  it('reuses formatDuration\'s tiering, not a second formatter', () => {
    expect(statusBadgeText('COMPLETED', { status: 'COMPLETED', duration_ms: 1500, attempt: 1 }))
      .toBe('Completed · 1.5s')
    expect(statusBadgeText('FAILED', { status: 'FAILED', duration_ms: 65_000, attempt: 2 }))
      .toBe('Failed · 1m 5s')
  })

  it('keeps the special-cased COMPLETED_WITH_ERRORS label alongside a duration', () => {
    expect(statusBadgeText('COMPLETED_WITH_ERRORS', { status: 'COMPLETED', duration_ms: 200, attempt: 1 }))
      .toBe('Completed with errors · 200ms')
  })
})

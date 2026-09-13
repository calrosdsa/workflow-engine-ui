import { describe, it, expect } from 'vitest'
import { computeLogOrder } from './executionOrder'

describe('computeLogOrder', () => {
  it('returns null for no log data (falls back to the static heuristic)', () => {
    expect(computeLogOrder([])).toBeNull()
  })

  it('ranks nodes by their earliest started_at, 1-based', () => {
    const order = computeLogOrder([
      { node_id: 'trigger-1', started_at: '2026-09-12T10:00:00Z' },
      { node_id: 'node-b', started_at: '2026-09-12T10:00:02Z' },
      { node_id: 'node-a', started_at: '2026-09-12T10:00:01Z' },
    ])
    expect(order).toEqual({ 'trigger-1': 1, 'node-a': 2, 'node-b': 3 })
  })

  // A node can own multiple rows: a retried attempt, or multiple loop_chunk
  // rows for the same Iterator. Ranking raw rows instead of grouping by
  // node_id would burn extra step numbers on the same node and throw off
  // every rank after it — this is the trap computeLogOrder exists to avoid.
  it('de-dupes multiple rows for the same node_id (retries, loop chunks) using the earliest timestamp', () => {
    const order = computeLogOrder([
      { node_id: 'trigger-1', started_at: '2026-09-12T10:00:00Z' },
      { node_id: 'iterator-1', started_at: '2026-09-12T10:00:05Z' }, // chunk 2 (later)
      { node_id: 'iterator-1', started_at: '2026-09-12T10:00:01Z' }, // chunk 1 (earliest)
      { node_id: 'exit', started_at: '2026-09-12T10:00:10Z' },
    ])
    expect(order).toEqual({ 'trigger-1': 1, 'iterator-1': 2, exit: 3 })
    expect(Object.keys(order ?? {})).toHaveLength(3)
  })

  it('ignores rows with an unparseable started_at rather than throwing', () => {
    const order = computeLogOrder([
      { node_id: 'trigger-1', started_at: 'not-a-date' },
      { node_id: 'node-a', started_at: '2026-09-12T10:00:01Z' },
    ])
    expect(order).toEqual({ 'node-a': 1 })
  })

  it('returns null when every row has an unparseable timestamp', () => {
    expect(computeLogOrder([{ node_id: 'trigger-1', started_at: 'nope' }])).toBeNull()
  })
})

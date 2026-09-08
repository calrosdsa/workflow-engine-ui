import { describe, it, expect } from 'vitest'
import { stripBucketSortPrefix } from './bucket-label'

describe('stripBucketSortPrefix', () => {
  it('strips the sort-safe "NN\\x1f" prefix a range-bucketed key carries', () => {
    expect(stripBucketSortPrefix('00\x1f<= 30')).toBe('<= 30')
    expect(stripBucketSortPrefix('02\x1f> 90')).toBe('> 90')
  })

  it('passes an ordinary key with no separator through unchanged', () => {
    expect(stripBucketSortPrefix('North')).toBe('North')
    expect(stripBucketSortPrefix('(empty)')).toBe('(empty)')
    expect(stripBucketSortPrefix('2024-01')).toBe('2024-01')
  })
})

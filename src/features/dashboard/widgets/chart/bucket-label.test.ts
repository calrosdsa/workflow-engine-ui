import { describe, it, expect } from 'vitest'
import { groupKeyLabel, rawGroupKey, stripBucketSortPrefix } from './bucket-label'

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

describe('rawGroupKey', () => {
  // The engine's `omitempty` drops a key that is "", so absent means "".
  it('reads an absent or null key as the empty string', () => {
    expect(rawGroupKey(undefined)).toBe('')
    expect(rawGroupKey(null)).toBe('')
    expect(rawGroupKey('')).toBe('')
  })

  it('passes a present key through untouched, prefix and all', () => {
    expect(rawGroupKey('01\x1f31 - 60')).toBe('01\x1f31 - 60')
    expect(rawGroupKey('(empty)')).toBe('(empty)')
  })
})

describe('groupKeyLabel', () => {
  const labels = { empty: 'NO-VALUE', blank: 'BLANK' }

  it('names a blank key rather than leaving the category unlabelled', () => {
    expect(groupKeyLabel(undefined, labels)).toBe('BLANK')
    expect(groupKeyLabel(null, labels)).toBe('BLANK')
    expect(groupKeyLabel('', labels)).toBe('BLANK')
  })

  // NULL is its own group, and a banded NULL comes back unprefixed.
  it('names the "(empty)" sentinel with the other label', () => {
    expect(groupKeyLabel('(empty)', labels)).toBe('NO-VALUE')
  })

  it('strips the prefix from every other key', () => {
    expect(groupKeyLabel('00\x1f<= 30', labels)).toBe('<= 30')
    expect(groupKeyLabel('North', labels)).toBe('North')
  })
})

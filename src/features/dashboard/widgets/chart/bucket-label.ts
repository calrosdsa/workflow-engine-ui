/** Mirrors workflow-engine's formdata.BucketLabelSep exactly — a control
 *  character no real label can contain, separating a range-bucketed
 *  dimension's sort-safe "NN" prefix (what SortBy "group" actually orders
 *  by server-side) from its human display label. Every place that shows an
 *  aggregate group's key to a viewer must strip it first; a key with no
 *  separator (every other dimension shape) passes through unchanged. */
const BUCKET_LABEL_SEP = '\x1f'

export function stripBucketSortPrefix(key: string): string {
  const i = key.indexOf(BUCKET_LABEL_SEP)
  return i < 0 ? key : key.slice(i + BUCKET_LABEL_SEP.length)
}

/** Mirrors workflow-engine's formdata.BucketLabelSep exactly — a control
 *  character no real label can contain, separating a range-bucketed
 *  dimension's sort-safe "NN" prefix (what SortBy "group" actually orders
 *  by server-side) from its human display label. Every place that shows an
 *  aggregate group's key to a viewer must strip it first; a key with no
 *  separator (every other dimension shape) passes through unchanged. */
const BUCKET_LABEL_SEP = '\x1f'

/** formdata.emptyGroupLabel — what a group of records with NO value (SQL
 *  NULL) comes back keyed as, for every dimension shape, range bands
 *  included (their NULL case skips the prefix). */
export const EMPTY_GROUP_KEY = '(empty)'

export function stripBucketSortPrefix(key: string): string {
  const i = key.indexOf(BUCKET_LABEL_SEP)
  return i < 0 ? key : key.slice(i + BUCKET_LABEL_SEP.length)
}

/** The key a group actually stands for. The engine omits an EMPTY-STRING
 *  key from the response rather than sending "" (see
 *  AggregateGroupResponse.key), so an absent key on a grouped response
 *  means "" — the value a text field holds when it was saved blank. null is
 *  folded in too, since nothing about the wire format rules it out. */
export function rawGroupKey(key: string | null | undefined): string {
  return key ?? ''
}

/** The words a viewer reads for the two "no value" groups. Passed in rather
 *  than written here because they are translated (useTranslation), and this
 *  module is pure. */
export interface GroupKeyLabels {
  /** For EMPTY_GROUP_KEY: records where the field is unset. */
  empty: string
  /** For "": records where the field was saved blank. */
  blank: string
}

/** What a viewer reads for one group key: the sort prefix stripped, and the
 *  two "no value" groups named in the viewer's language. Left alone, a blank
 *  key draws a bar with no label at all, which reads as a rendering fault,
 *  and NULL shows the engine's English sentinel.
 *
 *  The two stay DIFFERENT labels on purpose. They are separate groups in the
 *  response, and they cannot be merged here: an average, minimum, maximum or
 *  median of two groups is not computable from the two results. Giving them
 *  the same name would draw two bars that look like one category.
 *
 *  Display only. Anything that has to act on a key (drill-down, CSV) reads
 *  the raw key, where "(empty)" is still the engine's sentinel. */
export function groupKeyLabel(key: string | null | undefined, labels: GroupKeyLabels): string {
  const raw = rawGroupKey(key)
  if (raw === '') return labels.blank
  const label = stripBucketSortPrefix(raw)
  return label === EMPTY_GROUP_KEY ? labels.empty : label
}

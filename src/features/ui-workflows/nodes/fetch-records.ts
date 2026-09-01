import { Search } from 'lucide-react'
import { registerUiWorkflowNode } from '../node-registry'
import { ALL_PLATFORMS } from '../types'
import type { FilterGroup, SortRule } from '@/features/workflows/types'

/** Reads records into a run variable. Same type string and the same
 *  FilterGroup/SortRule grammar as the server's fetch_records node — menus and
 *  saved views already speak it, and inventing a third filter dialect for the
 *  client would be gratuitous.
 *
 *  Goes through the ordinary record search endpoint AS THE VIEWER, so the
 *  viewer's own per-form permissions apply exactly as if they had opened a
 *  Search menu. A UI workflow can never read more than the person looking at
 *  the screen already could. */
export interface FetchRecordsStepConfig {
  form_id: string
  filter?: FilterGroup
  sort: SortRule[]
  page_size: number
  output_variable: string
}

/** Bounded here, not merely defaulted: the value ends up as a page size on a
 *  real query, and an unbounded one lets a workflow pull a whole table in one
 *  request. Same posture as the HTML menu bridge's clampPageSize. */
export const MAX_PAGE_SIZE = 500

export function emptyFetchRecordsConfig(): FetchRecordsStepConfig {
  return { form_id: '', sort: [], page_size: 50, output_variable: 'records' }
}

export function parseFetchRecordsConfig(raw: unknown): FetchRecordsStepConfig {
  const empty = emptyFetchRecordsConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  const size = Number(r.page_size)
  return {
    form_id: typeof r.form_id === 'string' ? r.form_id : empty.form_id,
    filter: r.filter && typeof r.filter === 'object' ? (r.filter as FilterGroup) : undefined,
    sort: Array.isArray(r.sort) ? (r.sort as SortRule[]) : empty.sort,
    page_size: Number.isFinite(size)
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(size)))
      : empty.page_size,
    output_variable:
      typeof r.output_variable === 'string' && r.output_variable
        ? r.output_variable
        : empty.output_variable,
  }
}

registerUiWorkflowNode({
  type: 'fetch_records',
  label: 'Find Records',
  icon: Search,
  description: 'Looks up records on a form and stores them in a variable.',
  category: 'data',
  platforms: ALL_PLATFORMS,
  configSchema: {
    type: 'object',
    description:
      "Searches a form's records as the current viewer — their own form permissions apply. Uses the same filter and sort grammar as menus and workflow nodes.",
    required: ['form_id', 'output_variable'],
    properties: {
      form_id: { type: 'string', description: 'Form whose records to search.' },
      filter: { type: 'object', description: 'FilterGroup narrowing the result.' },
      sort: { type: 'array', description: 'SortRule list.' },
      page_size: {
        type: 'integer',
        description: `Rows to fetch, clamped to 1..${MAX_PAGE_SIZE}.`,
      },
      output_variable: {
        type: 'string',
        description: 'Run variable the matching rows are stored in.',
      },
    },
  },
  parseConfig: parseFetchRecordsConfig,
  createDefaultConfig: emptyFetchRecordsConfig,
})

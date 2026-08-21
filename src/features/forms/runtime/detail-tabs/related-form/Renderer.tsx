// Wraps RecordsTable.tsx (the same component every Search menu and the
// Dashboard table widget already share) rather than issuing a bare
// formsApi.searchRecords call directly — filtering, sorting, pagination, and
// the record-detail drawer/click-to-open all come for free. The base
// relationship link ({targetFieldName} eq {recordId}) is composed with the
// tab's own optional additionalFilter via AND, not a replacement for it —
// deleting/loosening additionalFilter must never widen the result set past
// "records actually linked to this one."
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { nanoid } from '@/features/workflows/builder/nanoid'
import { formsApi } from '@/features/forms/api'
import { RecordsTable } from '../../RecordsTable'
import type { DetailTabRendererProps } from '../contract'
import type { RelatedFormTabConfig } from './schema'
import type { FilterGroup } from '@/features/workflows/types'

function buildLinkFilter(fieldName: string, recordId: string, additional: FilterGroup | undefined): FilterGroup {
  const linkCondition = {
    id: nanoid(),
    field: fieldName,
    op: 'eq' as const,
    value_mode: 'static' as const,
    value: recordId,
  }
  if (!additional || (additional.conditions.length === 0 && additional.groups.length === 0)) {
    return { combinator: 'and', conditions: [linkCondition], groups: [] }
  }
  return {
    combinator: 'and',
    conditions: [linkCondition],
    groups: [additional],
  }
}

export function RelatedFormTabRenderer({ recordId, config, onNavigateToRecord, onEmptyResolved }: DetailTabRendererProps<RelatedFormTabConfig>) {
  const filter = config.targetFormId && config.targetFieldName
    ? buildLinkFilter(config.targetFieldName, recordId, config.additionalFilter)
    : undefined

  // A separate, minimal existence check (page_size: 1) rather than a new
  // prop on RecordsTable itself — RecordsTable has no "tell me your result
  // total" callback today, and hideWhenEmpty is the one place this tab type
  // needs that signal; adding it here keeps RecordsTable's own contract
  // untouched for every other, far more numerous caller.
  const { data: existenceCheck } = useQuery({
    queryKey: ['forms', config.targetFormId, 'related-tab-existence', filter],
    queryFn: () => formsApi.searchRecords(config.targetFormId, { filter, page: 1, page_size: 1 }),
    enabled: !!filter && !!config.hideWhenEmpty,
  })

  useEffect(() => {
    if (!config.hideWhenEmpty) {
      onEmptyResolved?.(false)
      return
    }
    if (existenceCheck) onEmptyResolved?.(existenceCheck.total === 0)
    // onEmptyResolved intentionally excluded — RecordDetailPanel passes a
    // fresh inline function each render; re-running this effect for that
    // alone would re-report the same resolved value every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.hideWhenEmpty, existenceCheck])

  if (!config.targetFormId || !config.targetFieldName) {
    return (
      <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
        This tab isn't configured yet — pick a related form in the Form Builder's Detail Page settings.
      </p>
    )
  }

  return (
    <RecordsTable
      formId={config.targetFormId}
      columns={config.columns}
      defaultFilter={filter}
      defaultSort={config.sort}
      rowClick
      onExpandRecord={onNavigateToRecord ? (record) => onNavigateToRecord(config.targetFormId, record.id as string) : undefined}
    />
  )
}

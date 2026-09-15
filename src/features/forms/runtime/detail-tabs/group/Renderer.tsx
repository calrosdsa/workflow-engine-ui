// Renders this group's own child tabs as a nested sub-tab-bar — reuses
// DetailTabList, the exact same resolution/rendering machinery the
// top-level tab list uses, so a grouped child gets the same visibility/
// renderIf/hideWhenEmpty handling any top-level tab already gets, no
// special-casing.
import { DetailTabList } from '../DetailTabList'
import { useRecordDetail } from '../../record-detail-hooks'
import { MAX_GROUP_DEPTH } from '../contract'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { DetailTabRendererProps } from '../contract'
import type { GroupTabConfig } from './schema'

// Nothing in the registry/schema stops an admin from configuring a group
// that contains itself — directly, or via a cycle through several groups —
// which would otherwise recurse (DetailTabList -> GroupTabRenderer ->
// DetailTabList -> ...) until the browser tab crashes. groupDepth (threaded
// through DetailTabRendererProps, incremented once per nesting level) caps
// this at a depth no legitimate admin-authored layout would ever need.

export function GroupTabRenderer({
  formId, recordId, fields, schema, config, onNavigateToRecord, groupDepth = 0,
}: DetailTabRendererProps<GroupTabConfig>) {
  const t = useTranslation()
  // Re-reads the same React Query cache entry RecordDetailPanel's own
  // useRecordDetail call already populated — no extra network request, just
  // needed here too so a grouped child's renderIf expression (evaluated
  // against the record's live field values, same as any top-level tab's)
  // has something to resolve against.
  const { data: record } = useRecordDetail(formId, recordId)

  if (groupDepth >= MAX_GROUP_DEPTH) {
    return (
      <p className="text-sm" style={{ color: 'hsl(var(--destructive))' }}>
        {t('group.tab.too_deep')}
      </p>
    )
  }

  if (config.tabs.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
        {t('group.tab.empty')}
      </p>
    )
  }
  return (
    <DetailTabList
      formId={formId}
      recordId={recordId}
      fields={fields}
      schema={schema}
      record={record}
      tabConfigs={config.tabs}
      onNavigateToRecord={onNavigateToRecord}
      nested
      groupDepth={groupDepth + 1}
    />
  )
}

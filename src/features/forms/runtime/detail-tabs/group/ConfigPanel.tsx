// Form Builder-side config UI for the group tab type — reuses
// DetailPageConfigSection (the SAME reorder/add/hide/remove/configure list
// the top-level "Detail Page" panel already renders) for this group's own
// child tabs, recursively. No new list-editing UI — a group's children are
// edited exactly the way the top-level tab list already is, just scoped to
// this group's own config.tabs array instead of the form's detailTabs.
import { DetailPageConfigSection } from '@/features/form-builder/config/DetailPageConfigSection'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { DetailTabConfigPanelProps } from '../contract'
import type { GroupTabConfig } from './schema'

export function GroupTabConfigPanel({ config, onChange, formId }: DetailTabConfigPanelProps<GroupTabConfig>) {
  const t = useTranslation()
  return (
    <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('group.config.tabs_in_group')}</p>
      <DetailPageConfigSection
        formId={formId}
        detailTabs={config.tabs}
        onChange={(tabs) => onChange({ tabs })}
        applyDefault={false}
      />
    </div>
  )
}

// Form Builder-side config UI for the 'details' tab type — reuses
// DetailPageConfigSection (same list editor GroupTabConfigPanel already
// reuses) to edit this tab's own child tabs, e.g. "Comments" and "History"
// rendered below the record's fields.
import { DetailPageConfigSection } from '@/features/form-builder/config/DetailPageConfigSection'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { DetailTabConfigPanelProps } from '../contract'
import type { DetailsTabConfig } from './schema'

export function DetailsTabConfigPanel({ config, onChange, formId }: DetailTabConfigPanelProps<DetailsTabConfig>) {
  const t = useTranslation()
  return (
    <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('details.config.tabs_below_fields')}</p>
      <DetailPageConfigSection
        formId={formId}
        detailTabs={config.childTabs}
        onChange={(childTabs) => onChange({ childTabs })}
        applyDefault={false}
      />
    </div>
  )
}

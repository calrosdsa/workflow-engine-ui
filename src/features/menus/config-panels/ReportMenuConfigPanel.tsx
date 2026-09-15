// Config surface for the Report menu type — a report-definition picker, the
// smallest of the per-type config panels since the runtime viewer itself
// (ReportMenuRuntime) renders a live argument filter bar built from the
// report's own declared Arguments; there is nothing else to configure here
// at save time. Mirrors export_report custom action's own ConfigPanel (the
// only other report-definition picker in this codebase) for the picker UI
// itself, deliberately WITHOUT its per-argument argumentModes: that
// vocabulary's `current_record` option only makes sense bound to a form
// action's own triggering record, which a standalone menu never has.
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useReports } from '@/features/reports/hooks'
import { declaredArguments } from '@/features/reports/arguments'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { Menu, ReportMenuConfig } from '../types'

interface ReportMenuConfigPanelProps {
  menu: Menu
  onChange: (config: Menu['config']) => void
}

export function ReportMenuConfigPanel({ menu, onChange }: ReportMenuConfigPanelProps) {
  const t = useTranslation()
  const config = menu.config as ReportMenuConfig
  const { data: reports } = useReports()

  const selectedReport = reports?.find((r) => r.id === config.report_definition_id)
  const argumentList = selectedReport ? declaredArguments(selectedReport.definition) : []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('menus.config_panels.report.report_label')}</Label>
        <SelectMenu
          value={config.report_definition_id}
          onValueChange={(reportDefinitionId) => onChange({ ...config, report_definition_id: reportDefinitionId })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('menus.config_panels.report.choose_placeholder')} /></SelectTrigger>
          <SelectContent>
            {!reports || reports.length === 0 ? (
              <div className="px-2 py-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                {t('menus.config_panels.report.no_reports')}
              </div>
            ) : (
              reports.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </SelectMenu>
      </div>

      {selectedReport && (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
          {t(
            selectedReport.definition.blocks.length === 1 ? 'menus.config_panels.report.block_count_one' : 'menus.config_panels.report.block_count_many',
            { count: selectedReport.definition.blocks.length },
          )}
          {argumentList.length > 0 && t(
            argumentList.length === 1 ? 'menus.config_panels.report.filter_count_one' : 'menus.config_panels.report.filter_count_many',
            { count: argumentList.length },
          )}
          {t('menus.config_panels.report.visibility_note')}
        </p>
      )}
    </div>
  )
}

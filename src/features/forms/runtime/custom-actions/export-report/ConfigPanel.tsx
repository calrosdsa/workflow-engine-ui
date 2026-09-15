// Config surface for the export_report custom action type (FR-D2-018) — a
// report-definition picker plus a default-format override. The smallest of
// the three action types' config panels (thinner than update_field's field-
// plus-value-mode picker, thinner than trigger_workflow's workflow-plus-
// scope picker) since there's no eligibility filtering to do here the way
// trigger_workflow's picker restricts to on_demand_data_driven workflows —
// any report definition in this app is a legal choice.
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useReports } from '@/features/reports/hooks'
import { ALL_FORMATS, type ExportFormat } from '@/features/reports/types'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { CustomActionConfigPanelProps } from '../contract'
import { effectiveArgumentMode, supportsCurrentRecord, type ArgumentMode, type ExportReportActionConfig } from './schema'
import { declaredArguments } from '@/features/reports/arguments'

export function ExportReportConfigPanel({ config, onChange, formId }: CustomActionConfigPanelProps<ExportReportActionConfig>) {
  const t = useTranslation()
  const { data: reports } = useReports()

  const selectedReport = reports?.find((r) => r.id === config.reportDefinitionId)
  const argumentList = selectedReport ? declaredArguments(selectedReport.definition) : []

  const setMode = (key: string, mode: ArgumentMode) => {
    onChange({ ...config, argumentModes: { ...config.argumentModes, [key]: mode } })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('export_report.config.report_label')}</Label>
        <SelectMenu
          value={config.reportDefinitionId}
          onValueChange={(reportDefinitionId) => onChange({ ...config, reportDefinitionId })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('export_report.config.choose_report_placeholder')} /></SelectTrigger>
          <SelectContent>
            {!reports || reports.length === 0 ? (
              <div className="px-2 py-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                {t('export_report.config.no_reports')}
              </div>
            ) : (
              reports.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </SelectMenu>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
          {t('export_report.config.format_label')} <span className="text-[hsl(var(--muted-foreground))] font-normal">{t('export_report.config.format_optional_hint')}</span>
        </Label>
        <SelectMenu
          value={config.format}
          onValueChange={(format) => onChange({ ...config, format: format as ExportFormat })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('export_report.config.use_default_placeholder')} /></SelectTrigger>
          <SelectContent>
            {ALL_FORMATS.map((f) => (
              // reports.format.* — shared with reports/ReportSettingsPanel.tsx
              // and ReportPreviewDialog.tsx; this custom-actions vertical
              // reaches into that namespace deliberately, the enum (FORMAT_LABELS,
              // reports/types.ts) is shared code, not duplicated copy.
              <SelectItem key={f} value={f} className="text-xs">{t(`reports.format.${f}.label`)}</SelectItem>
            ))}
          </SelectContent>
        </SelectMenu>
      </div>

      {argumentList.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-[hsl(var(--border))] p-3">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            {t('export_report.config.inputs_label')}
          </Label>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {t('export_report.config.inputs_help')}
          </p>

          {argumentList.map((argument) => {
            const canUseRecord = supportsCurrentRecord(argument, formId)
            const mode = effectiveArgumentMode(argument, config, formId)
            return (
              <div key={argument.key} className="flex flex-col gap-1">
                <Label className="text-[11px] text-[hsl(var(--foreground))]">
                  {argument.label}
                  {argument.required && <span className="ml-1 text-[hsl(var(--destructive))]">*</span>}
                </Label>
                <SelectMenu value={mode} onValueChange={(v) => setMode(argument.key, v as ArgumentMode)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {/* Only offered where it can actually work: a reference
                        argument pointing at this very form. Otherwise a saved
                        config could only ever fail at click time. */}
                    {canUseRecord && (
                      <SelectItem value="current_record" className="text-xs">{t('export_report.config.mode_current_record')}</SelectItem>
                    )}
                    <SelectItem value="prompt" className="text-xs">{t('export_report.config.mode_prompt')}</SelectItem>
                    {/* A required argument has nothing to fall back on, so
                        leaving it empty could only fail at click time. */}
                    {!argument.required && (
                      <SelectItem value="skip" className="text-xs">{t('export_report.config.mode_skip')}</SelectItem>
                    )}
                  </SelectContent>
                </SelectMenu>
                {!canUseRecord && argument.type === 'reference' && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {t('export_report.config.mode_hint_prompt_forced')}
                  </p>
                )}
                {mode === 'skip' && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {t('export_report.config.mode_hint_skip')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

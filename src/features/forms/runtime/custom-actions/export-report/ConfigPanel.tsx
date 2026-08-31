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
import type { ExportFormat } from '@/features/reports/types'
import type { CustomActionConfigPanelProps } from '../contract'
import { effectiveArgumentMode, supportsCurrentRecord, type ArgumentMode, type ExportReportActionConfig } from './schema'
import { declaredArguments } from '@/features/reports/arguments'

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV',
  xlsx: 'Excel (.xlsx)',
  xls: 'Excel 97-2003 (.xls)',
  pdf: 'PDF',
  docx: 'Word (.docx)',
  markdown: 'Markdown',
}

export function ExportReportConfigPanel({ config, onChange, formId }: CustomActionConfigPanelProps<ExportReportActionConfig>) {
  const { data: reports } = useReports()

  const selectedReport = reports?.find((r) => r.id === config.reportDefinitionId)
  const argumentList = selectedReport ? declaredArguments(selectedReport.definition) : []

  const setMode = (key: string, mode: ArgumentMode) => {
    onChange({ ...config, argumentModes: { ...config.argumentModes, [key]: mode } })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Report to export</Label>
        <SelectMenu
          value={config.reportDefinitionId}
          onValueChange={(reportDefinitionId) => onChange({ ...config, reportDefinitionId })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose a report…" /></SelectTrigger>
          <SelectContent>
            {!reports || reports.length === 0 ? (
              <div className="px-2 py-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                No reports yet. Create one in Report Builder first.
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
          Format <span className="text-[hsl(var(--muted-foreground))] font-normal">(optional — defaults to the report's own default format)</span>
        </Label>
        <SelectMenu
          value={config.format}
          onValueChange={(format) => onChange({ ...config, format: format as ExportFormat })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Use report default…" /></SelectTrigger>
          <SelectContent>
            {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
              <SelectItem key={f} value={f} className="text-xs">{FORMAT_LABELS[f]}</SelectItem>
            ))}
          </SelectContent>
        </SelectMenu>
      </div>

      {argumentList.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-[hsl(var(--border))] p-3">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            Report inputs
          </Label>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Choose where each input comes from when someone runs this action.
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
                      <SelectItem value="current_record" className="text-xs">Use the current record</SelectItem>
                    )}
                    <SelectItem value="prompt" className="text-xs">Ask the person</SelectItem>
                    {/* A required argument has nothing to fall back on, so
                        leaving it empty could only fail at click time. */}
                    {!argument.required && (
                      <SelectItem value="skip" className="text-xs">Leave empty</SelectItem>
                    )}
                  </SelectContent>
                </SelectMenu>
                {!canUseRecord && argument.type === 'reference' && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    This input points at a different form, so it has to be asked for.
                  </p>
                )}
                {mode === 'skip' && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    This input is left unset, so it won't narrow the report at all.
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

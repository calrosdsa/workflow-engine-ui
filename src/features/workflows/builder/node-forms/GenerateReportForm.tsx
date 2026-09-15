// generate_report — mirrors internal/graph/configs_report.go's
// ReportGenerateConfig (FR-B2-031). Report/format pickers mirror the
// export_report custom action's own ConfigPanel exactly (same SelectMenu
// pattern, same useReports()/FORMAT_LABELS) — the only other report-
// definition picker in this codebase. The Parameters static/expression
// split mirrors KnowledgeRetrievalForm's ModeToggle+ExpressionField pattern;
// static mode maps the selected report's OWN declared arguments (FR-J1-005)
// with the same controls the run prompt uses, so the node cannot drift from
// what the report actually declares. Required-argument enforcement is
// execution-time, not save-time: internal/graph cannot import
// internal/reports, so this panel only warns (FR-B2-032 ARG-R-06).
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { useReports } from '@/features/reports/hooks'
import { declaredArguments, missingRequiredArguments } from '@/features/reports/arguments'
import { ReportArgumentInput } from '@/features/reports/ReportArgumentsDialog'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, ReportGenerateConfig, ReportExportFormat, ValueMode } from '../../types'

export function normaliseReportGenerateConfig(raw: unknown): ReportGenerateConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReportGenerateConfig>
  return {
    report_definition_id: r.report_definition_id ?? '',
    format: r.format ?? '',
    parameters_mode: r.parameters_mode ?? 'static',
    parameters: r.parameters ?? {},
    parameters_expr: r.parameters_expr ?? '',
    output_var: r.output_var ?? '',
  }
}

// Kept as a plain (untranslated-at-definition) map — values are format
// NAMES, not prose, and are read through t() by dynamic key
// (`workflows.node_forms.report_format.<key>`) at every render site rather
// than translated here. Deliberately minted as real keys even though most
// values are language-invariant (CSV/PDF/HTML/Markdown, and Excel/Word stay
// "Excel"/"Word" in Spanish too): the per-app override layer can still
// customize them, and the project's unconditional t()-everything rule makes
// no exception for values that happen not to change across locales.
const FORMAT_LABELS: Record<ReportExportFormat, string> = {
  csv: 'CSV',
  xlsx: 'Excel (.xlsx)',
  xls: 'Excel 97-2003 (.xls)',
  pdf: 'PDF',
  docx: 'Word (.docx)',
  markdown: 'Markdown',
  html: 'HTML',
}

function ModeToggle({ mode, onChange }: { mode: ValueMode; onChange: (m: ValueMode) => void }) {
  const t = useTranslation()
  return (
    <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1">
      {(['static', 'expression'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
            mode === m ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
          )}
        >
          {m === 'static' ? t('workflows.node_forms.static') : t('workflows.node_forms.expression')}
        </button>
      ))}
    </div>
  )
}

export interface GenerateReportFormProps {
  config: ReportGenerateConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: ReportGenerateConfig) => void
}

export function GenerateReportForm({ config, variables, nodeContext, onChange }: GenerateReportFormProps) {
  const t = useTranslation()
  const { data: reports } = useReports()
  const set = (patch: Partial<ReportGenerateConfig>) => onChange({ ...config, ...patch })

  // Arguments come from the selected report's own declaration, so the node
  // maps real, named inputs rather than asking an author to hand-write a
  // JSON blob and hope the keys match.
  const selectedReport = reports?.find((r) => r.id === config.report_definition_id)
  const argumentList = selectedReport ? declaredArguments(selectedReport.definition) : []
  const unmappedRequired = missingRequiredArguments(argumentList, config.parameters ?? {})

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.report')}</Label>
        <SelectMenu
          value={config.report_definition_id}
          onValueChange={(report_definition_id) => set({ report_definition_id })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('workflows.node_forms.choose_report')} /></SelectTrigger>
          <SelectContent>
            {!reports || reports.length === 0 ? (
              <div className="px-2 py-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                {t('workflows.node_forms.no_reports')}
              </div>
            ) : (
              reports.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </SelectMenu>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {t('workflows.node_forms.format')} <span className="normal-case font-normal">{t('workflows.node_forms.format_optional_hint')}</span>
        </Label>
        <SelectMenu
          value={config.format ?? ''}
          onValueChange={(format) => set({ format: format as ReportExportFormat | '' })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('workflows.node_forms.use_report_default_placeholder')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-xs">{t('workflows.node_forms.use_report_default')}</SelectItem>
            {(Object.keys(FORMAT_LABELS) as ReportExportFormat[]).map((f) => (
              <SelectItem key={f} value={f} className="text-xs">{t(`workflows.node_forms.report_format.${f}`)}</SelectItem>
            ))}
          </SelectContent>
        </SelectMenu>
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.parameters')}</Label>
        <ModeToggle mode={config.parameters_mode ?? 'static'} onChange={(m) => set({ parameters_mode: m })} />
        {config.parameters_mode === 'expression' ? (
          <ExpressionField
            value={config.parameters_expr ?? ''}
            onChange={(v) => set({ parameters_expr: v })}
            variables={variables}
            nodeContext={nodeContext}
            placeholder={t('workflows.node_forms.report_params_placeholder')}
            label={t('workflows.node_forms.parameters')}
          />
        ) : argumentList.length > 0 ? (
          <div className="space-y-2.5">
            {argumentList.map((argument) => (
              <div key={argument.key} className="space-y-1">
                <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                  {/* argument.label is declared BY THE REPORT DEFINITION (its
                      own author-set argument label), not UI chrome — routing
                      it through t() would be wrong, there is no English
                      source string to look up. */}
                  {argument.label}
                  {argument.required && <span className="ml-1 text-[hsl(var(--destructive))]">*</span>}
                </Label>
                <ReportArgumentInput
                  argument={argument}
                  value={(config.parameters ?? {})[argument.key]}
                  onChange={(value) => set({ parameters: { ...(config.parameters ?? {}), [argument.key]: value } })}
                  disabled={false}
                />
              </div>
            ))}

            {/* Advisory only. A workflow has no person to prompt, so a
                required argument must be mapped here — but this cannot be a
                hard save-time validation: internal/graph does not import
                internal/reports and so cannot know a report's arguments. The
                real failure is execution-time (FR-B2-032 ARG-R-06); this
                warning exists so an author sees it first. */}
            {unmappedRequired.length > 0 && (
              <p className="rounded-md bg-[hsl(var(--warning))]/10 px-2 py-1.5 text-[10px] text-[hsl(var(--warning))]">
                {unmappedRequired.length === 1
                  ? t('workflows.node_forms.required_arg_missing', { name: unmappedRequired[0] })
                  : t('workflows.node_forms.required_args_missing', { count: unmappedRequired.length })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {config.report_definition_id
              ? t('workflows.node_forms.report_no_inputs')
              : t('workflows.node_forms.choose_report_to_see_inputs')}
          </p>
        )}
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.output_variable')}</Label>
        <Input
          value={config.output_var}
          onChange={(e) => set({ output_var: e.target.value })}
          placeholder={t('workflows.node_forms.report_result_placeholder')}
          className="h-8 font-mono text-[12px]"
        />
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {t('workflows.node_forms.report_result_help')}
        </p>
      </div>
    </div>
  )
}

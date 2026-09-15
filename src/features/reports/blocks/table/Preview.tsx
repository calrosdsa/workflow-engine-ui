import { useForm } from '@/features/forms/hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { ReportBlockRendererProps } from '../../report-block-contract'
import { reportBlockPreviewStyle } from '../../preview-style'
import type { TableBlockConfig } from './schema'

// Design-time-only preview — no real record data is queried or rendered
// here (that happens server-side, internal/reports, at generation time).
// Shows the form name and resolved column headers so an author can confirm
// the block is wired to the right source, matching the same
// "structure-not-data" preview convention page-builder's config-only
// widgets (heading/divider) already establish, extended here to a block
// type that DOES eventually resolve real data, just not in this component.
export function TableBlockPreview({ config, instance }: ReportBlockRendererProps<TableBlockConfig>) {
  const t = useTranslation()
  const { data: form } = useForm(config.form_id)

  if (!config.form_id) {
    return <p className="p-3 text-xs italic text-[hsl(var(--muted-foreground))]">{t('reports.blocks.no_form_selected')}</p>
  }

  const columns = config.columns?.length
    ? config.columns.map((c) => c.label || form?.fields.find((f) => f.name === c.key)?.label || c.key)
    : (form?.fields.map((f) => f.label) ?? [])
  const baseStyle = reportBlockPreviewStyle(instance.style)
  const headerStyle = { ...baseStyle, ...reportBlockPreviewStyle(config.style?.header) }
  const bodyStyle = { ...baseStyle, ...reportBlockPreviewStyle(config.style?.body) }

  return (
    <div className="flex h-full flex-col p-3">
      <p className="mb-2 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
        {form?.name ?? t('common.loading')} · {t('reports.blocks.table.preview_kind')}
      </p>
      <div className="overflow-hidden rounded border border-[hsl(var(--border))]" style={baseStyle}>
        <table className="w-full text-[11px]" style={baseStyle}>
          <thead className="bg-[hsl(var(--muted))]" style={headerStyle}>
            <tr>
              {columns.slice(0, 5).map((c, i) => (
                <th key={i} className="truncate px-2 py-1 text-left font-medium text-[hsl(var(--muted-foreground))]" style={headerStyle}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {columns.slice(0, 5).map((_, i) => (
                <td key={i} className="px-2 py-1.5 text-[hsl(var(--muted-foreground))]/50" style={bodyStyle}>···</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

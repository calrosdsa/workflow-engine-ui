import { useForm } from '@/features/forms/hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { ReportBlockRendererProps } from '../../report-block-contract'
import type { RelatedBlockConfig } from './schema'

// Design-time-only preview — see table/Preview.tsx's identical rationale;
// no real parent+children query runs here (the batched query, server-side,
// internal/reports/block_related.go). Shows both forms' names and the
// nested-sub-table shape (Jorge's resolved design, 2026-08-30: one small
// child table per parent row) so an author can confirm the relationship is
// wired correctly before generating a real report.
export function RelatedBlockPreview({ config }: ReportBlockRendererProps<RelatedBlockConfig>) {
  const t = useTranslation()
  const { data: parentForm } = useForm(config.parent_form_id)
  const { data: childForm } = useForm(config.child_form_id)

  if (!config.parent_form_id || !config.child_form_id) {
    return <p className="p-3 text-xs italic text-[hsl(var(--muted-foreground))]">{t('reports.blocks.related.no_forms_selected')}</p>
  }

  const parentColumns = parentForm?.fields.map((f) => f.label) ?? []
  const childColumns = (config.columns?.length
    ? config.columns.map((c) => c.label || childForm?.fields.find((f) => f.name === c.key)?.label || c.key)
    : (childForm?.fields.filter((f) => f.type !== 'parent_link').map((f) => f.label) ?? []))

  return (
    <div className="flex h-full flex-col p-3">
      <p className="mb-2 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
        {parentForm?.name ?? t('common.loading')} → {childForm?.name ?? t('common.loading')} · {t('reports.blocks.related.preview_kind')}
      </p>
      <div className="overflow-hidden rounded border border-[hsl(var(--border))]">
        <table className="w-full text-[11px]">
          <thead className="bg-[hsl(var(--muted))]">
            <tr>
              {parentColumns.slice(0, 5).map((c, i) => (
                <th key={i} className="truncate px-2 py-1 text-left font-medium text-[hsl(var(--muted-foreground))]">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {parentColumns.slice(0, 5).map((_, i) => (
                <td key={i} className="px-2 py-1.5 text-[hsl(var(--muted-foreground))]/50">···</td>
              ))}
            </tr>
            <tr>
              <td colSpan={Math.max(1, Math.min(5, parentColumns.length))} className="border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 px-2 py-1">
                <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">↳ {childForm?.name ?? t('reports.blocks.related.child_fallback')}: </span>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{childColumns.slice(0, 4).join(' · ')}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

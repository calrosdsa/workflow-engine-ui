import { useForm } from '@/features/forms/hooks'
import type { ReportBlockRendererProps } from '../../report-block-contract'
import type { GroupBlockConfig } from './schema'

// Design-time-only preview — see table/Preview.tsx's identical rationale;
// no real aggregate query runs here (RecordStore.Aggregate, server-side).
export function GroupBlockPreview({ config }: ReportBlockRendererProps<GroupBlockConfig>) {
  const { data: form } = useForm(config.form_id)

  if (!config.form_id) {
    return <p className="p-3 text-xs italic text-[hsl(var(--muted-foreground))]">No form selected</p>
  }

  const groupLabel = config.group_by
    ? form?.fields.find((f) => f.name === config.group_by!.field)?.label ?? config.group_by.field
    : null

  const seriesLabels = config.series.map((s) =>
    s.label || (s.field ? `${s.fn}(${form?.fields.find((f) => f.name === s.field)?.label ?? s.field})` : s.fn),
  )

  return (
    <div className="flex h-full flex-col p-3">
      <p className="mb-2 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
        {form?.name ?? 'Loading…'} · group/subtotal
      </p>
      <div className="overflow-hidden rounded border border-[hsl(var(--border))]">
        <table className="w-full text-[11px]">
          <thead className="bg-[hsl(var(--muted))]">
            <tr>
              {groupLabel && <th className="truncate px-2 py-1 text-left font-medium text-[hsl(var(--muted-foreground))]">{groupLabel}</th>}
              {seriesLabels.map((s, i) => (
                <th key={i} className="truncate px-2 py-1 text-left font-medium text-[hsl(var(--muted-foreground))]">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {groupLabel && <td className="px-2 py-1.5 text-[hsl(var(--muted-foreground))]/50">···</td>}
              {seriesLabels.map((_, i) => (
                <td key={i} className="px-2 py-1.5 text-[hsl(var(--muted-foreground))]/50">···</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

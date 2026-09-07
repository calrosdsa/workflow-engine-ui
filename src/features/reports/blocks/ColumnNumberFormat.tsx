import { useState } from 'react'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { NumberFormatFields } from '../NumberFormatFields'
import { sampleFor } from '../workbook/number-format'
import type { NumberFormat } from '../types'

export interface ColumnNumberFormatProps {
  /** Undefined means this column has no format and renders as plain text. */
  value: NumberFormat | undefined
  onChange: (format: NumberFormat | undefined) => void
  /** Disabled for a column the block is not actually rendering — a format on
   *  an unchecked column would be saved and never seen. */
  disabled?: boolean
}

// A column's number format, shown inline beside the column it belongs to.
//
// Collapsed by default and to a SUMMARY rather than a control: a block can
// have twenty columns and at most a couple of them are money, so the common
// row has to stay one line. Expanding swaps in the same fields the workbook
// cell panel uses.
export function ColumnNumberFormat({ value, onChange, disabled }: ColumnNumberFormatProps) {
  const t = useTranslation()
  const [open, setOpen] = useState(false)

  if (disabled) return null

  if (!open) {
    return (
      <button
        type="button"
        className="shrink-0 rounded border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        title={t('reports.number_format.heading')}
        onClick={() => setOpen(true)}
      >
        {value ? sampleFor(value) : t('reports.number_format.column_none')}
      </button>
    )
  }

  return (
    <div className="mt-1 w-full rounded border border-[hsl(var(--border))] p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
          {t('reports.number_format.heading')}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-[11px] text-[hsl(var(--muted-foreground))] underline"
            onClick={() => {
              onChange(undefined)
              setOpen(false)
            }}
          >
            {t('reports.number_format.clear')}
          </button>
          <button
            type="button"
            className="text-[11px] text-[hsl(var(--muted-foreground))] underline"
            onClick={() => setOpen(false)}
          >
            {t('reports.number_format.done')}
          </button>
        </div>
      </div>
      <NumberFormatFields
        value={value ?? { style: 'number', decimals: 2 }}
        onChange={onChange}
      />
    </div>
  )
}

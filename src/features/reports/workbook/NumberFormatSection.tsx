import { useState } from 'react'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NumberFormatFields } from '../NumberFormatFields'
import type { NumberFormat } from '../types'

export interface NumberFormatSectionProps {
  /** Reads the format on the current selection, so opening the section on a
   *  formatted cell shows what is set rather than a blank form. */
  read: () => NumberFormat | undefined
  apply: (format: NumberFormat | undefined) => void
}

const FIELD_LABEL = 'text-[11px] font-medium text-[hsl(var(--muted-foreground))]'

/**
 * NumberFormatSection formats the sheet's selected CELLS. The identical
 * controls appear per COLUMN on a table, related or group block — see
 * NumberFormatFields, which both surfaces share, because the descriptor is
 * one contract and a control present on only one of them would be a format
 * an author could set in one place and not the other for no visible reason.
 *
 * Univer's own number-format controls are hidden (see
 * SUPPRESSED_NUMFMT_MENU): they wrote an Excel pattern that this editor then
 * dropped on save, and they cannot express a currency symbol, non-US
 * separators, or accounting negatives — the cases this exists for.
 */
export function NumberFormatSection({ read, apply }: NumberFormatSectionProps) {
  const t = useTranslation()
  const [draft, setDraft] = useState<NumberFormat | undefined>(undefined)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <div className="space-y-2">
        <Label className={FIELD_LABEL}>{t('reports.number_format.heading')}</Label>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => {
            setDraft(read() ?? { style: 'number', decimals: 2 })
            setOpen(true)
          }}
        >
          {t('reports.number_format.open')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className={FIELD_LABEL}>{t('reports.number_format.heading')}</Label>
        <button
          type="button"
          className="text-[11px] text-[hsl(var(--muted-foreground))] underline"
          onClick={() => {
            apply(undefined)
            setDraft(undefined)
            setOpen(false)
          }}
        >
          {t('reports.number_format.clear')}
        </button>
      </div>
      <NumberFormatFields
        value={draft ?? {}}
        onChange={(next) => {
          setDraft(next)
          apply(next)
        }}
      />
    </div>
  )
}

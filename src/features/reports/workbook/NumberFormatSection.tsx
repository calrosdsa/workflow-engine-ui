import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NumberFormatFields } from '../NumberFormatFields'
import type { NumberFormat, ReportBlockRegion } from '../types'

export interface NumberFormatSectionProps {
  /** Reads the format on the current selection, so opening the section on a
   *  formatted cell shows what is set rather than a blank form. */
  read: () => NumberFormat | undefined
  apply: (format: NumberFormat | undefined) => void
  /** Whether the sheet has an actual selection right now — read() and
   *  apply() both resolve to Univer's own "active range," which (unlike a
   *  genuine drag-selection) is effectively always present once a cell has
   *  ever had focus, so neither can distinguish "author picked a cell" from
   *  "nothing was ever selected". getSelection is the one check in this
   *  editor that already makes that distinction (InsertDataMenu relies on
   *  it for the identical reason), so this reuses it rather than adding a
   *  second notion of "is anything selected". */
  getSelection?: () => ReportBlockRegion | undefined
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
export function NumberFormatSection({ read, apply, getSelection }: NumberFormatSectionProps) {
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
            // Not silently disabled: the control stays live and says what
            // is missing, since "nothing happened" is the worst possible
            // response — the same principle InsertDataMenu's own insert()
            // already applies for the identical reason (a stale/default
            // active range that isn't a real selection).
            if (getSelection && !getSelection()) {
              toast.error(t('reports.number_format.select_cells_first'))
              return
            }
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

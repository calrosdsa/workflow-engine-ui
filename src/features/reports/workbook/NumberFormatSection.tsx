import { useState } from 'react'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import type { NumberFormat } from '../types'
import { sampleFor } from './number-format'

export interface NumberFormatSectionProps {
  /** Reads the format on the current selection, so opening the section on a
   *  formatted cell shows what is set rather than a blank form. */
  read: () => NumberFormat | undefined
  apply: (format: NumberFormat | undefined) => void
}

const FIELD_LABEL = 'text-[11px] font-medium text-[hsl(var(--muted-foreground))]'

function labelledSelect(
  label: string,
  value: string,
  onValueChange: (v: string) => void,
  options: Array<{ value: string; label: string }>,
) {
  return (
    <div className="space-y-1">
      <Label className={FIELD_LABEL}>{label}</Label>
      <SelectMenu value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectMenu>
    </div>
  )
}

/**
 * NumberFormatSection is the ONLY place a number format is authored.
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

  const beginEditing = () => {
    setDraft(read() ?? { style: 'number', decimals: 2 })
    setOpen(true)
  }

  const update = (patch: Partial<NumberFormat>) => {
    const next = { ...(draft ?? {}), ...patch }
    // The two separators must differ — the backend rejects a descriptor
    // where they match, and it is easy to reach by accident: choosing the
    // European "1.234" while the decimal is still "." renders 1.234.567.89,
    // which is not a number in any locale. Moving the other one is better
    // than letting the save fail on a rule the panel could have kept.
    const thousands = next.thousands_separator ?? ','
    const decimal = next.decimal_separator || '.'
    if (thousands !== '' && thousands === decimal) {
      next.decimal_separator = thousands === '.' ? ',' : '.'
    }
    setDraft(next)
    apply(next)
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Label className={FIELD_LABEL}>{t('reports.number_format.heading')}</Label>
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={beginEditing}>
          {t('reports.number_format.open')}
        </Button>
      </div>
    )
  }

  const format = draft ?? {}
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

      {labelledSelect(t('reports.number_format.style'), format.style ?? 'number', (style) =>
        update({
          style: style as NumberFormat['style'],
          // A symbol left behind on a non-currency format is rejected by the
          // backend's own validation, so it is dropped here rather than
          // failing the save with a message about a field the author can no
          // longer see.
          ...(style === 'currency' ? {} : { currency_symbol: undefined }),
        }), [
        { value: 'number', label: t('reports.number_format.style_number') },
        { value: 'currency', label: t('reports.number_format.style_currency') },
        { value: 'percent', label: t('reports.number_format.style_percent') },
      ])}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className={FIELD_LABEL}>{t('reports.number_format.decimals')}</Label>
          <Input
            type="number"
            min={0}
            max={10}
            className="h-8 text-xs"
            value={format.decimals ?? 2}
            onChange={(e) => update({ decimals: Number(e.target.value) })}
          />
        </div>
        {format.style === 'currency' && (
          <div className="space-y-1">
            <Label className={FIELD_LABEL}>{t('reports.number_format.symbol')}</Label>
            <Input
              className="h-8 text-xs"
              placeholder="Bs "
              value={format.currency_symbol ?? ''}
              onChange={(e) => update({ currency_symbol: e.target.value })}
            />
          </div>
        )}
      </div>

      {format.style === 'currency' &&
        labelledSelect(t('reports.number_format.symbol_position'), format.currency_position ?? 'prefix', (v) =>
          update({ currency_position: v as NumberFormat['currency_position'] }), [
          { value: 'prefix', label: t('reports.number_format.symbol_prefix') },
          { value: 'suffix', label: t('reports.number_format.symbol_suffix') },
        ])}

      <div className="grid grid-cols-2 gap-2">
        {labelledSelect(t('reports.number_format.thousands'), format.thousands_separator ?? ',', (v) =>
          update({ thousands_separator: v === 'none' ? '' : v }), [
          { value: ',', label: '1,234' },
          { value: '.', label: '1.234' },
          { value: ' ', label: '1 234' },
          { value: 'none', label: t('reports.number_format.no_grouping') },
        ])}
        {labelledSelect(t('reports.number_format.decimal'), format.decimal_separator ?? '.', (v) =>
          update({ decimal_separator: v }), [
          { value: '.', label: '0.5' },
          { value: ',', label: '0,5' },
        ])}
      </div>

      {labelledSelect(t('reports.number_format.negatives'), format.negative_style ?? 'minus', (v) =>
        update({ negative_style: v as NumberFormat['negative_style'] }), [
        { value: 'minus', label: '-1,234.56' },
        { value: 'parentheses', label: '(1,234.56)' },
      ])}

      <div className="rounded border border-[hsl(var(--border))] px-2 py-1.5">
        <div className={FIELD_LABEL}>{t('reports.number_format.preview')}</div>
        <div className="font-mono text-xs">{sampleFor(format)}</div>
      </div>

      {/* Stated up front rather than left to be filed as a bug. A stored
          Excel number format is canonical — "," groups and "." is the
          decimal point — and the spreadsheet substitutes its own locale's
          characters when it renders. Nothing this editor or the backend can
          do changes that, so the grid above and an Excel set to US
          conventions will disagree with the PDF whenever the separators are
          not the US ones. */}
      {(format.thousands_separator ?? ',') !== ',' || (format.decimal_separator ?? '.') !== '.' ? (
        <p className="text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">
          {t('reports.number_format.locale_note', {
            sample: sampleFor({ ...format, thousands_separator: ',', decimal_separator: '.' }),
          })}
        </p>
      ) : null}
    </div>
  )
}

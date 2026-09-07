import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { NumberFormat } from './types'
import { sampleFor } from './workbook/number-format'

// The number-format controls, shared by the two places a format can be set:
// a workbook CELL (workbook/NumberFormatSection) and a data COLUMN on a
// table, related or group block (blocks/*/ConfigPanel). One component
// because the descriptor is one contract — a control that existed on only
// one of those surfaces would be a format an author could set in one place
// and not the other, for no reason they could see.

const FIELD_LABEL = 'text-[11px] font-medium text-[hsl(var(--muted-foreground))]'

export interface NumberFormatFieldsProps {
  value: NumberFormat
  onChange: (format: NumberFormat) => void
}

/**
 * withSeparatorsDistinct keeps the two separators different.
 *
 * The backend rejects a descriptor where they match, and the collision is
 * easy to reach by accident: choosing the European "1.234" grouping while
 * the decimal separator is still "." renders 1.234.567.89, which is a number
 * in no locale at all. Moving the other one is better than letting the save
 * fail on a rule this could have kept. Found by using the editor, not by a
 * test.
 */
export function withSeparatorsDistinct(format: NumberFormat): NumberFormat {
  const thousands = format.thousands_separator ?? ','
  const decimal = format.decimal_separator || '.'
  if (thousands === '' || thousands !== decimal) return format
  return { ...format, decimal_separator: thousands === '.' ? ',' : '.' }
}

export function NumberFormatFields({ value, onChange }: NumberFormatFieldsProps) {
  const t = useTranslation()
  const update = (patch: Partial<NumberFormat>) =>
    onChange(withSeparatorsDistinct({ ...value, ...patch }))

  const select = (
    label: string,
    selected: string,
    onValueChange: (v: string) => void,
    options: Array<{ value: string; label: string }>,
  ) => (
    <div className="space-y-1">
      <Label className={FIELD_LABEL}>{label}</Label>
      <SelectMenu value={selected} onValueChange={onValueChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </SelectMenu>
    </div>
  )

  const canonical = (value.thousands_separator ?? ',') === ',' && (value.decimal_separator ?? '.') === '.'

  return (
    <div className="space-y-3">
      {select(t('reports.number_format.style'), value.style ?? 'number', (style) =>
        update({
          style: style as NumberFormat['style'],
          // A symbol left behind on a non-currency format is rejected by the
          // backend's own validation, so it is dropped here rather than
          // failing the save over a field the author can no longer see.
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
            value={value.decimals ?? 2}
            onChange={(e) => update({ decimals: Number(e.target.value) })}
          />
        </div>
        {value.style === 'currency' && (
          <div className="space-y-1">
            <Label className={FIELD_LABEL}>{t('reports.number_format.symbol')}</Label>
            <Input
              className="h-8 text-xs"
              placeholder="Bs "
              value={value.currency_symbol ?? ''}
              onChange={(e) => update({ currency_symbol: e.target.value })}
            />
          </div>
        )}
      </div>

      {value.style === 'currency' && select(
        t('reports.number_format.symbol_position'), value.currency_position ?? 'prefix',
        (v) => update({ currency_position: v as NumberFormat['currency_position'] }), [
          { value: 'prefix', label: t('reports.number_format.symbol_prefix') },
          { value: 'suffix', label: t('reports.number_format.symbol_suffix') },
        ])}

      <div className="grid grid-cols-2 gap-2">
        {select(t('reports.number_format.thousands'), value.thousands_separator ?? ',',
          (v) => update({ thousands_separator: v === 'none' ? '' : v }), [
            { value: ',', label: '1,234' },
            { value: '.', label: '1.234' },
            { value: ' ', label: '1 234' },
            { value: 'none', label: t('reports.number_format.no_grouping') },
          ])}
        {select(t('reports.number_format.decimal'), value.decimal_separator ?? '.',
          (v) => update({ decimal_separator: v }), [
            { value: '.', label: '0.5' },
            { value: ',', label: '0,5' },
          ])}
      </div>

      {select(t('reports.number_format.negatives'), value.negative_style ?? 'minus',
        (v) => update({ negative_style: v as NumberFormat['negative_style'] }), [
          { value: 'minus', label: '-1,234.56' },
          { value: 'parentheses', label: '(1,234.56)' },
        ])}

      <div className="rounded border border-[hsl(var(--border))] px-2 py-1.5">
        <div className={FIELD_LABEL}>{t('reports.number_format.preview')}</div>
        <div className="font-mono text-xs">{sampleFor(value)}</div>
      </div>

      {/* Stated up front rather than left to be filed as a bug. A stored
          Excel number format is canonical — "," groups and "." is the
          decimal point — and the spreadsheet substitutes its own locale's
          characters when it renders, so a downloaded workbook disagrees with
          the PDF whenever the separators are not the US ones. */}
      {!canonical && (
        <p className="text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">
          {t('reports.number_format.locale_note', {
            sample: sampleFor({ ...value, thousands_separator: ',', decimal_separator: '.' }),
          })}
        </p>
      )}
    </div>
  )
}

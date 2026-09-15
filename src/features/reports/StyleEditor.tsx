// Shared style-editing UI for BlockStyle (FR-J1-004 §1) — used both by the
// Workbook region panel (a region's own override) and ReportSettingsPanel
// (the report-wide default, ReportDefinition.settings.style_defaults) via
// the exact same component, since the shape being
// edited is identical at both levels; only WHAT the edited value means
// (report-wide default vs. per-block override merged over it via
// ResolveStyle, internal/reports/style.go) differs, and that's the caller's
// concern, not this component's.
//
// bold/italic are genuinely tri-state (see types.ts's own doc comment on
// BlockStyle) — a plain on/off Checkbox can't represent "inherit" as a
// third state, so this uses a 3-way segmented control (Off / On / Inherit)
// for both, rather than a checkbox that would silently collapse "inherit"
// and "explicitly off" into the same unchecked appearance.
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ColorPicker } from '@/components/ui/color-picker'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { cn } from '@/lib/utils'
import type { BlockStyle } from './types'

interface StyleEditorProps {
  style: BlockStyle
  onChange: (style: BlockStyle) => void
  /** When true, labels this editor's fields as overriding an inherited
   *  report-wide default (per-block usage) rather than being the report's
   *  own baseline (report-settings usage) — copy only, no behavior change. */
  isBlockOverride?: boolean
}

type TriState = 'inherit' | 'off' | 'on'

function triStateOf(v: boolean | undefined): TriState {
  return v === undefined ? 'inherit' : v ? 'on' : 'off'
}
function triStateToValue(t: TriState): boolean | undefined {
  return t === 'inherit' ? undefined : t === 'on'
}

function TriStateControl({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (v: boolean | undefined) => void }) {
  const t = useTranslation()
  const current = triStateOf(value)
  const options: { key: TriState; label: string }[] = [
    { key: 'inherit', label: t('reports.style.inherit') },
    { key: 'off', label: t('reports.style.off') },
    { key: 'on', label: t('reports.style.on') },
  ]
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{label}</Label>
      <div className="flex gap-1 rounded-md bg-[hsl(var(--muted))] p-0.5">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(triStateToValue(o.key))}
            className={cn(
              'flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
              current === o.key ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const PADDING_PLACEHOLDER_KEYS = {
  top: 'reports.style.padding_t',
  right: 'reports.style.padding_r',
  bottom: 'reports.style.padding_b',
  left: 'reports.style.padding_l',
} as const

export function StyleEditor({ style, onChange, isBlockOverride }: StyleEditorProps) {
  const t = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <TriStateControl label={t('reports.style.bold')} value={style.bold} onChange={(bold) => onChange({ ...style, bold })} />
        <TriStateControl label={t('reports.style.italic')} value={style.italic} onChange={(italic) => onChange({ ...style, italic })} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
          {t('reports.style.align_label')}
          {isBlockOverride ? ` (${t('reports.style.overrides_default')})` : ''}
        </Label>
        <SelectMenu
          value={style.align ?? ''}
          onValueChange={(align) => onChange({ ...style, align: (align || undefined) as BlockStyle['align'] })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('reports.style.inherit')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-xs">{t('reports.style.inherit')}</SelectItem>
            <SelectItem value="left" className="text-xs">{t('reports.style.left')}</SelectItem>
            <SelectItem value="center" className="text-xs">{t('reports.style.center')}</SelectItem>
            <SelectItem value="right" className="text-xs">{t('reports.style.right')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('reports.style.text_color')}</Label>
          <ColorPicker
            value={style.text_color ?? '#111827'}
            onChange={(text_color) => onChange({ ...style, text_color })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('reports.style.fill_color')}</Label>
          <ColorPicker
            value={style.fill_color ?? '#ffffff'}
            onChange={(fill_color) => onChange({ ...style, fill_color })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('reports.style.border')}</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            value={style.border?.width ?? ''}
            onChange={(e) => {
              const width = e.target.value ? Number(e.target.value) : undefined
              onChange({ ...style, border: width === undefined && !style.border?.color ? undefined : { ...style.border, width } })
            }}
            placeholder={t('reports.style.width')}
            className="h-8 flex-1 text-sm"
          />
          <ColorPicker
            value={style.border?.color ?? '#000000'}
            onChange={(color) => onChange({ ...style, border: { ...style.border, color } })}
            className="flex-1"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
          {t('reports.style.padding')} <span className="font-normal">({t('reports.style.padding_sides')})</span>
        </Label>
        <div className="grid grid-cols-4 gap-1.5">
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <Input
              key={side}
              type="number"
              min={0}
              value={style.padding?.[side] ?? ''}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : undefined
                const next = { ...style.padding, [side]: v }
                const allUnset = !next.top && !next.right && !next.bottom && !next.left
                onChange({ ...style, padding: allUnset ? undefined : next })
              }}
              placeholder={t(PADDING_PLACEHOLDER_KEYS[side])}
              className="h-8 text-sm"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

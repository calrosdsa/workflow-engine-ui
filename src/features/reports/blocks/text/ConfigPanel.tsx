import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useTranslation, type I18nContextValue } from '@/features/i18n/I18nProvider'
import type { ReportBlockConfigPanelProps } from '../../report-block-contract'
import type { TextBlockConfig } from './schema'

function levelLabels(t: I18nContextValue['t']): Record<NonNullable<TextBlockConfig['level']>, string> {
  return {
    h1: t('reports.blocks.text.level_h1'),
    h2: t('reports.blocks.text.level_h2'),
    h3: t('reports.blocks.text.level_h3'),
    paragraph: t('reports.blocks.text.level_paragraph'),
  }
}

// Config surface for the "text" block type (FR-J1-002 §1): a single text
// area plus a heading-level select — the smallest config panel of any block
// type, matching this block's own "no form, no query" scope (block_text.go).
export function TextBlockConfigPanel({ config, onChange }: ReportBlockConfigPanelProps<TextBlockConfig>) {
  const t = useTranslation()
  const levelLabelMap = levelLabels(t)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('reports.blocks.text.style_label')}</Label>
        <SelectMenu
          value={config.level ?? 'paragraph'}
          onValueChange={(level) => onChange({ ...config, level: level as TextBlockConfig['level'] })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(levelLabelMap) as NonNullable<TextBlockConfig['level']>[]).map((l) => (
              <SelectItem key={l} value={l} className="text-xs">{levelLabelMap[l]}</SelectItem>
            ))}
          </SelectContent>
        </SelectMenu>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('reports.blocks.text.text_label')}</Label>
        <Textarea
          value={config.text}
          onChange={(e) => onChange({ ...config, text: e.target.value })}
          placeholder={t('reports.blocks.text.text_placeholder')}
          rows={3}
          className="text-sm"
        />
      </div>
    </div>
  )
}

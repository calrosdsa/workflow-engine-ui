// The 5 presentational (non-data-bearing) form-builder types each get their
// own General-tab component here, referenced from component-registry.ts's
// configPanel field — the same form/normalise pattern node-registry.ts and
// menu-registry.ts use, scoped to just these 5 (the other 19 component types
// share ConfigPanel.tsx's ElementConfig tabs directly; that shared flow isn't
// shallow, so it isn't broken up into one-component-per-type).
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select-menu'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { Field } from './ConfigPanel'
import { slugifyKey } from '../factory'
import type { FormElement } from '../schema'

export interface PresentationalFormProps {
  element: FormElement
  onChange: (patch: Partial<FormElement>) => void
}

export function HeadingForm({ element, onChange }: PresentationalFormProps) {
  const t = useTranslation()
  return (
    <>
      <Field label={t('form_config.heading_text')}>
        <Input value={element.content ?? ''} onChange={(e) => onChange({ content: e.target.value })} className="h-8 text-sm" />
      </Field>
      <Field label={t('form_config.level')}>
        <SelectMenu value={String(element.level ?? 2)} onValueChange={(v) => onChange({ level: Number(v) as 1 | 2 | 3 })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1" className="text-xs">{t('form_config.heading_1')}</SelectItem>
            <SelectItem value="2" className="text-xs">{t('form_config.heading_2')}</SelectItem>
            <SelectItem value="3" className="text-xs">{t('form_config.heading_3')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </Field>
    </>
  )
}

export function ParagraphForm({ element, onChange }: PresentationalFormProps) {
  const t = useTranslation()
  return (
    <Field label={t('form_config.paragraph_text')}>
      <Textarea value={element.content ?? ''} onChange={(e) => onChange({ content: e.target.value })} rows={4} className="text-sm" />
    </Field>
  )
}

export function SpacerForm({ element, onChange }: PresentationalFormProps) {
  const t = useTranslation()
  return (
    <Field label={t('form_config.height_px')}>
      <Input type="number" value={element.height ?? 24} onChange={(e) => onChange({ height: Number(e.target.value) })} className="h-8 text-sm" />
    </Field>
  )
}

export function DividerForm() {
  const t = useTranslation()
  return <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('form_config.divider_description')}</p>
}

export function HiddenForm({ element, onChange }: PresentationalFormProps) {
  const t = useTranslation()
  return (
    <>
      <Field label={t('form_config.field_name_key')}>
        <Input value={element.key} onChange={(e) => onChange({ key: slugifyKey(e.target.value) })} className="h-8 font-mono text-[12px]" />
      </Field>
      <Field label={t('form_config.default_value')}>
        <Input value={element.defaultValue == null ? '' : String(element.defaultValue)} onChange={(e) => onChange({ defaultValue: e.target.value })} className="h-8 text-sm" />
      </Field>
    </>
  )
}

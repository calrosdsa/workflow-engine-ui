// The 6 page-builder component types each get their own property-editor
// component here, referenced from component-registry.ts's configPanel field
// — the same form/normalise pattern node-registry.ts and menu-registry.ts
// use. Kept in one shared file (not one-file-per-type like
// workflows/builder/node-forms/) since none of these 6 approaches the size/
// complexity that justified that split — button, the largest, is still a
// few dozen lines.
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select-menu'
import { MenuSlugSelect } from './MenuSlugSelect'
import type { PageComponent } from '../schema'
import { useTranslation } from '@/features/i18n/I18nProvider'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-slate-600">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

export interface ComponentFormProps {
  component: PageComponent
  onChange: (patch: Partial<PageComponent>) => void
  /** The Custom menu currently being edited — passed through so the button
   *  component's "target another menu" picker can exclude linking to itself. */
  currentMenuId?: string
}

export function HeadingComponentForm({ component, onChange }: ComponentFormProps) {
  const t = useTranslation()
  return (
    <>
      <Field label={t('page_config.heading_text')}>
        <Input value={component.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} className="h-8 text-sm" />
      </Field>
      <Field label={t('page_config.level')}>
        <SelectMenu value={String(component.level ?? 2)} onValueChange={(v) => onChange({ level: Number(v) as 1 | 2 | 3 })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1" className="text-xs">{t('page_config.heading_level_1')}</SelectItem>
            <SelectItem value="2" className="text-xs">{t('page_config.heading_level_2')}</SelectItem>
            <SelectItem value="3" className="text-xs">{t('page_config.heading_level_3')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </Field>
    </>
  )
}

export function ParagraphComponentForm({ component, onChange }: ComponentFormProps) {
  const t = useTranslation()
  return (
    <Field label={t('page_config.paragraph_text')}>
      <Textarea value={component.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} rows={4} className="text-sm" />
    </Field>
  )
}

export function ImageComponentForm({ component, onChange }: ComponentFormProps) {
  const t = useTranslation()
  return (
    <>
      <Field label={t('page_config.image_url')} hint={t('page_config.image_url_hint')}>
        <Input value={component.src ?? ''} onChange={(e) => onChange({ src: e.target.value })} placeholder="https://…" className="h-8 text-sm" />
      </Field>
      <Field label={t('page_config.alt_text')}>
        <Input value={component.alt ?? ''} onChange={(e) => onChange({ alt: e.target.value })} className="h-8 text-sm" />
      </Field>
      <Field label={t('page_config.width')}>
        <SelectMenu value={component.width ?? 'full'} onValueChange={(v) => onChange({ width: v as PageComponent['width'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="full" className="text-xs">{t('page_config.full_width')}</SelectItem>
            <SelectItem value="half" className="text-xs">{t('page_config.half_width')}</SelectItem>
            <SelectItem value="third" className="text-xs">{t('page_config.third_width')}</SelectItem>
            <SelectItem value="auto" className="text-xs">{t('page_config.auto_natural_size')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </Field>
    </>
  )
}

export function SpacerComponentForm({ component, onChange }: ComponentFormProps) {
  const t = useTranslation()
  return (
    <Field label={t('page_config.height_px')}>
      <Input type="number" value={component.height ?? 24} onChange={(e) => onChange({ height: Number(e.target.value) })} className="h-8 text-sm" />
    </Field>
  )
}

export function DividerComponentForm() {
  const t = useTranslation()
  return <p className="text-xs text-slate-400">{t('page_config.divider_help')}</p>
}

export function ButtonComponentForm({ component, onChange, currentMenuId }: ComponentFormProps) {
  const t = useTranslation()
  return (
    <>
      <Field label={t('page_config.button_label')}>
        <Input value={component.label ?? ''} onChange={(e) => onChange({ label: e.target.value })} className="h-8 text-sm" />
      </Field>
      <Field label={t('page_config.style')}>
        <SelectMenu value={component.variant ?? 'primary'} onValueChange={(v) => onChange({ variant: v as PageComponent['variant'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="primary" className="text-xs">{t('page_config.primary')}</SelectItem>
            <SelectItem value="secondary" className="text-xs">{t('page_config.secondary')}</SelectItem>
            <SelectItem value="outline" className="text-xs">{t('page_config.outline')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </Field>
      <div>
        <Label className="mb-1.5 block text-[11px] font-medium text-slate-600">{t('page_config.links_to')}</Label>
        <div className="flex gap-1 rounded-md bg-slate-100 p-0.5">
          {(['menu', 'external'] as const).map((linkType) => (
            <button
              key={linkType}
              type="button"
              onClick={() => onChange({ linkType })}
              className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                (component.linkType ?? 'external') === linkType ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'
              }`}
            >
              {linkType === 'menu' ? t('page_config.another_menu') : t('page_config.external_url')}
            </button>
          ))}
        </div>
      </div>
      {(component.linkType ?? 'external') === 'menu' ? (
        <Field label={t('page_config.target_menu')}>
          <MenuSlugSelect value={component.menuSlug ?? ''} onChange={(slug) => onChange({ menuSlug: slug })} excludeMenuId={currentMenuId} />
        </Field>
      ) : (
        <Field label={t('page_config.url')}>
          <Input value={component.url ?? ''} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://…" className="h-8 text-sm" />
        </Field>
      )}
    </>
  )
}

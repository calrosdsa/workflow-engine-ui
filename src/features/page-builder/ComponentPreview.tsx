import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { PageComponent } from './schema'

// Per-type switch for canvas-preview rendering — mirrors
// features/form-builder/ElementPreview.tsx's presentational branch
// (heading/paragraph/divider/spacer render nearly identically there, no
// label-wrapper/RHF logic needed for either). The button component has no
// direct precedent (form-builder has no navigational component), so it maps
// PageComponent.variant ('primary'|'secondary'|'outline') onto the existing
// Button primitive's variant vocabulary ('default'|'ghost'|'outline') rather
// than inventing new styling.
const BUTTON_VARIANT_MAP = {
  primary: 'default',
  secondary: 'ghost',
  outline: 'outline',
} as const

export function ComponentPreview({ component }: { component: PageComponent }) {
  const t = useTranslation()
  switch (component.component) {
    case 'divider':
      return <hr className="my-2 border-slate-200" />
    case 'spacer':
      return <div style={{ height: component.height ?? 24 }} className="flex items-center justify-center" aria-hidden>
        <span className="text-[10px] text-slate-300">{component.height ?? 24}px</span>
      </div>
    case 'heading': {
      const sizes = { 1: 'text-xl', 2: 'text-lg', 3: 'text-base' }
      // component.text || fallback: a read-only render expression, never
      // written back — the persisted seed (factory.ts's base.text =
      // 'Heading') is a separate literal and stays untranslated. Same
      // display-fallback-vs-seed distinction as button's label below.
      return <p className={cn('font-semibold text-slate-800', sizes[component.level ?? 2])}>{component.text || t('builder.pages.preview.heading_placeholder')}</p>
    }
    case 'paragraph':
      return <p className="text-sm leading-relaxed text-slate-500">{component.text || t('builder.pages.preview.paragraph_placeholder')}</p>
    case 'image':
      return component.src ? (
        <img src={component.src} alt={component.alt ?? ''} className="max-h-40 rounded-md object-cover" />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-[11px] text-slate-400">
          {t('builder.pages.preview.no_image')}
        </div>
      )
    case 'button': {
      const target = component.linkType === 'menu'
        ? (component.menuSlug || t('builder.pages.preview.no_menu_selected'))
        : (component.url || t('builder.pages.preview.no_url_set'))
      return (
        <div className="flex flex-col items-start gap-1">
          <Button type="button" variant={BUTTON_VARIANT_MAP[component.variant ?? 'primary']} size="sm" disabled className="pointer-events-none">
            {component.label || t('builder.pages.preview.button_fallback')}
          </Button>
          <span className="text-[10px] text-slate-400">→ {target}</span>
        </div>
      )
    }
  }
}

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
  switch (component.component) {
    case 'divider':
      return <hr className="my-2 border-slate-200" />
    case 'spacer':
      return <div style={{ height: component.height ?? 24 }} className="flex items-center justify-center" aria-hidden>
        <span className="text-[10px] text-slate-300">{component.height ?? 24}px</span>
      </div>
    case 'heading': {
      const sizes = { 1: 'text-xl', 2: 'text-lg', 3: 'text-base' }
      return <p className={cn('font-semibold text-slate-800', sizes[component.level ?? 2])}>{component.text || 'Heading'}</p>
    }
    case 'paragraph':
      return <p className="text-sm leading-relaxed text-slate-500">{component.text || 'Paragraph text.'}</p>
    case 'image':
      return component.src ? (
        <img src={component.src} alt={component.alt ?? ''} className="max-h-40 rounded-md object-cover" />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-[11px] text-slate-400">
          No image URL set
        </div>
      )
    case 'button': {
      const target = component.linkType === 'menu'
        ? (component.menuSlug || 'no menu selected')
        : (component.url || 'no URL set')
      return (
        <div className="flex flex-col items-start gap-1">
          <Button type="button" variant={BUTTON_VARIANT_MAP[component.variant ?? 'primary']} size="sm" disabled className="pointer-events-none">
            {component.label || 'Button'}
          </Button>
          <span className="text-[10px] text-slate-400">→ {target}</span>
        </div>
      )
    }
  }
}

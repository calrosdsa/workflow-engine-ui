import { Button } from '@/components/ui/button'
import type { WidgetRendererProps } from '../../widget-contract'
import type { ButtonWidgetConfig } from './schema'

// Adapts the 'button' case of CustomMenuRuntime.tsx's RuntimeComponent, same
// variant mapping. In 'builder' mode the click handler is a no-op — per the
// widget contract's documented mode semantics ("builder renders live but
// inert"), a Quick Links/Button widget must not actually navigate away from
// the dashboard the author is mid-edit on.
const BUTTON_VARIANT_MAP = { primary: 'default', secondary: 'ghost', outline: 'outline' } as const

export function ButtonRenderer({ config, onNavigate, mode }: WidgetRendererProps<ButtonWidgetConfig>) {
  const variant = BUTTON_VARIANT_MAP[config.variant]

  if (config.linkType === 'external' && config.url) {
    if (mode === 'builder') {
      return (
        <div className="p-3">
          <Button type="button" variant={variant}>{config.label || 'Button'}</Button>
        </div>
      )
    }
    return (
      <div className="p-3">
        <a href={config.url} target="_blank" rel="noopener noreferrer">
          <Button type="button" variant={variant}>{config.label || 'Button'}</Button>
        </a>
      </div>
    )
  }

  return (
    <div className="p-3">
      <Button
        type="button"
        variant={variant}
        onClick={() => {
          if (mode === 'runtime' && config.linkType === 'menu' && config.menuSlug) onNavigate?.(config.menuSlug)
        }}
      >
        {config.label || 'Button'}
      </Button>
    </div>
  )
}

export type ButtonLinkType = 'menu' | 'external'
export type ButtonVariant = 'primary' | 'secondary' | 'outline'

export interface ButtonWidgetConfig {
  label: string
  linkType: ButtonLinkType
  menuSlug?: string
  url?: string
  variant: ButtonVariant
}

const VALID_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'outline']

export function parseButtonConfig(raw: unknown): ButtonWidgetConfig {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<ButtonWidgetConfig>
    if (typeof r.label === 'string') {
      return {
        label: r.label,
        linkType: r.linkType === 'menu' ? 'menu' : 'external',
        menuSlug: typeof r.menuSlug === 'string' ? r.menuSlug : undefined,
        url: typeof r.url === 'string' ? r.url : undefined,
        variant: r.variant && VALID_VARIANTS.includes(r.variant) ? r.variant : 'primary',
      }
    }
  }
  return createDefaultButtonConfig()
}

export function createDefaultButtonConfig(): ButtonWidgetConfig {
  return { label: 'Button', linkType: 'external', variant: 'primary' }
}

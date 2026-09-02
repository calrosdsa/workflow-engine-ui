import type { ConfigSchema } from '@/lib/config-schema'

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

export const BUTTON_CONFIG_SCHEMA: ConfigSchema = {
  type: 'object',
  description: 'A single call-to-action button.',
  required: ['label', 'linkType'],
  properties: {
    label: { type: 'string' },
    linkType: { type: 'string', enum: ['menu', 'external'], description: "Where it goes: another menu in this app, or an external URL." },
    menuSlug: { type: 'string', description: "Target menu's slug. Required when linkType is 'menu'." },
    url: { type: 'string', description: "External URL. Required when linkType is 'external'." },
    variant: { type: 'string', enum: ['primary', 'secondary', 'outline'], description: 'Visual style. Default primary.' },
  },
}

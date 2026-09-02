import type { ConfigSchema } from '@/lib/config-schema'

export type ImageWidth = 'full' | 'half' | 'third' | 'auto'

export interface ImageWidgetConfig {
  src: string
  alt: string
  width: ImageWidth
}

const VALID_WIDTHS: ImageWidth[] = ['full', 'half', 'third', 'auto']

export function parseImageConfig(raw: unknown): ImageWidgetConfig {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<ImageWidgetConfig>
    if (typeof r.src === 'string') {
      return {
        src: r.src,
        alt: typeof r.alt === 'string' ? r.alt : '',
        width: r.width && VALID_WIDTHS.includes(r.width) ? r.width : 'full',
      }
    }
  }
  return createDefaultImageConfig()
}

export function createDefaultImageConfig(): ImageWidgetConfig {
  return { src: '', alt: '', width: 'full' }
}

export const IMAGE_CONFIG_SCHEMA: ConfigSchema = {
  type: 'object',
  description: 'An image shown from a URL.',
  required: ['src'],
  properties: {
    src: { type: 'string', description: 'Image URL.' },
    alt: { type: 'string', description: 'Alt text for accessibility.' },
    width: { type: 'string', enum: ['full', 'half', 'third', 'auto'], description: 'Rendered width within the tile. Default full.' },
  },
}

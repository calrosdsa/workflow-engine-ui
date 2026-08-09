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

import type { ConfigSchema } from '@/lib/config-schema'

export interface HeadingWidgetConfig {
  text: string
  level: 1 | 2 | 3
}

export function parseHeadingConfig(raw: unknown): HeadingWidgetConfig {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<HeadingWidgetConfig>
    if (typeof r.text === 'string') {
      return { text: r.text, level: r.level === 1 || r.level === 3 ? r.level : 2 }
    }
  }
  return createDefaultHeadingConfig()
}

export function createDefaultHeadingConfig(): HeadingWidgetConfig {
  return { text: 'Heading', level: 2 }
}

export const HEADING_CONFIG_SCHEMA: ConfigSchema = {
  type: 'object',
  description: 'A section heading.',
  required: ['text'],
  properties: {
    text: { type: 'string' },
    level: { type: 'integer', enum: [1, 2, 3], description: 'Heading size, 1 largest. Default 2.' },
  },
}

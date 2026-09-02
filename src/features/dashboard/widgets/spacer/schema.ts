import type { ConfigSchema } from '@/lib/config-schema'

export interface SpacerWidgetConfig {
  height: number
}

export function parseSpacerConfig(raw: unknown): SpacerWidgetConfig {
  if (raw && typeof raw === 'object' && typeof (raw as Partial<SpacerWidgetConfig>).height === 'number') {
    return { height: (raw as SpacerWidgetConfig).height }
  }
  return createDefaultSpacerConfig()
}

export function createDefaultSpacerConfig(): SpacerWidgetConfig {
  return { height: 24 }
}

export const SPACER_CONFIG_SCHEMA: ConfigSchema = {
  type: 'object',
  description: 'Vertical empty space.',
  required: ['height'],
  properties: { height: { type: 'integer', description: 'Height in pixels. Default 24.' } },
}

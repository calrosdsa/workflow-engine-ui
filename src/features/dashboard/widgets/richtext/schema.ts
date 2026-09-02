import type { ConfigSchema } from '@/lib/config-schema'

export interface RichTextWidgetConfig {
  markdown: string
}

export function parseRichTextConfig(raw: unknown): RichTextWidgetConfig {
  if (raw && typeof raw === 'object' && typeof (raw as Partial<RichTextWidgetConfig>).markdown === 'string') {
    return { markdown: (raw as RichTextWidgetConfig).markdown }
  }
  return createDefaultRichTextConfig()
}

export function createDefaultRichTextConfig(): RichTextWidgetConfig {
  return { markdown: '## Heading\n\nWrite **Markdown** here — headings, lists, links, and emphasis are all supported.' }
}

export const RICHTEXT_CONFIG_SCHEMA: ConfigSchema = {
  type: 'object',
  description: 'A formatted text block authored as Markdown.',
  required: ['markdown'],
  properties: { markdown: { type: 'string', description: 'Markdown source — headings, lists, links, emphasis.' } },
}

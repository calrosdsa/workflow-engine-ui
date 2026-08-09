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

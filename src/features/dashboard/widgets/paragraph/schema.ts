export interface ParagraphWidgetConfig {
  text: string
}

export function parseParagraphConfig(raw: unknown): ParagraphWidgetConfig {
  if (raw && typeof raw === 'object' && typeof (raw as Partial<ParagraphWidgetConfig>).text === 'string') {
    return { text: (raw as ParagraphWidgetConfig).text }
  }
  return createDefaultParagraphConfig()
}

export function createDefaultParagraphConfig(): ParagraphWidgetConfig {
  return { text: 'Paragraph text. Use this for descriptions or instructions.' }
}

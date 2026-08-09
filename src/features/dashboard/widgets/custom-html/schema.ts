export type CustomHtmlMode = 'inline' | 'sandbox'

export interface CustomHtmlWidgetConfig {
  mode: CustomHtmlMode
  html: string
}

const VALID_MODES: CustomHtmlMode[] = ['inline', 'sandbox']

export function parseCustomHtmlConfig(raw: unknown): CustomHtmlWidgetConfig {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<CustomHtmlWidgetConfig>
    if (typeof r.html === 'string') {
      return { mode: r.mode && VALID_MODES.includes(r.mode) ? r.mode : 'inline', html: r.html }
    }
  }
  return createDefaultCustomHtmlConfig()
}

export function createDefaultCustomHtmlConfig(): CustomHtmlWidgetConfig {
  return { mode: 'inline', html: '' }
}

// Mirrors internal/reports.TextBlockConfig (Go, block_text.go) exactly.
export type TextHeadingLevel = 'h1' | 'h2' | 'h3' | 'paragraph'

export interface TextBlockConfig {
  text: string
  level?: TextHeadingLevel
}

export function emptyTextBlockConfig(): TextBlockConfig {
  return { text: '', level: 'paragraph' }
}

/** Defensive parse — never throws, heals a malformed/stale blob. */
export function parseTextBlockConfig(raw: unknown): TextBlockConfig {
  const empty = emptyTextBlockConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  const level = r.level
  return {
    text: typeof r.text === 'string' ? r.text : empty.text,
    level: level === 'h1' || level === 'h2' || level === 'h3' || level === 'paragraph' ? level : empty.level,
  }
}

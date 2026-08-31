import type { CSSProperties } from 'react'
import type { BlockStyle } from './types'

// Keeps the builder preview honest about the formatting that will be sent to
// the report engine. This maps only the current version-1 BlockStyle; richer
// header/body/column style rules belong to the workbook definition that will
// replace the block canvas.
export function reportBlockPreviewStyle(style?: BlockStyle): CSSProperties {
  if (!style) return {}

  const preview: CSSProperties = {}
  if (style.bold !== undefined) preview.fontWeight = style.bold ? 700 : 400
  if (style.italic !== undefined) preview.fontStyle = style.italic ? 'italic' : 'normal'
  if (style.align) preview.textAlign = style.align
  if (style.text_color) preview.color = style.text_color
  if (style.fill_color) preview.backgroundColor = style.fill_color

  if (style.border) {
    preview.borderStyle = 'solid'
    if (style.border.width !== undefined) preview.borderWidth = style.border.width
    if (style.border.color) preview.borderColor = style.border.color
  }

  if (style.padding) {
    const { top = 0, right = 0, bottom = 0, left = 0 } = style.padding
    preview.padding = `${top}px ${right}px ${bottom}px ${left}px`
  }

  return preview
}

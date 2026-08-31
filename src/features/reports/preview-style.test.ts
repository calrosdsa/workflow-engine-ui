import { describe, expect, it } from 'vitest'
import { reportBlockPreviewStyle } from './preview-style'

describe('reportBlockPreviewStyle', () => {
  it('translates saved report formatting into preview-safe CSS properties', () => {
    expect(reportBlockPreviewStyle({
      bold: true,
      italic: true,
      align: 'right',
      text_color: '#0f172a',
      fill_color: '#e0f2fe',
      border: { width: 2, color: '#0284c7' },
      padding: { top: 2, right: 4, bottom: 6, left: 8 },
    })).toEqual({
      fontWeight: 700,
      fontStyle: 'italic',
      textAlign: 'right',
      color: '#0f172a',
      backgroundColor: '#e0f2fe',
      borderStyle: 'solid',
      borderWidth: 2,
      borderColor: '#0284c7',
      padding: '2px 4px 6px 8px',
    })
  })

  it('preserves explicit formatting switches while leaving inherited values untouched', () => {
    expect(reportBlockPreviewStyle({ bold: false, italic: false })).toEqual({
      fontWeight: 400,
      fontStyle: 'normal',
    })
    expect(reportBlockPreviewStyle(undefined)).toEqual({})
  })
})

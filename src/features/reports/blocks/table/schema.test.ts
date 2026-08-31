import { describe, expect, it } from 'vitest'
import { parseTableBlockConfig } from './schema'

describe('parseTableBlockConfig', () => {
  it('preserves independent header and body formatting rules', () => {
    expect(parseTableBlockConfig({
      form_id: 'sales',
      style: {
        header: { bold: false, fill_color: '#1D4ED8', text_color: '#FFFFFF', align: 'center' },
        body: { bold: true, fill_color: '#DBEAFE', text_color: '#0F172A', align: 'right' },
      },
    })).toMatchObject({
      form_id: 'sales',
      style: {
        header: { bold: false, fill_color: '#1D4ED8', text_color: '#FFFFFF', align: 'center' },
        body: { bold: true, fill_color: '#DBEAFE', text_color: '#0F172A', align: 'right' },
      },
    })
  })
})

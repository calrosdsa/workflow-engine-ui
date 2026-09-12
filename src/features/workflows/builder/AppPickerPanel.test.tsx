// @vitest-environment jsdom
// Rendered against the same live-captured taxonomy fixture
// NodePickerModal.test.tsx uses (a verbatim GET /meta/node-taxonomy
// response with the real whatsapp/slack/examples packages loaded), so this
// test is about the panel's own behavior, not about hand-shaping a fixture
// to fit the code.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { AppPickerPanel, type PickerSelection } from './AppPickerPanel'
import taxonomy from './__fixtures__/live-node-taxonomy.json'

vi.mock('./node-taxonomy', async () => {
  const actual = await vi.importActual<typeof import('./node-taxonomy')>('./node-taxonomy')
  return { ...actual, useNodeTaxonomy: () => ({ data: taxonomy }) }
})

afterEach(cleanup)

function open(scope: 'triggers-only' | 'triggers-and-actions', onSelect: (s: PickerSelection) => void = () => {}) {
  render(
    <I18nProvider>
      <AppPickerPanel scope={scope} onSelect={onSelect} />
    </I18nProvider>,
  )
}

describe('AppPickerPanel — app list', () => {
  it('lists every loaded app, in triggers-and-actions scope', () => {
    open('triggers-and-actions')
    expect(screen.getByText('WhatsApp')).toBeTruthy()
    expect(screen.getByText('Slack')).toBeTruthy()
    expect(screen.getByText('Examples')).toBeTruthy()
  })

  it('filters to apps with at least one trigger, in triggers-only scope', () => {
    // Slack and Examples have zero trigger presets in the real committed
    // packages — only WhatsApp declares one (whatsapp_on_message).
    open('triggers-only')
    expect(screen.getByText('WhatsApp')).toBeTruthy()
    expect(screen.queryByText('Slack')).toBeNull()
    expect(screen.queryByText('Examples')).toBeNull()
  })

  it('narrows the app list by search', () => {
    open('triggers-and-actions')
    fireEvent.change(screen.getByPlaceholderText('Search apps…'), { target: { value: 'whatsapp' } })
    expect(screen.getByText('WhatsApp')).toBeTruthy()
    expect(screen.queryByText('Slack')).toBeNull()
  })
})

describe('AppPickerPanel — app detail', () => {
  it('shows WhatsApp\'s real Triggers(1)/Actions(1) split', () => {
    open('triggers-and-actions')
    fireEvent.click(screen.getByText('WhatsApp'))
    expect(screen.getByText('Triggers (1)')).toBeTruthy()
    expect(screen.getByText('WhatsApp — On Message')).toBeTruthy()
    expect(screen.getByText('Actions (1)')).toBeTruthy()
    expect(screen.getByText('WhatsApp — Send Template Message')).toBeTruthy()
  })

  it('hides the Actions section in triggers-only scope', () => {
    open('triggers-only')
    fireEvent.click(screen.getByText('WhatsApp'))
    expect(screen.getByText('Triggers (1)')).toBeTruthy()
    expect(screen.queryByText(/Actions \(/)).toBeNull()
    expect(screen.queryByText('WhatsApp — Send Template Message')).toBeNull()
  })

  it('reports a trigger_preset selection with the full preset object', () => {
    const onSelect = vi.fn()
    open('triggers-and-actions', onSelect)
    fireEvent.click(screen.getByText('WhatsApp'))
    fireEvent.click(screen.getByText('WhatsApp — On Message'))
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'trigger_preset',
      preset: expect.objectContaining({ name: 'whatsapp_on_message', provider: 'meta', package: 'whatsapp' }),
    })
  })

  it('reports a node selection with its type', () => {
    const onSelect = vi.fn()
    open('triggers-and-actions', onSelect)
    fireEvent.click(screen.getByText('WhatsApp'))
    fireEvent.click(screen.getByText('WhatsApp — Send Template Message'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'node', type: 'whatsapp_send' })
  })

  it('returns to the app list via the back button', () => {
    open('triggers-and-actions')
    fireEvent.click(screen.getByText('WhatsApp'))
    expect(screen.getByText('Triggers (1)')).toBeTruthy()
    fireEvent.click(screen.getByTitle('Back'))
    expect(screen.getByText('Slack')).toBeTruthy()
  })
})

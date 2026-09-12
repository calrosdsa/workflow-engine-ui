// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { TriggerTypePicker } from './TriggerTypePicker'
import taxonomy from './__fixtures__/live-node-taxonomy.json'

vi.mock('./node-taxonomy', async () => {
  const actual = await vi.importActual<typeof import('./node-taxonomy')>('./node-taxonomy')
  return { ...actual, useNodeTaxonomy: () => ({ data: taxonomy }) }
})

afterEach(cleanup)

function open(opts: { activeMode?: 'on_demand' | 'scheduled' | 'webhook'; onPickMode?: (m: any) => void; onPickPreset?: (p: any) => void } = {}) {
  render(
    <I18nProvider>
      <TriggerTypePicker
        activeMode={opts.activeMode}
        onPickMode={opts.onPickMode ?? (() => {})}
        onPickPreset={opts.onPickPreset ?? (() => {})}
      />
    </I18nProvider>,
  )
}

describe('TriggerTypePicker', () => {
  it('renders every TRIGGER_MODES tile plus On App Event', () => {
    open()
    expect(screen.getByText('On App Event')).toBeTruthy()
    expect(screen.getByText('On Demand')).toBeTruthy()
    expect(screen.getByText('On Webhook Call')).toBeTruthy()
    expect(screen.getByText('Error Trigger')).toBeTruthy()
  })

  it('picking a mode tile calls onPickMode with that mode', () => {
    const onPickMode = vi.fn()
    open({ onPickMode })
    fireEvent.click(screen.getByText('Scheduled'))
    expect(onPickMode).toHaveBeenCalledWith('scheduled')
  })

  it('highlights the active mode when activeMode is set', () => {
    open({ activeMode: 'scheduled' })
    const tile = screen.getByText('Scheduled').closest('button')!
    expect(tile.className).toContain('success')
  })

  it('does not highlight anything when activeMode is unset (onboarding case)', () => {
    open()
    const tile = screen.getByText('Scheduled').closest('button')!
    expect(tile.className).not.toContain('success')
  })

  it('On App Event drills into the app picker, with its own back button', () => {
    open()
    fireEvent.click(screen.getByText('On App Event'))
    expect(screen.getByPlaceholderText('Search apps…')).toBeTruthy()
    expect(screen.getByText('WhatsApp')).toBeTruthy()
    // Slack has no trigger presets in the real committed packages.
    expect(screen.queryByText('Slack')).toBeNull()

    fireEvent.click(screen.getByTitle('Back'))
    expect(screen.getByText('On Demand')).toBeTruthy()
  })

  it('picking a trigger preset calls onPickPreset with the full preset object', () => {
    const onPickPreset = vi.fn()
    open({ onPickPreset })
    fireEvent.click(screen.getByText('On App Event'))
    fireEvent.click(screen.getByText('WhatsApp'))
    fireEvent.click(screen.getByText('WhatsApp — On Message'))
    expect(onPickPreset).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'whatsapp_on_message', provider: 'meta' }),
    )
  })
})

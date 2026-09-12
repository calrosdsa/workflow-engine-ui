// @vitest-environment jsdom
//
// Covers the fix for a real UX gap: opening an already-configured trigger
// used to re-show the full "pick a trigger type" list every time, at the
// top of the panel, above that trigger's own fields — never landing
// directly on the specific trigger's own Parameters the way every other
// node type (and n8n's own WhatsApp Trigger node) does. TriggerForm now
// shows a compact summary + "Change" affordance instead, and only reveals
// TriggerTypePicker while actively changing.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { TriggerForm, normaliseTriggerConfig } from './TriggerForm'
import type { TriggerPresetInfo } from '../node-taxonomy'
import taxonomy from '../__fixtures__/live-node-taxonomy.json'

vi.mock('../node-taxonomy', async () => {
  const actual = await vi.importActual<typeof import('../node-taxonomy')>('../node-taxonomy')
  return { ...actual, useNodeTaxonomy: () => ({ data: taxonomy }) }
})

afterEach(cleanup)

const whatsappPreset: TriggerPresetInfo = {
  name: 'whatsapp_on_message',
  display_name: 'WhatsApp — On Message',
  provider: 'meta',
  default_events: ['messages'],
  package: 'whatsapp',
}

function renderForm(configOverrides: Partial<ReturnType<typeof normaliseTriggerConfig>> = {}, onChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const config = normaliseTriggerConfig(configOverrides)
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <TriggerForm config={config} variables={[]} onChange={onChange} triggerPresets={[whatsappPreset]} />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return { onChange }
}

describe('TriggerForm — trigger type summary', () => {
  it('shows the current plain mode\'s label, not the full picker, by default', () => {
    renderForm({ mode: 'scheduled' })
    expect(screen.getByText('Scheduled')).toBeTruthy()
    // The picker's own tile list must not be present until "Change" is clicked.
    expect(screen.queryByText('On App Event')).toBeNull()
    expect(screen.queryByText('Error Trigger')).toBeNull()
  })

  it('shows the active preset\'s display_name when one is applied, not the flat "On Webhook Call" label', () => {
    renderForm({ mode: 'webhook', webhook_provider: 'meta', webhook_preset: 'whatsapp_on_message' })
    expect(screen.getByText('WhatsApp — On Message')).toBeTruthy()
    expect(screen.queryByText('On Webhook Call')).toBeNull()
  })

  it('falls back to the plain "On Webhook Call" label when webhook_preset does not resolve against the served presets', () => {
    renderForm({ mode: 'webhook', webhook_preset: 'some_removed_preset' })
    expect(screen.getByText('On Webhook Call')).toBeTruthy()
  })

  it('clicking Change reveals TriggerTypePicker inline, with the current mode highlighted', () => {
    renderForm({ mode: 'scheduled' })
    fireEvent.click(screen.getByText('Change'))
    expect(screen.getByText('On App Event')).toBeTruthy()
    expect(screen.getByText('Error Trigger')).toBeTruthy()
    const scheduledTile = screen.getByText('Scheduled').closest('button')!
    expect(scheduledTile.className).toContain('success')
  })

  it('picking a new plain mode applies it via setMode (preserving its stale-field-clear behavior) and closes the picker', () => {
    const { onChange } = renderForm({ mode: 'scheduled', cron: '0 9 * * *' })
    fireEvent.click(screen.getByText('Change'))
    fireEvent.click(screen.getByText('Before Write'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'before', source_form_id: '' }))
    // Closed back to the summary view — the picker's tiles are gone again.
    expect(screen.queryByText('Error Trigger')).toBeNull()
  })

  it('picking a trigger preset from On App Event applies the correct patch and closes the picker', () => {
    const { onChange } = renderForm({ mode: 'on_demand', enabled: true })
    fireEvent.click(screen.getByText('Change'))
    fireEvent.click(screen.getByText('On App Event'))
    fireEvent.click(screen.getByText('WhatsApp'))
    fireEvent.click(screen.getByText('WhatsApp — On Message'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'webhook', webhook_provider: 'meta', webhook_events: ['messages'], webhook_preset: 'whatsapp_on_message',
      enabled: true, // preserved, not wiped by the preset patch
    }))
  })

  it('cancelling out of the change view leaves the config untouched', () => {
    const { onChange } = renderForm({ mode: 'scheduled' })
    fireEvent.click(screen.getByText('Change'))
    fireEvent.click(screen.getByTitle('Cancel'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Scheduled')).toBeTruthy()
    expect(screen.queryByText('Error Trigger')).toBeNull()
  })
})

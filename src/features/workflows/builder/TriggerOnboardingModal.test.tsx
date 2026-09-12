// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { TriggerOnboardingModal } from './TriggerOnboardingModal'
import { useBuilderStore } from './store'
import taxonomy from './__fixtures__/live-node-taxonomy.json'

vi.mock('./node-taxonomy', async () => {
  const actual = await vi.importActual<typeof import('./node-taxonomy')>('./node-taxonomy')
  return { ...actual, useNodeTaxonomy: () => ({ data: taxonomy }) }
})

// seedNew() leaves the canvas genuinely empty — this modal's own choices
// are what create the singleton Trigger node, which these tests verify.
function seed() {
  useBuilderStore.getState().seedNew()
}

function triggerConfig() {
  return useBuilderStore.getState().nodes.find((n) => n.data.type === 'trigger')?.data.configuration as
    { mode?: string; webhook_preset?: string } | undefined
}

function open(onClose: () => void = () => {}) {
  render(
    <I18nProvider>
      <TriggerOnboardingModal onClose={onClose} />
    </I18nProvider>,
  )
}

beforeEach(seed)
afterEach(cleanup)

describe('TriggerOnboardingModal', () => {
  it('a freshly seeded workflow has no nodes yet — this modal is what creates the trigger', () => {
    expect(useBuilderStore.getState().nodes).toHaveLength(0)
  })

  it('renders every TRIGGER_MODES tile plus On App Event', () => {
    open()
    expect(screen.getByText('On App Event')).toBeTruthy()
    expect(screen.getByText('On Demand')).toBeTruthy()
    expect(screen.getByText('Scheduled')).toBeTruthy()
    expect(screen.getByText('On Webhook Call')).toBeTruthy()
    expect(screen.getByText('Error Trigger')).toBeTruthy()
  })

  it('picking a plain mode creates the trigger node on the (still empty) canvas and closes', () => {
    const onClose = vi.fn()
    expect(useBuilderStore.getState().nodes).toHaveLength(0)
    open(onClose)
    fireEvent.click(screen.getByText('Scheduled'))
    expect(triggerConfig()?.mode).toBe('scheduled')
    expect(useBuilderStore.getState().nodes).toHaveLength(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('picking On App Event swaps to the app picker', () => {
    open()
    fireEvent.click(screen.getByText('On App Event'))
    expect(screen.getByPlaceholderText('Search apps…')).toBeTruthy()
    expect(screen.getByText('WhatsApp')).toBeTruthy()
    // triggers-only scope: Slack has no trigger presets in the real
    // committed packages.
    expect(screen.queryByText('Slack')).toBeNull()
  })

  it('picking a trigger preset there applies it and closes, same as NodePickerModal\'s Apps tab', () => {
    const onClose = vi.fn()
    open(onClose)
    fireEvent.click(screen.getByText('On App Event'))
    fireEvent.click(screen.getByText('WhatsApp'))
    fireEvent.click(screen.getByText('WhatsApp — On Message'))
    const cfg = triggerConfig()
    expect(cfg?.mode).toBe('webhook')
    expect(cfg?.webhook_preset).toBe('whatsapp_on_message')
    expect(onClose).toHaveBeenCalled()
  })

  it('the close button still creates a default on_demand trigger, so the canvas is never left permanently empty', () => {
    const onClose = vi.fn()
    open(onClose)
    expect(triggerConfig()).toBeUndefined()
    fireEvent.click(screen.getByTitle('Close'))
    expect(triggerConfig()?.mode).toBe('on_demand')
    expect(useBuilderStore.getState().nodes).toHaveLength(1)
    expect(onClose).toHaveBeenCalled()
  })
})

import { describe, it, expect } from 'vitest'
import { findTriggerNode, applyTriggerPresetPatch, applyTriggerModePatch } from './trigger-preset-apply'
import type { TriggerPresetInfo } from './node-taxonomy'
import type { FlowNode } from './store'

const preset: TriggerPresetInfo = {
  name: 'whatsapp_on_message',
  display_name: 'WhatsApp — On Message',
  provider: 'meta',
  default_events: ['messages'],
  package: 'whatsapp',
}

describe('findTriggerNode', () => {
  it('finds the one trigger-typed node in a normal seed graph', () => {
    const nodes = [
      { id: 't1', data: { type: 'trigger' } },
      { id: 'e1', data: { type: 'exit' } },
    ] as unknown as FlowNode[]
    expect(findTriggerNode(nodes)?.id).toBe('t1')
  })

  it('returns undefined when no trigger-typed node exists', () => {
    const nodes = [{ id: 'e1', data: { type: 'exit' } }] as unknown as FlowNode[]
    expect(findTriggerNode(nodes)).toBeUndefined()
  })
})

describe('applyTriggerPresetPatch', () => {
  it('sets webhook mode, provider, events, and preset from the preset', () => {
    const patch = applyTriggerPresetPatch({ mode: 'on_demand', enabled: true }, preset)
    expect(patch.mode).toBe('webhook')
    expect(patch.webhook_provider).toBe('meta')
    expect(patch.webhook_events).toEqual(['messages'])
    expect(patch.webhook_preset).toBe('whatsapp_on_message')
  })

  it('always sets mode to webhook, even starting from a non-webhook mode', () => {
    // The trap this pins: a freshly-seeded trigger defaults to on_demand,
    // not webhook — TriggerForm.tsx's own in-panel applyPreset can skip
    // this because it only renders once mode is already 'webhook'; this
    // entry point has no such guarantee.
    const patch = applyTriggerPresetPatch({ mode: 'scheduled', cron: '0 9 * * *' }, preset)
    expect(patch.mode).toBe('webhook')
  })

  it('preserves fields the preset does not touch — the wholesale-replace trap', () => {
    // updateNodeConfig replaces `configuration` wholesale, not merges — a
    // patch missing webhook_token/enabled/description would silently
    // destroy a server-minted token on the very next save.
    const current = {
      mode: 'webhook', webhook_token: 'already-minted-token',
      enabled: true, description: 'my note',
    }
    const patch = applyTriggerPresetPatch(current, preset)
    expect(patch.webhook_token).toBe('already-minted-token')
    expect(patch.enabled).toBe(true)
    expect(patch.description).toBe('my note')
  })

  it('defaults default_events to an empty array when the preset has none', () => {
    const noEvents: TriggerPresetInfo = { name: 'p', display_name: 'd', provider: 'generic' }
    const patch = applyTriggerPresetPatch({ mode: 'on_demand' }, noEvents)
    expect(patch.webhook_events).toEqual([])
  })
})

describe('applyTriggerModePatch', () => {
  it('sets only mode, preserving everything else already on the trigger', () => {
    const current = { mode: 'on_demand', enabled: false, description: 'kept' }
    const patch = applyTriggerModePatch(current, 'scheduled')
    expect(patch.mode).toBe('scheduled')
    expect(patch.enabled).toBe(false)
    expect(patch.description).toBe('kept')
  })
})

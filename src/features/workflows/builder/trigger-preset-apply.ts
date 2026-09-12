// Centralizes the one correct way to reconfigure the workflow's singleton
// Trigger node from an entry point OTHER than the node's own already-open
// config panel — the new app-grouped picker (NodePickerModal's "Apps" tab)
// and the new blank-canvas onboarding modal both need this, and both must
// produce the exact same patch shape TriggerForm.tsx's own in-panel
// "Quick Setup" applyPreset already does, or the two paths would silently
// diverge.
//
// The one thing every caller here must get right and is easy to miss:
// store.ts's updateNodeConfig(nodeId, config) REPLACES a node's
// `configuration` wholesale, it does not merge. A patch built from only the
// fields a preset/mode cares about would silently destroy whatever else was
// already on the trigger — most dangerously its server-minted
// webhook_token (see TriggerConfig.webhook_token's own doc comment: minted
// once, must stay stable across saves) — so every function below starts
// from normaliseTriggerConfig(current), never from an empty object.
import type { FlowNode } from './store'
import type { TriggerConfig, TriggerMode } from '../types'
import type { TriggerPresetInfo } from './node-taxonomy'
import { normaliseTriggerConfig } from './node-forms/TriggerForm'

/** The workflow's one singleton Trigger node, if present. Every workflow
 *  this feature touches has exactly one (seedNew() always creates trigger +
 *  exit) — see internal/graph/lint.go's own "exactly one trigger" rule,
 *  which this frontend never tries to route around. */
export function findTriggerNode(nodes: FlowNode[]): FlowNode | undefined {
  return nodes.find((n) => n.data.type === 'trigger')
}

/** Applies a package-declared trigger preset (e.g. WhatsApp's "On
 *  Message") to an existing trigger configuration — sets webhook mode,
 *  provider, and a starting event selection together, exactly as
 *  TriggerForm.tsx's own in-panel applyPreset does, while preserving
 *  everything else already on the trigger (webhook_token, enabled,
 *  description, ...). `mode: 'webhook'` is set explicitly here — unlike
 *  the in-panel version, which can omit it because it only ever renders
 *  once mode is already 'webhook', a freshly-seeded trigger defaults to
 *  'on_demand' and would otherwise stay stuck there. */
export function applyTriggerPresetPatch(current: unknown, preset: TriggerPresetInfo): TriggerConfig {
  return {
    ...normaliseTriggerConfig(current),
    mode: 'webhook',
    webhook_provider: preset.provider,
    webhook_events: preset.default_events ?? [],
    webhook_preset: preset.name,
  }
}

/** Sets a plain trigger mode (On Demand, Scheduled, ...) — the onboarding
 *  modal's non-app-event tiles. Preserves every other field already on the
 *  trigger, same reasoning as applyTriggerPresetPatch. */
export function applyTriggerModePatch(current: unknown, mode: TriggerMode): TriggerConfig {
  return { ...normaliseTriggerConfig(current), mode }
}

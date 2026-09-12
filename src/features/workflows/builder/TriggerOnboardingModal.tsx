// A brand-new workflow's blank-canvas "What triggers this workflow?"
// prompt — shown once, only for mode === 'new' (never on an existing,
// loaded workflow), gating the canvas's visible interactivity until the
// author picks a starting trigger. The canvas underneath is already fully
// seeded (WorkflowBuilderPage.tsx's seedNew() still runs unconditionally,
// exactly as before this modal existed) — this is purely a visual overlay,
// not a different graph-lifecycle path, which is what keeps it a small,
// additive change rather than a new "0 nodes" state to special-case
// throughout the canvas.
//
// The picker itself (mode tiles + "On App Event" → AppPickerPanel) is
// TriggerTypePicker — shared with TriggerForm.tsx's own "change trigger
// type" flow, so a trigger configured from either entry point behaves
// identically. This file only supplies the modal's own chrome (backdrop,
// title, close button) and wires the picker's two callbacks to the
// singleton Trigger node via the same trigger-preset-apply.ts helpers
// NodePickerModal's own "Apps" tab uses.
import { X } from 'lucide-react'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useBuilderStore } from './store'
import { TriggerTypePicker } from './TriggerTypePicker'
import { findTriggerNode, applyTriggerPresetPatch, applyTriggerModePatch } from './trigger-preset-apply'
import type { TriggerMode } from '../types'
import type { TriggerPresetInfo } from './node-taxonomy'

export interface TriggerOnboardingModalProps {
  onClose: () => void
}

export function TriggerOnboardingModal({ onClose }: TriggerOnboardingModalProps) {
  const t = useTranslation()
  const nodes = useBuilderStore((s) => s.nodes)
  const updateNodeConfig = useBuilderStore((s) => s.updateNodeConfig)
  const selectNode = useBuilderStore((s) => s.selectNode)

  // Lands the user in the (now pre-configured) Trigger node's own config
  // panel — selectNode already auto-opens it (store.ts) — then dismisses.
  // No canvas re-centering here: the seed graph's trigger node is already
  // what fitView centered on at mount, unlike NodePickerModal's "Apps" tab,
  // which can be opened from anywhere on an already-larger canvas.
  function finish(config: ReturnType<typeof applyTriggerModePatch>) {
    const trigger = findTriggerNode(nodes)
    if (trigger) {
      updateNodeConfig(trigger.id, config)
      selectNode(trigger.id)
    }
    onClose()
  }

  const handlePickMode = (mode: TriggerMode) =>
    finish(applyTriggerModePatch(findTriggerNode(nodes)?.data.configuration, mode))

  const handlePickPreset = (preset: TriggerPresetInfo) =>
    finish(applyTriggerPresetPatch(findTriggerNode(nodes)?.data.configuration, preset))

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[hsl(var(--background))]/70 backdrop-blur-sm">
      <div className="relative flex max-h-[80vh] w-[min(28rem,90vw)] flex-col overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl shadow-black/30">
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{t('workflows.onboarding.title')}</p>
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{t('workflows.onboarding.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            title={t('workflows.onboarding.close')}
          >
            <X size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <TriggerTypePicker onPickMode={handlePickMode} onPickPreset={handlePickPreset} />
        </div>
      </div>
    </div>
  )
}

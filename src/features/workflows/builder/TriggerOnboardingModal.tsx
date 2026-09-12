// A brand-new workflow's blank-canvas "What triggers this workflow?"
// prompt — shown once, only for mode === 'new' (never on an existing,
// loaded workflow), gating the canvas's visible interactivity until the
// author picks a starting trigger. The canvas underneath starts with zero
// nodes (WorkflowBuilderPage.tsx's seedNew() no longer auto-creates a
// Trigger or an End node) — this modal's own choice is what creates the
// singleton Trigger node, via store.ts's applyTriggerConfig, which also
// handles the (defensive-only) case where a trigger already exists.
//
// The picker itself (mode tiles + "On App Event" → AppPickerPanel) is
// TriggerTypePicker — shared with TriggerForm.tsx's own "change trigger
// type" flow, so a trigger configured from either entry point behaves
// identically. This file only supplies the modal's own chrome (backdrop,
// title, close button) and wires the picker's two callbacks to
// applyTriggerConfig via the same trigger-preset-apply.ts helpers
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
  const applyTriggerConfig = useBuilderStore((s) => s.applyTriggerConfig)

  // Creates (or, defensively, reconfigures) the singleton Trigger node —
  // applyTriggerConfig already selects it, which auto-opens its config
  // panel (store.ts) — then dismisses.
  function finish(config: ReturnType<typeof applyTriggerModePatch>) {
    applyTriggerConfig(config)
    onClose()
  }

  const handlePickMode = (mode: TriggerMode) =>
    finish(applyTriggerModePatch(findTriggerNode(nodes)?.data.configuration, mode))

  const handlePickPreset = (preset: TriggerPresetInfo) =>
    finish(applyTriggerPresetPatch(findTriggerNode(nodes)?.data.configuration, preset))

  // Closing without an explicit choice still needs to leave a real Trigger
  // node behind — the canvas starts with zero nodes now, so dismissing
  // here can't just leave it empty: there would be no node or edge left
  // for the canvas's own "add a step" affordances to attach to.
  // Defaulting to on_demand mirrors n8n's own "trigger manually" outcome,
  // and is exactly what the old auto-seeded trigger defaulted to before
  // this modal existed.
  const handleClose = () => handlePickMode('on_demand')

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
            onClick={handleClose}
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

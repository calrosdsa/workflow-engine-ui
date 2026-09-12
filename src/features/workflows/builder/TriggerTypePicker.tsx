// The "which kind of trigger is this?" picker — one per TRIGGER_MODES tile
// plus a synthetic "On App Event" tile that drills into AppPickerPanel
// (scope="triggers-only"). Presentation-only, no store access: the two
// current call sites need this shown in very different chrome —
// TriggerOnboardingModal wraps it in a full blank-canvas modal (a brand-new
// workflow's first-run prompt), TriggerForm wraps it inline inside the
// Trigger node's own config panel (the "change trigger type" flow, so an
// already-configured trigger's Parameters tab shows that trigger's OWN
// fields directly — see TriggerForm.tsx's own comment on why — rather than
// re-showing this picker every time the node is opened, the way it used to).
//
// Self-contained back-navigation: AppPickerPanel's own back button only
// returns from its app-DETAIL screen to its app-LIST screen: going back
// further, from the app-list screen to THIS component's mode-tile screen,
// is a level AppPickerPanel has no opinion about, so this component renders
// its own single back row for exactly that hop.
import { useState } from 'react'
import { ChevronLeft, Zap as AppEventIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { TRIGGER_MODES } from './trigger-modes'
import { AppPickerPanel, type PickerSelection } from './AppPickerPanel'
import type { TriggerMode } from '../types'
import type { TriggerPresetInfo } from './node-taxonomy'

export interface TriggerTypePickerProps {
  /** Highlights the current mode's tile — set by TriggerForm's "change
   *  trigger type" flow so the author can see what they're changing FROM.
   *  Left undefined for the onboarding modal, which always starts blank
   *  (a brand-new trigger has no "current" choice to highlight yet). */
  activeMode?: TriggerMode
  onPickMode: (mode: TriggerMode) => void
  onPickPreset: (preset: TriggerPresetInfo) => void
}

export function TriggerTypePicker({ activeMode, onPickMode, onPickPreset }: TriggerTypePickerProps) {
  const t = useTranslation()
  const [showAppPicker, setShowAppPicker] = useState(false)

  function handleAppPickerSelect(selection: PickerSelection) {
    // scope="triggers-only" never renders an Actions section below, so a
    // {kind:'node'} selection is structurally unreachable here — this
    // branch exists only so the callback stays a total function.
    if (selection.kind === 'trigger_preset') onPickPreset(selection.preset)
  }

  if (showAppPicker) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 pb-2">
          <button
            type="button"
            onClick={() => setShowAppPicker(false)}
            className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            title={t('workflows.app_picker.back')}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {t('workflows.onboarding.on_app_event.label')}
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <AppPickerPanel scope="triggers-only" onSelect={handleAppPickerSelect} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setShowAppPicker(true)}
        className="flex w-full items-start gap-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5 text-left transition-colors hover:border-[hsl(var(--muted-foreground))]/40"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
          <AppEventIcon size={14} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[hsl(var(--foreground))]">{t('workflows.onboarding.on_app_event.label')}</p>
          <p className="text-[10px] leading-snug text-[hsl(var(--muted-foreground))]">{t('workflows.onboarding.on_app_event.description')}</p>
        </div>
      </button>
      {TRIGGER_MODES.map((m) => {
        const Icon = m.icon
        const active = activeMode === m.value
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onPickMode(m.value)}
            className={cn(
              'flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
              active ? 'border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/10' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--muted-foreground))]/40',
            )}
          >
            <div className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
              active ? 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
            )}>
              <Icon size={14} />
            </div>
            <div className="min-w-0">
              <p className={cn('text-[12px] font-semibold', active ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--foreground))]')}>{t(m.labelKey)}</p>
              <p className="text-[10px] leading-snug text-[hsl(var(--muted-foreground))]">{t(m.descriptionKey)}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

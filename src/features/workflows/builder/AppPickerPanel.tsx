// A shared, two-screen "pick an app, then one of its triggers/actions"
// panel — the n8n-style browsing pattern reused by two different entry
// points: TriggerOnboardingModal.tsx's "On App Event" branch (a brand-new
// workflow's first-run trigger prompt) and NodePickerModal.tsx's "Apps" tab
// (the regular mid-workflow "+" add-step picker). Neither of those owns
// this component's own screens/state — they just render it with a
// different `scope` and a callback telling them what the user picked.
import { useState } from 'react'
import { Search, ChevronLeft, Plug, Webhook } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { iconFor, iconForHint } from './icon-hints'
import {
  useNodeTaxonomy, groupNodesByApp, groupTriggerPresetsByApp, searchApps,
  type TriggerPresetInfo,
} from './node-taxonomy'

/** What the user picked — a discriminated union rather than two separate
 *  callback props, since both consumers already have to switch on this
 *  once it reaches store mutations (updateNodeConfig for a trigger preset,
 *  addConnectedNode/insertNodeOnEdge for a node type). */
export type PickerSelection =
  | { kind: 'node'; type: string }
  | { kind: 'trigger_preset'; preset: TriggerPresetInfo }

export interface AppPickerPanelProps {
  /** 'triggers-only' hides every app's Actions section and filters the app
   *  list down to apps that declare at least one trigger preset — the
   *  onboarding modal's "On App Event" branch, where picking an action
   *  makes no sense (there is nothing to add a node to yet). 'triggers-
   *  and-actions' shows both sections and every app — NodePickerModal's
   *  Apps tab. */
  scope: 'triggers-only' | 'triggers-and-actions'
  onSelect: (selection: PickerSelection) => void
}

export function AppPickerPanel({ scope, onSelect }: AppPickerPanelProps) {
  const t = useTranslation()
  const { data: taxonomy } = useNodeTaxonomy()
  const [query, setQuery] = useState('')
  const [openApp, setOpenApp] = useState<string | null>(null)

  const apps = taxonomy?.apps ?? []
  const nodesByApp = groupNodesByApp(taxonomy?.nodes ?? [])
  const presetsByApp = groupTriggerPresetsByApp(taxonomy?.trigger_presets ?? [])

  const visibleApps = scope === 'triggers-only'
    ? apps.filter((a) => (presetsByApp.get(a.name)?.length ?? 0) > 0)
    : apps
  const matchedApps = searchApps(visibleApps, query)

  const detail = openApp ? apps.find((a) => a.name === openApp) : undefined

  if (detail) {
    const triggers = presetsByApp.get(detail.name) ?? []
    const actions = scope === 'triggers-and-actions' ? (nodesByApp.get(detail.name) ?? []) : []
    const AppIcon = iconForHint(detail.icon_hint) ?? Plug
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-5 py-3">
          <button
            type="button"
            onClick={() => setOpenApp(null)}
            className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            title={t('workflows.app_picker.back')}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--foreground))]/70 text-white">
            <AppIcon size={15} />
          </div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{detail.display_name}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {triggers.length > 0 && (
            <div className="mb-4 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                {t('workflows.app_picker.triggers_heading', { count: triggers.length })}
              </p>
              {triggers.map((preset) => {
                const PresetIcon = iconForHint(preset.icon_hint) ?? Webhook
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => onSelect({ kind: 'trigger_preset', preset })}
                    className="flex w-full items-start gap-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5 text-left transition-colors hover:border-[hsl(var(--muted-foreground))]/40 hover:bg-[hsl(var(--muted))]"
                  >
                    <PresetIcon size={15} className="mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[12px] font-semibold text-[hsl(var(--foreground))]">{preset.display_name}</span>
                      {preset.description && (
                        <span className="text-[10px] leading-snug text-[hsl(var(--muted-foreground))]">{preset.description}</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {scope === 'triggers-and-actions' && actions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                {t('workflows.app_picker.actions_heading', { count: actions.length })}
              </p>
              {actions.map((node) => {
                const NodeIcon = iconFor(node.type, node.icon_hint)
                return (
                  <button
                    key={node.type}
                    type="button"
                    onClick={() => onSelect({ kind: 'node', type: node.type })}
                    className="flex w-full items-start gap-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5 text-left transition-colors hover:border-[hsl(var(--muted-foreground))]/40 hover:bg-[hsl(var(--muted))]"
                  >
                    <NodeIcon size={15} className="mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[12px] font-semibold text-[hsl(var(--foreground))]">{node.display_name ?? node.type}</span>
                      {node.summary && (
                        <span className="text-[10px] leading-snug text-[hsl(var(--muted-foreground))]">{node.summary}</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {triggers.length === 0 && actions.length === 0 && (
            <p className="py-8 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
              {detail.display_name} has nothing to add here yet.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[hsl(var(--border))] px-5 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 focus-within:border-[hsl(var(--primary))] focus-within:ring-2 focus-within:ring-[hsl(var(--ring))]/30">
          <Search size={15} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('workflows.app_picker.search_placeholder')}
            className="h-9 flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {matchedApps.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Search size={24} className="text-[hsl(var(--muted-foreground))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {t('workflows.app_picker.no_matches', { query })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {matchedApps.map((app) => {
              const AppIcon = iconForHint(app.icon_hint) ?? Plug
              const triggerCount = presetsByApp.get(app.name)?.length ?? 0
              const actionCount = nodesByApp.get(app.name)?.length ?? 0
              const subtitle = [
                triggerCount > 0 ? `${triggerCount} trigger${triggerCount === 1 ? '' : 's'}` : null,
                scope === 'triggers-and-actions' && actionCount > 0 ? `${actionCount} action${actionCount === 1 ? '' : 's'}` : null,
              ].filter(Boolean).join(', ')
              return (
                <button
                  key={app.name}
                  type="button"
                  onClick={() => setOpenApp(app.name)}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-3 text-left',
                    'transition-[border-color,background-color,box-shadow,transform] hover:border-[hsl(var(--muted-foreground))]/40 hover:bg-[hsl(var(--muted))] hover:shadow-md hover:-translate-y-0.5',
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--foreground))]/70 text-white shadow-sm transition-transform group-hover:scale-105">
                    <AppIcon size={18} strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">{app.display_name}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">
                      {subtitle || app.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

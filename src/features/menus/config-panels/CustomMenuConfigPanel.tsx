import { useEffect } from 'react'
import { LayoutTemplate, Link2 } from 'lucide-react'
import { usePageBuilderStore } from '@/features/page-builder/store'
import { parsePageSchema } from '@/features/page-builder/serialize'
import { PageBuilderDnd } from '@/features/page-builder/canvas/PageBuilderDnd'
import { PageCanvas } from '@/features/page-builder/canvas/PageCanvas'
import { CompactToolbox } from '@/features/page-builder/CompactToolbox'
import { ComponentPropertiesPanel } from '@/features/page-builder/config/ComponentPropertiesPanel'
import { EmbedConfigPanel } from './EmbedConfigPanel'
import type { Menu, CustomMenuConfig } from '../types'

interface CustomMenuConfigPanelProps {
  menu: Menu
  onChange: (config: Menu['config']) => void
}

// Wires PageBuilderDnd + PageToolbox + PageCanvas + ComponentPropertiesPanel
// together as the real config panel for mode === 'page', and EmbedConfigPanel
// for mode === 'embed'. Hydrates usePageBuilderStore from
// (menu.config as CustomMenuConfig).schema on mount — MenusSection.tsx's
// MenuDetail is keyed by menu.id at its call site, so this component remounts
// fresh on every menu switch and a plain mount-time effect is sufficient
// (no need to watch for id changes mid-lifecycle).
//
// Switching modes does NOT clear the other mode's data — only `mode` itself
// changes, so toggling back and forth in the builder never loses work.
export function CustomMenuConfigPanel({ menu, onChange }: CustomMenuConfigPanelProps) {
  const config = menu.config as CustomMenuConfig
  const mode = config.mode ?? 'page'

  const schema = usePageBuilderStore((s) => s.schema)
  const loadSchema = usePageBuilderStore((s) => s.loadSchema)

  useEffect(() => {
    loadSchema(parsePageSchema(config.schema))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push page-builder store changes back up into the enclosing Menu's config
  // whenever the schema changes (any add/move/delete/relayout action).
  useEffect(() => {
    if (mode !== 'page') return
    onChange({ ...config, schema })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema])

  const setMode = (m: CustomMenuConfig['mode']) => onChange({ ...config, mode: m })
  const setEmbedUrl = (url: string) => onChange({ ...config, embedUrl: url })

  return (
    <div className="space-y-4">
      {/* Mode toggle — same segmented-button visual pattern as
          AddMenuConfigPanel's success-behavior toggle. */}
      <div className="flex gap-1 rounded-md bg-slate-100 p-0.5">
        <button
          type="button"
          onClick={() => setMode('page')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px] font-medium transition-colors ${
            mode === 'page' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'
          }`}
        >
          <LayoutTemplate size={12} /> Page Builder
        </button>
        <button
          type="button"
          onClick={() => setMode('embed')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px] font-medium transition-colors ${
            mode === 'embed' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'
          }`}
        >
          <Link2 size={12} /> Embed a Webpage
        </button>
      </div>

      {mode === 'embed' ? (
        <EmbedConfigPanel value={config.embedUrl ?? ''} onChange={setEmbedUrl} />
      ) : (
        // CompactToolbox (horizontal chip-row) stacked ABOVE a full-width
        // canvas, properties panel as an inline expansion below — confirmed
        // via direct measurement that MenuDetail's max-w-xl content area
        // (~528px after padding) is too narrow for Toolbox.tsx's fixed w-64
        // rail to leave a usable canvas beside it (~272px remaining), so this
        // uses the plan's own suggested first fallback rather than jumping
        // straight to a dedicated route.
        <div className="space-y-3">
          <PageBuilderDnd>
            <div className="flex h-[380px] flex-col overflow-hidden rounded-md border border-slate-200">
              <CompactToolbox />
              <PageCanvas />
            </div>
            <ComponentPropertiesPanel currentMenuId={menu.id} />
          </PageBuilderDnd>
        </div>
      )}
    </div>
  )
}

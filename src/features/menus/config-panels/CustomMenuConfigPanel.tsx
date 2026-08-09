import { useEffect, useState } from 'react'
import { LayoutTemplate, Link2, LayoutDashboard, Check, Loader2 } from 'lucide-react'
import { usePageBuilderStore } from '@/features/page-builder/store'
import { parsePageSchema } from '@/features/page-builder/serialize'
import { PageBuilderDnd } from '@/features/page-builder/canvas/PageBuilderDnd'
import { PageCanvas } from '@/features/page-builder/canvas/PageCanvas'
import { CompactToolbox } from '@/features/page-builder/CompactToolbox'
import { ComponentPropertiesPanel } from '@/features/page-builder/config/ComponentPropertiesPanel'
import { Button } from '@/components/ui/button'
import { pageSchemaToDashboard } from '@/features/dashboard/convertFromPageSchema'
import { useCreateMenu } from '../hooks'
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

  const createMutation = useCreateMenu()
  const [convertState, setConvertState] = useState<'idle' | 'done' | 'error'>('idle')

  // Creates a NEW sibling 'dashboard' menu pre-filled from this page's
  // current schema — never modifies or deletes the Custom menu being viewed
  // (see docs/dashboard-system-plan.md section 5.1: "leaves the original
  // untouched"). The new menu shows up in MenusSection's tree on its own via
  // useCreateMenu's query invalidation; there's no onCreated/select callback
  // wired through here since MenuConfigPanelProps is shared by every menu
  // type and only Custom needs this action.
  const handleConvert = async () => {
    setConvertState('idle')
    try {
      await createMutation.mutateAsync({
        parent_id: menu.parent_id,
        menu_type: 'dashboard',
        slug: `${menu.slug}-dashboard-${Date.now().toString(36)}`,
        name: `${menu.name} (Dashboard)`,
        sort_order: menu.sort_order,
        config: { schema: pageSchemaToDashboard(schema) },
        permission_mode: 'all',
        required_role_ids: [],
      })
      setConvertState('done')
    } catch {
      setConvertState('error')
    }
  }

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

          <div className="flex items-center justify-between rounded-md border border-dashed border-slate-200 p-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                <LayoutDashboard size={12} className="text-indigo-500" /> New: Dashboard canvas
              </p>
              <p className="text-[10px] text-slate-400">
                Copy this page into a new drag-and-drop dashboard — charts, tables, and widgets included. The original page is kept as-is.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 gap-1.5 text-[11px]"
              disabled={createMutation.isPending || schema.sections.length === 0}
              onClick={handleConvert}
            >
              {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : convertState === 'done' ? <Check size={12} /> : null}
              {convertState === 'done' ? 'Converted' : 'Convert to Dashboard'}
            </Button>
          </div>
          {convertState === 'error' && (
            <p className="text-[11px] text-red-600">Could not create the dashboard — try again.</p>
          )}
        </div>
      )}
    </div>
  )
}

// Deliberately NOT an inline drag/resize canvas — DashboardMenuConfigPanel.tsx
// (features/menus/config-panels/) already established, with measured
// reasoning, that react-grid-layout's drag/resize interactions don't work
// well inside a narrow config-panel column (that one caps at max-w-xl,
// ~528px; this one — the Form Builder's own ConfigPanel.tsx sidebar — is
// w-80, ~320px, narrower still). That precedent's answer was a summary +
// link to a dedicated full-screen editor, not a cramped inline canvas — this
// panel follows it: a quick-glance summary here, with the actual authoring
// happening in CustomTabEditorOverlay (the full-screen editor FR-D2-015 v0.3's
// correction #2 named as separate, unbuilt scope at the time).
import { useState } from 'react'
import { LayoutDashboard, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomTabEditorOverlay } from './CustomTabEditorOverlay'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { DetailTabConfigPanelProps } from '../contract'
import type { CustomTabConfig } from './schema'

export function CustomTabConfigPanel({ config, onChange }: DetailTabConfigPanelProps<CustomTabConfig>) {
  const t = useTranslation()
  const [editorOpen, setEditorOpen] = useState(false)
  const widgetCount = config.schema.widgets.length

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10">
          <LayoutDashboard size={18} className="text-[hsl(var(--primary))]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            {widgetCount === 0 ? t('custom.config.empty_state') : t(widgetCount === 1 ? 'custom.config.widget_count_one' : 'custom.config.widget_count_many', { count: widgetCount })}
          </p>
          <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
            {t('custom.config.hint')}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setEditorOpen(true)}>
          <Pencil size={13} /> {t('custom.config.open_editor')}
        </Button>
      </div>

      <CustomTabEditorOverlay
        open={editorOpen}
        onOpenChange={setEditorOpen}
        tabLabel={t('custom.config.tab_label')}
        schema={config.schema}
        onChange={(schema) => onChange({ ...config, schema })}
      />
    </>
  )
}

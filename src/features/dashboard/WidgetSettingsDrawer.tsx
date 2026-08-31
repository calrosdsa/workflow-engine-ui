import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useDashboardStore, findWidget } from './store'
import { getWidget } from './widget-registry'
import type { WidgetChrome } from './schema'

interface WidgetSettingsDrawerProps {
  clientId: string
  appId: string
}

// Direct mirror of features/page-builder/config/ComponentPropertiesPanel.tsx:
// finds its own selection from the store (rather than taking it as a prop),
// renders the widget's registry-provided ConfigPanel, dispatches config
// changes through updateWidgetConfig. Adds two things ComponentProperties
// doesn't need: a title field and a chrome toggle, both core-level concerns
// (every widget has a tile title/chrome regardless of type) rather than
// something each widget's own ConfigPanel should have to reimplement.
export function WidgetSettingsDrawer({ clientId, appId }: WidgetSettingsDrawerProps) {
  const schema = useDashboardStore((s) => s.schema)
  const selectedWidgetId = useDashboardStore((s) => s.selectedWidgetId)
  const selectWidget = useDashboardStore((s) => s.selectWidget)
  const updateWidgetConfig = useDashboardStore((s) => s.updateWidgetConfig)
  const updateWidgetTitle = useDashboardStore((s) => s.updateWidgetTitle)
  const updateWidgetChrome = useDashboardStore((s) => s.updateWidgetChrome)

  if (!selectedWidgetId) return null
  const instance = findWidget(schema, selectedWidgetId)
  if (!instance) return null

  const def = getWidget(instance.type)

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex shrink-0 items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {def && <def.icon size={14} className="shrink-0 text-[hsl(var(--primary))]" />}
          <p className="truncate text-xs font-semibold text-[hsl(var(--foreground))]">{def?.label ?? 'Unavailable widget'}</p>
        </div>
        <Button
          variant="ghost" size="icon"
          onClick={() => selectWidget(null)}
          className="h-6 w-6 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <X size={14} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          <div>
            <Label className="mb-1 block text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Tile title (optional)</Label>
            <Input
              value={instance.title ?? ''}
              onChange={(e) => updateWidgetTitle(instance.id, e.target.value)}
              placeholder={def?.label ?? 'Untitled'}
              className="h-8 text-xs"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Tile style</Label>
            <div className="flex gap-1 rounded-md bg-[hsl(var(--muted))] p-0.5">
              {(['card', 'plain'] as WidgetChrome[]).map((chrome) => (
                <button
                  key={chrome}
                  type="button"
                  onClick={() => updateWidgetChrome(instance.id, chrome)}
                  className={cn(
                    'flex-1 rounded px-2 py-1.5 text-[11px] font-medium capitalize transition-colors',
                    instance.chrome === chrome ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]',
                  )}
                >
                  {chrome}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-[hsl(var(--border))]" />

          {def ? (
            <def.ConfigPanel
              config={def.parseConfig(instance.config)}
              onChange={(config) => updateWidgetConfig(instance.id, config)}
              clientId={clientId}
              appId={appId}
            />
          ) : (
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              This widget's type ("{instance.type}") isn't registered, so it has no settings to show. Its position and data are preserved — you can still move, resize, or delete the tile.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

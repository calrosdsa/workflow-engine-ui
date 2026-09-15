import { nanoid } from 'nanoid'
import { ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { MenuSlugSelect } from '@/features/page-builder/config/MenuSlugSelect'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { QuickLinksWidgetConfig, QuickLink } from './schema'

// Plain up/down reordering rather than a dnd-kit sortable list: quick-links
// lists are typically a handful of entries (config-panel scale, not
// canvas-tile scale), and nesting a second SortableContext inside this
// widget would sit inside DashboardBuilderDnd's own DndContext — simple
// buttons sidestep any question of context-nesting entirely for a list this
// size.
export function QuickLinksConfigPanel({ config, onChange }: WidgetConfigPanelProps<QuickLinksWidgetConfig>) {
  const t = useTranslation()
  const addLink = () => {
    // 'New link' is NOT translated: it seeds link.label, which is persisted
    // author content rendered verbatim by QuickLinkItem at runtime — the
    // author is expected to overtype it, same exclusion class as
    // ReportsSection's 'Untitled Report' default. The "Label" placeholder
    // on the Input below IS chrome and does get a key.
    const link: QuickLink = { id: nanoid(), label: 'New link', kind: 'url', url: '' }
    onChange({ ...config, links: [...config.links, link] })
  }

  const updateLink = (id: string, patch: Partial<QuickLink>) => {
    onChange({ ...config, links: config.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) })
  }

  const removeLink = (id: string) => {
    onChange({ ...config, links: config.links.filter((l) => l.id !== id) })
  }

  const moveLink = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= config.links.length) return
    const links = [...config.links]
    ;[links[index], links[target]] = [links[target], links[index]]
    onChange({ ...config, links })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_quick-links.layout')}</Label>
        <SelectMenu value={config.display} onValueChange={(v) => onChange({ ...config, display: v as QuickLinksWidgetConfig['display'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="list" className="text-xs">{t('builder.dashboard_quick-links.display_list')}</SelectItem>
            <SelectItem value="grid" className="text-xs">{t('builder.dashboard_quick-links.display_grid')}</SelectItem>
            <SelectItem value="buttons" className="text-xs">{t('builder.dashboard_quick-links.display_buttons')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_quick-links.links_label')}</Label>
          <Button type="button" size="sm" variant="outline" className="h-6 gap-1 px-2 text-[11px]" onClick={addLink}>
            <Plus size={11} /> {t('builder.dashboard_quick-links.add')}
          </Button>
        </div>

        {config.links.length === 0 && (
          <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
            {t('builder.dashboard_quick-links.no_links')}
          </p>
        )}

        <div className="space-y-2">
          {config.links.map((link, i) => (
            <LinkEditor
              key={link.id}
              link={link}
              isFirst={i === 0}
              isLast={i === config.links.length - 1}
              onChange={(patch) => updateLink(link.id, patch)}
              onMove={(dir) => moveLink(i, dir)}
              onRemove={() => removeLink(link.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function LinkEditor({
  link, isFirst, isLast, onChange, onMove, onRemove,
}: {
  link: QuickLink
  isFirst: boolean
  isLast: boolean
  onChange: (patch: Partial<QuickLink>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const t = useTranslation()
  return (
    <div className="space-y-2 rounded-md border border-[hsl(var(--border))] p-2.5">
      <div className="flex items-center gap-1.5">
        <Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} placeholder={t('builder.dashboard_quick-links.label_placeholder')} className="h-7 flex-1 text-xs" />
        <button type="button" disabled={isFirst} onClick={() => onMove(-1)} className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30">
          <ArrowUp size={12} />
        </button>
        <button type="button" disabled={isLast} onClick={() => onMove(1)} className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30">
          <ArrowDown size={12} />
        </button>
        <button type="button" onClick={onRemove} className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]">
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex gap-1 rounded-md bg-[hsl(var(--muted))] p-0.5">
        {(['url', 'menu'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange({ kind: k })}
            className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              link.kind === k ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'
            }`}
          >
            {k === 'url' ? t('builder.dashboard_quick-links.kind_url') : t('builder.dashboard_quick-links.kind_menu')}
          </button>
        ))}
      </div>

      {link.kind === 'url' ? (
        <Input value={link.url ?? ''} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://…" className="h-7 text-xs" />
      ) : (
        <MenuSlugSelect value={link.menuSlug ?? ''} onChange={(slug) => onChange({ menuSlug: slug })} />
      )}
    </div>
  )
}

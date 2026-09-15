import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { MenuSlugSelect } from '@/features/page-builder/config/MenuSlugSelect'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { ButtonWidgetConfig } from './schema'

// Reuses page-builder's MenuSlugSelect as-is (same {name}/{slug} picker the
// Custom Page button component uses). Doesn't pass excludeMenuId — that
// requires the enclosing dashboard menu's own id, which isn't threaded
// through WidgetConfigPanelProps yet (DashboardMenuConfigPanel is still a
// Phase 1 placeholder; the real settings-drawer integration point that would
// carry it lands with a later phase). A button widget can technically link
// to its own dashboard in the meantime — a cosmetic gap, not a data-integrity
// one, since MenuSlugSelect's dangling-reference warning still works.
export function ButtonConfigPanel({ config, onChange }: WidgetConfigPanelProps<ButtonWidgetConfig>) {
  const t = useTranslation()
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_button.label_field')}</Label>
        <Input value={config.label} onChange={(e) => onChange({ ...config, label: e.target.value })} className="h-8 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_button.style')}</Label>
        <SelectMenu value={config.variant} onValueChange={(v) => onChange({ ...config, variant: v as ButtonWidgetConfig['variant'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="primary" className="text-xs">{t('builder.dashboard_button.variant_primary')}</SelectItem>
            <SelectItem value="secondary" className="text-xs">{t('builder.dashboard_button.variant_secondary')}</SelectItem>
            <SelectItem value="outline" className="text-xs">{t('builder.dashboard_button.variant_outline')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </div>
      <div>
        <Label className="mb-1.5 block text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_button.links_to')}</Label>
        <div className="flex gap-1 rounded-md bg-[hsl(var(--muted))] p-0.5">
          {(['menu', 'external'] as const).map((linkType) => (
            <button
              key={linkType}
              type="button"
              onClick={() => onChange({ ...config, linkType })}
              className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                config.linkType === linkType ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'
              }`}
            >
              {linkType === 'menu' ? t('builder.dashboard_button.link_type_menu') : t('builder.dashboard_button.link_type_external')}
            </button>
          ))}
        </div>
      </div>
      {config.linkType === 'menu' ? (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_button.target_menu')}</Label>
          <MenuSlugSelect value={config.menuSlug ?? ''} onChange={(slug) => onChange({ ...config, menuSlug: slug })} />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_button.url')}</Label>
          <Input value={config.url ?? ''} onChange={(e) => onChange({ ...config, url: e.target.value })} placeholder="https://…" className="h-8 text-sm" />
        </div>
      )}
    </div>
  )
}

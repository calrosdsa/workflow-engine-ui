import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useMenus } from '../hooks'
import type { Menu, AddMenuConfig } from '../types'

interface AddMenuConfigPanelProps {
  menu: Menu
  onChange: (config: Menu['config']) => void
}

export function AddMenuConfigPanel({ menu, onChange }: AddMenuConfigPanelProps) {
  const t = useTranslation()
  const config = menu.config as AddMenuConfig
  const { data: allMenus } = useMenus()
  const patch = (p: Partial<AddMenuConfig>) => onChange({ ...config, ...p })

  const otherMenus = (allMenus ?? []).filter((m) => m.id !== menu.id)

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('menus.config_panels.target_form_label')}</Label>
        <FormReferenceSelect value={config.form_id} onChange={(formId) => patch({ form_id: formId ?? '' })} />
        <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{t('menus.config_panels.add.form_hint')}</p>
      </div>

      <div>
        <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('menus.config_panels.add.success_label')}</Label>
        <div className="flex gap-1 rounded-md bg-[hsl(var(--muted))] p-0.5">
          {(['message', 'redirect'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => patch({ success_behavior: b })}
              className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                config.success_behavior === b ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'
              }`}
            >
              {b === 'message' ? t('menus.config_panels.add.success_message_mode') : t('menus.config_panels.add.success_redirect_mode')}
            </button>
          ))}
        </div>
      </div>

      {config.success_behavior === 'message' && (
        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('menus.config_panels.add.success_message_label')}</Label>
          <Input
            value={config.success_message ?? ''}
            onChange={(e) => patch({ success_message: e.target.value })}
            placeholder={t('menus.config_panels.add.success_message_placeholder')}
          />
        </div>
      )}

      {config.success_behavior === 'redirect' && (
        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('menus.config_panels.add.redirect_to_label')}</Label>
          <SelectMenu value={config.redirect_menu_slug || '__none__'} onValueChange={(v) => patch({ redirect_menu_slug: v === '__none__' ? '' : v })}>
            <SelectTrigger className="w-full text-sm"><SelectValue placeholder={t('menus.config_panels.add.select_menu_placeholder')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs">{t('menus.config_panels.add.select_menu_placeholder')}</SelectItem>
              {otherMenus.map((m) => (
                <SelectItem key={m.id} value={m.slug} className="text-xs">{m.name}</SelectItem>
              ))}
            </SelectContent>
          </SelectMenu>
        </div>
      )}
    </div>
  )
}

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { Menu, ParentMenuConfig } from '../types'

interface ParentMenuConfigPanelProps {
  menu: Menu
  onChange: (config: Menu['config']) => void
}

export function ParentMenuConfigPanel({ menu, onChange }: ParentMenuConfigPanelProps) {
  const t = useTranslation()
  const config = menu.config as ParentMenuConfig

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2 text-[12px] font-normal text-[hsl(var(--foreground))]">
        <Checkbox
          checked={config.collapsed_by_default ?? false}
          onCheckedChange={(checked) => onChange({ ...config, collapsed_by_default: checked === true })}
        />
        {t('menus.config_panels.parent.collapsed_label')}
      </Label>
      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
        {t('menus.config_panels.parent.hint')}
      </p>
    </div>
  )
}

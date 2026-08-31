import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { Menu, ParentMenuConfig } from '../types'

interface ParentMenuConfigPanelProps {
  menu: Menu
  onChange: (config: Menu['config']) => void
}

export function ParentMenuConfigPanel({ menu, onChange }: ParentMenuConfigPanelProps) {
  const config = menu.config as ParentMenuConfig

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2 text-[12px] font-normal text-[hsl(var(--foreground))]">
        <Checkbox
          checked={config.collapsed_by_default ?? false}
          onCheckedChange={(checked) => onChange({ ...config, collapsed_by_default: checked === true })}
        />
        Collapsed by default in the sidebar
      </Label>
      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
        This menu is a pure navigation container — it has no data of its own, just child menus.
      </p>
    </div>
  )
}

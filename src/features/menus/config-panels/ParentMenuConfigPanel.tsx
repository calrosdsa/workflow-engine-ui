import { Checkbox } from '@/components/ui/checkbox'
import type { Menu, ParentMenuConfig } from '../types'

interface ParentMenuConfigPanelProps {
  menu: Menu
  onChange: (config: Menu['config']) => void
}

export function ParentMenuConfigPanel({ menu, onChange }: ParentMenuConfigPanelProps) {
  const config = menu.config as ParentMenuConfig

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-[12px] text-slate-700">
        <Checkbox
          checked={config.collapsed_by_default ?? false}
          onCheckedChange={(checked) => onChange({ ...config, collapsed_by_default: checked === true })}
        />
        Collapsed by default in the sidebar
      </label>
      <p className="text-[11px] text-gray-400">
        This menu is a pure navigation container — it has no data of its own, just child menus.
      </p>
    </div>
  )
}

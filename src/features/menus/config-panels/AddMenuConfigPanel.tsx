import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useMenus } from '../hooks'
import type { Menu, AddMenuConfig } from '../types'

interface AddMenuConfigPanelProps {
  menu: Menu
  onChange: (config: Menu['config']) => void
}

export function AddMenuConfigPanel({ menu, onChange }: AddMenuConfigPanelProps) {
  const config = menu.config as AddMenuConfig
  const { data: allMenus } = useMenus()
  const patch = (p: Partial<AddMenuConfig>) => onChange({ ...config, ...p })

  const otherMenus = (allMenus ?? []).filter((m) => m.id !== menu.id)

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Target form</label>
        <FormReferenceSelect value={config.form_id} onChange={(formId) => patch({ form_id: formId ?? '' })} />
        <p className="mt-1 text-[11px] text-gray-400">The form rendered for creating a new record.</p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">On successful save</label>
        <div className="flex gap-1 rounded-md bg-slate-100 p-0.5">
          {(['message', 'redirect'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => patch({ success_behavior: b })}
              className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                config.success_behavior === b ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'
              }`}
            >
              {b === 'message' ? 'Show a message' : 'Redirect to another menu'}
            </button>
          ))}
        </div>
      </div>

      {config.success_behavior === 'message' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Success message</label>
          <Input
            value={config.success_message ?? ''}
            onChange={(e) => patch({ success_message: e.target.value })}
            placeholder="Record created successfully"
          />
        </div>
      )}

      {config.success_behavior === 'redirect' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Redirect to</label>
          <select
            value={config.redirect_menu_slug ?? ''}
            onChange={(e) => patch({ redirect_menu_slug: e.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
          >
            <option value="">Select a menu…</option>
            {otherMenus.map((m) => (
              <option key={m.id} value={m.slug}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-[12px] text-slate-700">
        <Checkbox
          checked={config.navigate_after_save}
          onCheckedChange={(checked) => patch({ navigate_after_save: checked === true })}
        />
        Navigate automatically after save (vs. staying on the form)
      </label>
    </div>
  )
}

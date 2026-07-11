import { usePageBuilderStore, findComponent } from '../store'
import { PAGE_COMPONENT_REGISTRY } from '../component-registry'

// Property editors now live one-per-type in ComponentForms.tsx, dispatched
// through component-registry.ts's configPanel field — the same pattern
// node-registry.ts and menu-registry.ts use. (Superseded the earlier
// metadata+switch decision recorded here: with node-registry.ts and
// menu-registry.ts both proven out, the switch was shotgun-surgery waiting
// to happen the same way NodeConfigPanel.tsx's was, just smaller.)
//
// Finds its own selection from usePageBuilderStore directly rather than
// taking it as a prop, matching ConfigPanel.tsx's own convention.

export function ComponentPropertiesPanel({ currentMenuId }: { currentMenuId?: string }) {
  const schema = usePageBuilderStore((s) => s.schema)
  const selectedComponentId = usePageBuilderStore((s) => s.selectedItemId)
  const updateComponent = usePageBuilderStore((s) => s.updateItem)

  if (!selectedComponentId) return null
  const found = findComponent(schema, selectedComponentId)
  if (!found) return null

  const reg = PAGE_COMPONENT_REGISTRY[found.item.component]
  const Icon = reg.icon

  return (
    <div className="space-y-4 border-t border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-indigo-500" />
        <p className="text-xs font-semibold text-slate-700">{reg.label} properties</p>
      </div>
      <reg.configPanel
        component={found.item}
        onChange={(patch) => updateComponent(selectedComponentId, patch)}
        currentMenuId={currentMenuId}
      />
    </div>
  )
}

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/features/auth/PermissionGate'
import { RecordsTable } from '@/features/forms/runtime/RecordsTable'
import { useForm as useFormDef } from '@/features/forms/hooks'
import type { MenuRuntimeRendererProps } from '../menu-registry'
import type { SearchMenuConfig, AddMenuConfig } from '../types'
import type { FormRecord } from '@/features/forms/types'

// Thin wrapper around features/forms/runtime/RecordsTable.tsx (Phase 4 of
// docs/dashboard-system-plan.md) — everything that's actually "a live,
// filterable table of records for a form" lives there now, shared with the
// dashboard's table widget. What's left here is Search-menu-specific:
// the page heading, the filter toggle being on by default, the "Create
// Record" button gated on the sibling Add menu existing, and expanding a
// record to its own full page via onNavigate.
export function SearchMenuRuntime({ menu, menus, onNavigate }: MenuRuntimeRendererProps) {
  const config = menu.config as SearchMenuConfig

  const addMenu = menus?.find((m) => m.menu_type === 'add' && (m.config as AddMenuConfig).form_id === config.form_id)
  // Same query RecordsTable itself makes for this formId — React Query
  // dedupes both calls under the shared cache key, so this costs no extra
  // request. Falls back to the generic "Record" if the form hasn't loaded
  // yet (brief) or failed to load (PermissionGate already covers the "no
  // access" case; this is just a label, so it degrades quietly).
  const { data: form } = useFormDef(config.form_id)
  const createLabel = form?.name ? `Create ${form.name}` : 'Create Record'

  return (
    <div className="p-6">
      <RecordsTable
        formId={config.form_id}
        columns={config.columns}
        defaultFilter={config.default_filter}
        defaultSort={config.default_sort}
        pageSize={config.page_size}
        allowFilter
        allowSearch
        title={menu.name}
        onExpandRecord={(r: FormRecord) => onNavigate?.(`${menu.slug}/${r.id as string}`)}
        headerActions={
          // No disabled button with a tooltip explaining why — if there's
          // genuinely nothing to link to (an Add menu was deleted after
          // this Search menu was built, or a form built before Add menus
          // auto-paired), offering a button that can never do anything is
          // worse than not offering one at all; a viewer who has create
          // access on the form still can't act on a button they can't
          // click, so hiding it is strictly clearer.
          addMenu && (
            <PermissionGate need={`forms:${config.form_id}:create`}>
              <Button size="sm" className="gap-1.5" onClick={() => onNavigate?.(addMenu.slug)}>
                <Plus size={14} />{createLabel}
              </Button>
            </PermissionGate>
          )
        }
      />
    </div>
  )
}

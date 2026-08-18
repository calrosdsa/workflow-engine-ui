import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/features/auth/PermissionGate'
import { RecordsTable } from '@/features/forms/runtime/RecordsTable'
import { RuntimeLink } from '@/features/runtime/RuntimeLink'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { useSavedViews, useUpdateSavedView } from '@/features/menus/saved-views/hooks'
import { ViewSwitcher } from '@/features/menus/saved-views/ViewSwitcher'
import { resolveDefaultView } from '@/features/menus/saved-views/types'
import type { MenuRuntimeRendererProps } from '../menu-registry'
import type { SearchMenuConfig, AddMenuConfig } from '../types'
import type { FormRecord } from '@/features/forms/types'
import type { SavedView, SavedViewConfig } from '@/features/menus/saved-views/types'

// Thin wrapper around features/forms/runtime/RecordsTable.tsx (Phase 4 of
// docs/dashboard-system-plan.md) — everything that's actually "a live,
// filterable table of records for a form" lives there now, shared with the
// dashboard's table widget. What's left here is Search-menu-specific:
// the page heading, the filter toggle being on by default, the "Create
// Record" button, expanding a record to its own full page via onNavigate,
// and (FR-D2-014) the saved-view switcher — which view is active decides
// what filter/sort/columns/layout RecordsTable renders with, in place of
// this menu's own static default_filter/default_sort/columns.
export function SearchMenuRuntime({ menu, menus, clientId, appId, onNavigate }: MenuRuntimeRendererProps) {
  const config = menu.config as SearchMenuConfig
  const { data: savedViews } = useSavedViews(menu.id)
  const updateSavedView = useUpdateSavedView(menu.id)

  // Ad hoc = no saved view is active; RecordsTable falls back to the menu's
  // own static default_filter/default_sort/columns (§3's final fallback
  // tier, unchanged behavior for a menu with zero saved views — TC-07).
  // Initialized lazily from the resolved default (§3's priority order:
  // private-owned > role-scoped > public), re-resolved once savedViews
  // loads via the effect below.
  const [activeView, setActiveView] = useState<SavedView | undefined>(undefined)
  const [hasResolvedDefault, setHasResolvedDefault] = useState(false)
  if (!hasResolvedDefault && savedViews) {
    const def = resolveDefaultView(savedViews)
    if (def) setActiveView(def)
    setHasResolvedDefault(true)
  }
  // If the active view was since deleted (another tab, or this view's own
  // delete action already clears it via ViewSwitcher's onSelect(undefined)),
  // stop pointing at a stale object once the list refetches.
  const liveActiveView = activeView && savedViews?.find((v) => v.id === activeView.id)

  // Prefer a sibling Add menu when one exists (keeps any Add-menu-specific
  // config — success message, redirect-after-save — in play), but a Search
  // menu shouldn't have no "Create" button just because nobody built an Add
  // menu for the same form. Falls back to the formId-keyed create route
  // (RuntimeFormCreatePage), the same way RecordReferenceLink falls back to
  // the formId-keyed detail route instead of requiring a Search menu to
  // exist for the target form — see that component's own reasoning for why
  // there's no principled way to prefer one Add menu over another once more
  // than one exists, which is also why this only looks for the first match.
  const addMenu = menus?.find((m) => m.menu_type === 'add' && (m.config as AddMenuConfig).form_id === config.form_id)
  // Same query RecordsTable itself makes for this formId — React Query
  // dedupes both calls under the shared cache key, so this costs no extra
  // request. Falls back to the generic "Record" if the form hasn't loaded
  // yet (brief) or failed to load (PermissionGate already covers the "no
  // access" case; this is just a label, so it degrades quietly).
  const { data: form } = useFormDef(config.form_id)
  const createLabel = form?.name ? `Create ${form.name}` : 'Create Record'

  const currentConfig: SavedViewConfig = liveActiveView
    ? liveActiveView.config
    : { filter: config.default_filter ?? { combinator: 'and', conditions: [], groups: [] }, sort: config.default_sort ?? [], columns: config.columns, layout: 'list' }

  return (
    <div className="p-6">
      <RecordsTable
        formId={config.form_id}
        columns={currentConfig.columns}
        defaultFilter={currentConfig.filter}
        defaultSort={currentConfig.sort}
        pageSize={config.page_size}
        layout={currentConfig.layout}
        layoutConfig={currentConfig.layout_config}
        allowFilter
        allowSearch
        title={menu.name}
        onExpandRecord={(r: FormRecord) => onNavigate?.(`${menu.slug}/${r.id as string}`)}
        onColumnsReorder={
          liveActiveView?.can_manage
            ? (newColumnKeys) => {
                const updated: SavedViewConfig = { ...liveActiveView.config, columns: newColumnKeys }
                updateSavedView.mutate(
                  { id: liveActiveView.id, payload: { name: liveActiveView.name, visibility: liveActiveView.visibility, visible_role_ids: liveActiveView.visible_role_ids, is_default: liveActiveView.is_default, config: updated } },
                  { onSuccess: (saved) => setActiveView(saved) },
                )
              }
            : undefined
        }
        headerActions={
          <>
            <ViewSwitcher
              appId={appId}
              menuId={menu.id}
              fields={form?.fields ?? []}
              views={savedViews ?? []}
              activeView={liveActiveView}
              onSelect={setActiveView}
              currentConfig={currentConfig}
            />
            <PermissionGate need={`forms:${config.form_id}:create`}>
              {addMenu ? (
                <Button size="sm" className="gap-1.5" onClick={() => onNavigate?.(addMenu.slug)}>
                  <Plus size={14} />{createLabel}
                </Button>
              ) : (
                <RuntimeLink to={`/${clientId}/${appId}/forms/${config.form_id}/new`}>
                  <Button size="sm" className="gap-1.5">
                    <Plus size={14} />{createLabel}
                  </Button>
                </RuntimeLink>
              )}
            </PermissionGate>
          </>
        }
      />
    </div>
  )
}

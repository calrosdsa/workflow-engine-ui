import { useState } from 'react'
import { Plus, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/features/auth/PermissionGate'
import { RecordsTable } from '@/features/forms/runtime/RecordsTable'
import { RuntimeLink } from '@/features/runtime/RuntimeLink'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { buildEnumLabels } from '@/features/forms/runtime/enum-labels'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { localizeFormSchema, localizeFormName } from '@/features/form-builder/localize-schema'
import { useI18n } from '@/features/i18n/I18nProvider'
import { useSavedViews, useUpdateSavedView } from '@/features/menus/saved-views/hooks'
import { ViewSwitcher } from '@/features/menus/saved-views/ViewSwitcher'
import { resolveDefaultView } from '@/features/menus/saved-views/types'
import type { MenuRuntimeRendererProps } from '../menu-registry'
import type { SearchMenuConfig, AddMenuConfig } from '../types'
import type { FormRecord } from '@/features/forms/types'
import type { FilterGroup, SortRule } from '@/features/workflows/types'
import type { SavedView, SavedViewConfig, CalendarLayoutConfig, KanbanLayoutConfig, TreeLayoutConfig } from '@/features/menus/saved-views/types'

// Strips the UI-only `id` keys FilterBuilder/SortRuleList generate (list-
// rendering keys, never sent to or stored by the backend — see
// ensureGroupIds/ensureSortIds's own comments) before comparing a live
// filter/sort against the saved view's own config, which the backend always
// returns id-less. Comparing WITH ids would show a spurious diff on every
// single load, even with zero real changes, since RecordsTable regenerates
// fresh ids for whatever seeded it — id-less is the only representation both
// sides can agree on.
function stripFilterIds(g: FilterGroup): unknown {
  return { combinator: g.combinator, conditions: g.conditions.map((c) => ({ field: c.field, op: c.op, value_mode: c.value_mode, value: c.value, expression: c.expression })), groups: g.groups.map(stripFilterIds) }
}
function stripSortIds(s: SortRule[]): unknown {
  return s.map((r) => ({ field: r.field, dir: r.dir }))
}

/** The live-edit shape SearchMenuRuntime tracks for the unsaved-changes
 *  banner — a subset of SavedViewConfig, since name/visibility/is_default
 *  aren't editable from the live table (only through the Edit View drawer,
 *  which has its own explicit Save button and needs no banner). */
type LivePatch = { columns?: string[]; filter?: FilterGroup; sort?: SortRule[]; layoutConfig?: CalendarLayoutConfig | KanbanLayoutConfig | TreeLayoutConfig }

// Thin wrapper around features/forms/runtime/RecordsTable.tsx (Phase 4 of
// docs/dashboard-system-plan.md) — everything that's actually "a live,
// filterable table of records for a form" lives there now, shared with the
// dashboard's table widget. What's left here is Search-menu-specific:
// the page heading, the filter toggle being on by default, the "Create
// Record" button, expanding a record to its own full page via onNavigate,
// and (FR-D2-014) the saved-view switcher — which view is active decides
// what filter/sort/columns/layout RecordsTable renders with, in place of
// this menu's own static default_filter/default_sort/columns.
export function SearchMenuRuntime({ menu, menus, clientId, appId, onNavigate, externalFilter }: MenuRuntimeRendererProps) {
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

  // Whatever RecordsTable's own live filter/sort/columns/layoutConfig state
  // currently is, reported via onLiveConfigChange on every edit (a filter
  // change, a column drag, a Kanban board drag) — undefined means "nothing's
  // been touched since the view was loaded," the common case. Reset to
  // undefined by RecordsTable's own key-driven remount (see that prop's
  // comment below) whenever the active view switches or is saved, so a
  // stale pending patch from a previous view can never leak into a new one.
  const [pendingPatch, setPendingPatch] = useState<LivePatch | undefined>(undefined)

  const savingView = updateSavedView.isPending

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
  // Real Select-option display labels ("Active," not "active") for
  // ViewSwitcher's Edit View drawer's Kanban column picker — the same
  // parseLayout(form.layout)/buildEnumLabels(schema) pair RecordsTable
  // computes for the board itself; recomputed here rather than threaded
  // down as a prop since RecordsTable owns its own instance and there's no
  // existing plumbing to share one between this component and it.
  const { tc } = useI18n()
  const enumLabels = buildEnumLabels(localizeFormSchema(resolveFormSchema(form), config.form_id, tc))
  const createLabel = form?.name ? `Create ${localizeFormName(config.form_id, form.name, tc)}` : 'Create Record'

  const currentConfig: SavedViewConfig = liveActiveView
    ? liveActiveView.config
    : { filter: config.default_filter ?? { combinator: 'and', conditions: [], groups: [] }, sort: config.default_sort ?? [], columns: config.columns, layout: 'list' }

  // externalFilter (a connections tile's ?linkField=/?linkValue= navigation,
  // see menu-registry.ts's own doc comment on this prop) is a NAVIGATION-time
  // overlay, never part of the saved view itself — composed only for what
  // RecordsTable actually queries with, kept out of currentConfig/mergedLive
  // so it never taints the unsaved-changes diff against the stored view.
  const effectiveFilter: FilterGroup = externalFilter
    ? { combinator: 'and', conditions: [], groups: [currentConfig.filter, externalFilter] }
    : currentConfig.filter

  // Real diff check, not just "has pendingPatch fired at all" — RecordsTable
  // fires onLiveConfigChange on every keystroke-settled filter edit and
  // every drag, including ones that land back where they started (e.g. a
  // column dragged one slot over and immediately back), so this recomputes
  // whether the CURRENT merged patch actually differs from what's saved,
  // id-stripped on both filter/sort sides (see stripFilterIds/stripSortIds).
  const mergedLive: SavedViewConfig = { ...currentConfig, ...pendingPatch }
  const hasUnsavedChanges = !!liveActiveView && !!pendingPatch && (
    JSON.stringify(mergedLive.columns ?? []) !== JSON.stringify(liveActiveView.config.columns ?? []) ||
    JSON.stringify(stripFilterIds(mergedLive.filter)) !== JSON.stringify(stripFilterIds(liveActiveView.config.filter)) ||
    JSON.stringify(stripSortIds(mergedLive.sort)) !== JSON.stringify(stripSortIds(liveActiveView.config.sort)) ||
    JSON.stringify(mergedLive.layout_config ?? null) !== JSON.stringify(liveActiveView.config.layout_config ?? null)
  )

  const saveChanges = () => {
    if (!liveActiveView) return
    const updated: SavedViewConfig = { ...liveActiveView.config, ...pendingPatch }
    updateSavedView.mutate(
      { id: liveActiveView.id, payload: { name: liveActiveView.name, visibility: liveActiveView.visibility, visible_role_ids: liveActiveView.visible_role_ids, is_default: liveActiveView.is_default, config: updated } },
      {
        onSuccess: (saved) => {
          setActiveView(saved)
          setPendingPatch(undefined)
        },
      },
    )
  }
  // Discarding must force RecordsTable back to currentConfig, not just stop
  // tracking the pending patch — RecordsTable's own filter/sort/columns/
  // layoutConfig are local state it already applied live (that's the whole
  // point: the board/table updates immediately as you drag/edit, before any
  // save). Clearing pendingPatch alone would un-track the change without
  // un-applying it, leaving the table visibly showing the discarded edit.
  // discardKey (folded into RecordsTable's key below) forces exactly the
  // same remount-to-currentConfig that switching views or saving already
  // relies on.
  const [discardKey, setDiscardKey] = useState(0)
  const discardChanges = () => {
    setPendingPatch(undefined)
    setDiscardKey((k) => k + 1)
  }

  return (
    <div className="p-6">
      {hasUnsavedChanges && liveActiveView.can_manage && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs" style={{ borderColor: 'hsl(var(--primary) / 0.4)', backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--foreground))' }}>
          <span>“{liveActiveView.name}” has unsaved changes.</span>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={discardChanges} disabled={savingView}>
              <X size={12} />Discard
            </Button>
            <Button size="sm" className="h-7 gap-1 px-2" onClick={saveChanges} disabled={savingView}>
              <Save size={12} />{savingView ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      )}

      <RecordsTable
        // RecordsTable seeds its internal filter/sort/columns/layoutConfig
        // state from defaultFilter/defaultSort/columns/layoutConfig only
        // once, on mount (useState initializers, not effects) — so
        // switching the active saved view, OR saving/discarding a pending
        // change, must force a fresh mount, or the table silently keeps
        // showing stale state even though currentConfig (and the network
        // requests) are already correct. updated_at (not just id) is
        // required in the key so an in-place SAVE of the currently active
        // view also remounts, resetting pendingPatch's downstream effect
        // (RecordsTable's own local state) back to the just-saved config —
        // switching to a DIFFERENT view already changes `id` on its own,
        // but saving the same view doesn't. externalFilter is folded in too:
        // navigating between two connections-tile links to this SAME menu
        // (or plain menu -> filtered link, or one linkValue -> another) is
        // the same route match with only the search params changing, which
        // TanStack Router does not remount for on its own.
        key={(liveActiveView ? `${liveActiveView.id}:${liveActiveView.updated_at}` : 'ad-hoc') + `:${discardKey}:${JSON.stringify(externalFilter ?? null)}`}
        formId={config.form_id}
        columns={currentConfig.columns}
        defaultFilter={effectiveFilter}
        defaultSort={currentConfig.sort}
        pageSize={config.page_size}
        layout={currentConfig.layout}
        layoutConfig={currentConfig.layout_config}
        allowFilter
        allowSearch
        title={menu.name}
        onExpandRecord={(r: FormRecord) => onNavigate?.(`${menu.slug}/${r.id as string}`)}
        columnDragEnabled={!!liveActiveView?.can_manage}
        onLiveConfigChange={liveActiveView?.can_manage ? (patch) => setPendingPatch((prev) => ({ ...prev, ...patch })) : undefined}
        headerActions={
          <>
            <ViewSwitcher
              appId={appId}
              menuId={menu.id}
              formId={config.form_id}
              fields={form?.fields ?? []}
              enumLabels={enumLabels}
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
                <RuntimeLink to={`/${clientId}/${appId}/forms/${config.form_id}/new?fromMenu=${encodeURIComponent(menu.id)}`}>
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

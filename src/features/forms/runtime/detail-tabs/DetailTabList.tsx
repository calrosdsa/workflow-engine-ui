// Shared tab-list renderer — resolves visibility/renderIf/hideWhenEmpty and
// renders the Tabs/TabsList/TabsContent loop against a given list of
// DetailTabConfig entries. Extracted from RecordDetailPanel.tsx (which
// originally had this inline, for the form's own top-level tab list) so the
// 'group' tab type (nested tabs, e.g. "Comments" + "History" grouped inside
// "Details") can reuse the EXACT same resolution/rendering logic recursively
// instead of RecordDetailPanel and the group Renderer each maintaining their
// own copy — a group's children go through the identical visibility/renderIf/
// hideWhenEmpty machinery the top-level tab list already has, no special-casing.
import { useState, type ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { useI18n } from '@/features/i18n/I18nProvider'
import { getDetailTab } from './registry'
import { useCurrentViewer, isTabVisible } from './useTabVisible'
import { useExpressionRuntimeState, schemaToVariableDecls } from '../expression-context'
import type { DetailTabRendererProps } from './contract'
import type { DetailTabConfig, DetailTabOrientation } from '@/features/form-builder/schema'
import type { FormSchema } from '@/features/form-builder/schema'
import type { FieldDef, FormRecord } from '@/features/forms/types'

export interface DetailTabListProps {
  formId: string
  recordId: string
  fields: FieldDef[]
  schema?: FormSchema
  record?: FormRecord
  tabConfigs: DetailTabConfig[]
  onNavigateToRecord?: (formId: string, recordId: string) => void
  /** Distinguishes the top-level tab bar's chrome (border, padding) from a
   *  nested group's — a group's own tab bar reads as a lighter-weight sub-
   *  navigation, not a second full-bleed header. */
  nested?: boolean
  /** How many `group` levels deep this call is — 0 at the top level
   *  (RecordDetailPanel), incremented by GroupTabRenderer for each nested
   *  group. Passed through to each rendered tab's own DetailTabRendererProps
   *  as `groupDepth` so a group type can refuse to recurse past MAX_GROUP_DEPTH
   *  (below) — nothing in the registry/schema prevents an admin from
   *  configuring a group containing itself (directly, or via a cycle through
   *  several groups), which would otherwise recurse until the browser tab
   *  crashes. */
  groupDepth?: number
  /** Detail Page Builder preview only — swaps a tab TYPE's registered
   *  Renderer for a lightweight stand-in (e.g. a static placeholder card
   *  instead of related_form's real cross-form query, or custom's real
   *  live Dashboard widget canvas). Returning undefined for a type falls
   *  back to the real getDetailTab(type).Renderer, so every existing call
   *  site (RecordDetailPanel, GroupTabRenderer) passing nothing is
   *  completely unaffected. */
  rendererOverride?: (type: string) => ComponentType<DetailTabRendererProps<any>> | undefined
  /** Horizontal (default) or vertical tab bar — FormSettings.tabOrientation.
   *  Deliberately NOT threaded into a nested call (GroupTabRenderer never
   *  passes this on): a Tab Group's own child bar always stays horizontal,
   *  a lighter-weight sub-navigation rather than a second top-level bar
   *  that also flips orientation. */
  orientation?: DetailTabOrientation
  /** 'tabs' (default) renders the Tabs/TabsList bar; 'stacked' renders every
   *  tab at once as labeled sections, one under another, with no bar at all.
   *  Used for the record detail page's narrow sidebar zone, where two or
   *  three short panels (Attachments, Tags) read as a single glanceable
   *  column — a tab strip in a 320px column hides half its content behind a
   *  click for no benefit. Presentation only: visibility, renderIf and
   *  hideWhenEmpty resolve identically in both, which is the whole reason
   *  this is a variant here rather than a second component. */
  variant?: 'tabs' | 'stacked'
}

export function DetailTabList({
  formId, recordId, fields, schema, record, tabConfigs, onNavigateToRecord,
  nested, groupDepth = 0,
  rendererOverride,
  orientation = 'horizontal',
  variant = 'tabs',
}: DetailTabListProps) {
  const { t: translate } = useI18n()
  const viewer = useCurrentViewer()
  const configuredTabs = tabConfigs.filter((t) => !t.hidden && isTabVisible(t.visibility, viewer))
  const variables = schema ? schemaToVariableDecls(schema) : []
  const renderIfExpressions = configuredTabs
    .filter((t) => t.renderIf?.mode === 'expression' && !!t.renderIf.expressionWhen)
    .map((t) => ({ key: t.id, kind: 'visibleWhen' as const, expr: t.renderIf!.expressionWhen }))
  const renderIfResolved = useExpressionRuntimeState(renderIfExpressions, variables, record ?? {})
  // Deliberately `?? false`, not useExpressionRuntimeState's own field-level
  // DEFAULT_STATE.visible=true — a whole tab flashing in/out during the
  // 250ms debounce window (or staying visible on an invalid expression) is
  // more disruptive than a single field's visibility flickering, so a tab's
  // renderIf fails closed (hidden) until a real, resolved `true` comes back,
  // per FR-D2-015 §6's edge-case row for this exact scenario.
  const renderableTabs = configuredTabs.filter((t) => {
    if (t.renderIf?.mode !== 'expression' || !t.renderIf.expressionWhen) return true
    return renderIfResolved[t.id]?.visible ?? false
  })

  // hideWhenEmpty (related_form only, FR-D2-015 §3) can only resolve AFTER
  // that tab's own Renderer has fetched its data — unlike visibility/
  // renderIf, which are known before any tab-specific content mounts. Every
  // tab renders optimistically at first; a related_form tab configured with
  // hideWhenEmpty reports back via onEmptyResolved once its own existence
  // check settles, and is retroactively dropped from BOTH the trigger list
  // and the content below — a brief flash-then-hide, not a permanent gap,
  // and the only tradeoff of not being able to know "is it empty" before
  // that tab's own Renderer has had a chance to ask.
  const [emptyTabIds, setEmptyTabIds] = useState<Set<string>>(new Set())
  const visibleTabs = renderableTabs.filter((t) => !emptyTabIds.has(t.id))

  // t.label (when set) already comes back tc()-localized from
  // localizeFormSchema — only the registry's own fixed default (a platform
  // string keyed by tab type, not per-app content) needs a t() call here,
  // since resolving it needs this registry, which the lower-level
  // schema-only localize-schema.ts deliberately doesn't import.
  const labelFor = (t: DetailTabConfig) =>
    t.label || (getDetailTab(t.type) ? translate(`detail_tab.default_label.${t.type}`) : undefined) || t.type

  const onEmptyResolved = (id: string) => (empty: boolean) => {
    setEmptyTabIds((prev) => {
      if (empty === prev.has(id)) return prev
      const next = new Set(prev)
      if (empty) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const renderBody = (t: DetailTabConfig) => {
    const def = getDetailTab(t.type)
    if (!def) return null
    const Renderer = rendererOverride?.(t.type) ?? def.Renderer
    return (
      <Renderer
        formId={formId}
        recordId={recordId}
        fields={fields}
        schema={schema}
        config={def.parseConfig(t.config)}
        onNavigateToRecord={onNavigateToRecord}
        groupDepth={groupDepth}
        onEmptyResolved={onEmptyResolved(t.id)}
      />
    )
  }

  if (variant === 'stacked') {
    return (
      // type="multiple": each section (Attachments, Tags, ...) collapses
      // independently — opening one has no reason to close another in a
      // sidebar this short. defaultValue opens every section on first
      // render, matching this variant's pre-collapsible behavior exactly;
      // Radix only reads it once (uncontrolled), so nothing re-forces a
      // section open again after a viewer collapses it, for the lifetime
      // of this mount.
      <Accordion type="multiple" defaultValue={renderableTabs.map((t) => t.id)} className="p-4">
        {/* Same "every renderableTab mounts, emptiness only hides chrome"
           contract the tabs branch documents below. */}
        {renderableTabs.map((t) => (
          <AccordionItem key={t.id} value={t.id} style={emptyTabIds.has(t.id) ? { display: 'none' } : undefined}>
            <AccordionTrigger>{labelFor(t)}</AccordionTrigger>
            <AccordionContent>{renderBody(t)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    )
  }

  return (
    // Keyed on the resolved visible-tab-id list, not just formId — if a
    // renderIf expression resolves AFTER first paint (the debounced backend
    // round-trip) and changes which tabs are visible, the underlying Radix
    // Tabs' own internal "which value is active" state needs a fresh mount
    // to re-derive a valid defaultValue, or it can end up pointed at a tab
    // that no longer exists in the list.
    <Tabs
      key={visibleTabs.map((t) => t.id).join(',') || 'empty'}
      defaultValue={visibleTabs[0]?.id}
      orientation={nested ? undefined : orientation}
      className={cn(
        'flex',
        nested || orientation !== 'vertical' ? 'flex-col' : 'flex-row',
      )}
    >
      <div
        className={cn(
          nested ? '' : orientation === 'vertical' ? 'shrink-0 border-r px-3 py-4' : 'border-b px-6 py-2',
        )}
        style={nested ? undefined : { borderColor: 'hsl(var(--border))' }}
      >
        <TabsList>
          {visibleTabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>{labelFor(t)}</TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div className={nested ? undefined : 'p-6'}>
        {/* Every renderableTab mounts its Renderer (not just visibleTabs) so
           a hideWhenEmpty related_form tab's own existence-check query keeps
           running even while its trigger/content chrome is hidden — the
           moment new data makes it non-empty, it reappears without a
           second, separate polling mechanism. Chrome visibility
           (TabsTrigger above, and the wrapper div's display here) is the
           ONLY thing emptiness affects; the Renderer itself always mounts. */}
        {renderableTabs.map((t) => (
          <TabsContent
            key={t.id}
            value={t.id}
            forceMount
            style={emptyTabIds.has(t.id) ? { display: 'none' } : undefined}
          >
            {renderBody(t)}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}

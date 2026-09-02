// ---------------------------------------------------------------------------
// UI catalog builder — the generated half of the backend's /meta/catalog
// ---------------------------------------------------------------------------
//
// Menu types, custom actions, and detail tabs exist only in this frontend's
// registries: the backend stores their config as opaque JSON and never parses
// it, so it cannot derive a catalog for them by reflection the way it does
// for workflow nodes and field types. This module closes that gap by READING
// the live registries and emitting one JSON document, which the backend
// embeds (workflow-engine/api/meta/ui-catalog.json) and serves.
//
// The chain that keeps it honest, end to end:
//
//	1. Each registry contract REQUIRES configSchema — a new type cannot
//	   compile without describing itself (src/lib/config-schema.ts).
//	2. This builder ranges over the registries, so a registered type cannot
//	   be skipped.
//	3. src/lib/ui-catalog.gen.test.ts snapshots the output against the
//	   committed file — `npm test` FAILS when the file is stale, and
//	   `npm run gen:ui-catalog` regenerates it.
//	4. The backend embeds the file at compile time (go:embed), so a build
//	   cannot ship without it, and serves it verbatim.
//
// Enum completeness for the two plain unions is compile-enforced with
// Record<Union, ...> maps below — add a value to the union and this file
// fails to compile until its description exists.

// Side-effecting imports: each runs every registerX() call at module scope,
// exactly as the app's own entry points do.
import '@/features/forms/runtime/custom-actions'
import '@/features/forms/runtime/detail-tabs'
import '@/features/ui-workflows/nodes'
import '@/features/dashboard/widgets'

import { allCustomActions } from '@/features/forms/runtime/custom-actions/registry'
import { allWidgets } from '@/features/dashboard/widget-registry'
import { DASHBOARD_ENVELOPE_SCHEMA, WIDGET_INSTANCE_ENVELOPE_SCHEMA } from '@/features/dashboard/schema'
import { allDetailTabs } from '@/features/forms/runtime/detail-tabs/registry'
import { allUiWorkflowNodes } from '@/features/ui-workflows/node-registry'
import { UI_WORKFLOW_ENVELOPE_SCHEMA, UI_WORKFLOW_STEP_ENVELOPE_SCHEMA } from '@/features/ui-workflows/envelope'
import { MENU_TYPE_REGISTRY } from '@/features/menus/menu-registry'
import { COMPONENT_REGISTRY } from '@/features/form-builder/component-registry'
import {
  ADVANCED_SETTING_ACTION_DESCRIPTIONS,
  ADVANCED_SETTING_AUDIENCE_DESCRIPTIONS,
  ADVANCED_SETTING_OP_DESCRIPTIONS,
  COLUMN_LAYOUTS,
  CUSTOM_ACTION_ENVELOPE_SCHEMA,
  DETAIL_PAGE_LAYOUTS,
  DETAIL_TAB_ENVELOPE_SCHEMA,
  FORM_ELEMENT_ENVELOPE_SCHEMA,
  FORM_LAYOUT_ROOT_SCHEMA,
  FORM_SECTION_ENVELOPE_SCHEMA,
  type DetailTabOrientation,
} from '@/features/form-builder/schema'

/** Compile-enforced complete: adding a value to DetailTabOrientation fails
 *  this Record until its description is written. */
const TAB_ORIENTATION_DESCRIPTIONS: Record<DetailTabOrientation, string> = {
  horizontal: 'Top-level tab bar across the top. The default.',
  vertical: 'Top-level tab bar down the side. Nested group tabs stay horizontal regardless.',
}

/** Emits deprecated/replaced_by only when a type is actually retired, so
 *  the generated file (and its snapshot) is untouched until the first
 *  retirement happens. */
function retirement(d: { deprecated?: boolean; replacedBy?: string }) {
  if (!d.deprecated) return {}
  return { deprecated: true, replaced_by: d.replacedBy ?? '' }
}

export function buildUiCatalog() {
  const byType = <T extends { type: string }>(xs: T[]) =>
    [...xs].sort((a, b) => a.type.localeCompare(b.type))

  return {
    $comment:
      'GENERATED FILE - do not edit by hand. Source: workflow-engine-ui registries (src/lib/ui-catalog.ts). Regenerate with `npm run gen:ui-catalog` in workflow-engine-ui; `npm test` fails while this file is stale.',
    menu_types: byType(
      Object.values(MENU_TYPE_REGISTRY).map((e) => ({
        type: e.type,
        label: e.label,
        summary: e.description,
        config_schema: e.configSchema,
        ...retirement(e),
      })),
    ),
    custom_actions: byType(
      allCustomActions().map((d) => ({
        type: d.type,
        label: d.label,
        summary: d.description,
        config_schema: d.configSchema,
        ...retirement(d),
      })),
    ),
    detail_tabs: byType(
      allDetailTabs().map((d) => ({
        type: d.type,
        label: d.label,
        summary: d.description,
        builtin: d.builtin ?? false,
        config_schema: d.configSchema,
        ...retirement(d),
      })),
    ),
    detail_layouts: Object.entries(DETAIL_PAGE_LAYOUTS).map(([value, def]) => ({
      value,
      description: `${def.label}. Zones: ${def.zones.map((z) => z.id).join(', ')}. A tab's 'zone' must name one of these; absent means 'main'.`,
    })),
    tab_orientations: Object.entries(TAB_ORIENTATION_DESCRIPTIONS).map(([value, description]) => ({
      value,
      description,
    })),
    detail_tab_envelope: DETAIL_TAB_ENVELOPE_SCHEMA,
    custom_action_envelope: CUSTOM_ACTION_ENVELOPE_SCHEMA,
    // The UI-workflow vocabulary: node types plus the envelopes for the graph
    // itself. Client-side authored logic, so like menu types and detail tabs
    // it exists only in this frontend's registry — the backend stores it
    // inside an already-opaque config blob and never parses it, which is
    // exactly why it has to be published here to be authorable by an agent.
    // `platforms` is carried through because a node absent from a runtime must
    // be a design-time warning, never a silent no-op at runtime.
    ui_workflow_nodes: byType(
      allUiWorkflowNodes().map((n) => ({
        type: n.type,
        label: n.label,
        category: n.category,
        platforms: [...n.platforms],
        summary: n.description,
        config_schema: n.configSchema,
        // Which config keys hold NESTED STEP LISTS (a branch's then/else) —
        // what lets a consumer walk every step of a stored graph without
        // this frontend's childStepLists function.
        ...(n.childStepListKeys?.length ? { child_step_lists: [...n.childStepListKeys] } : {}),
        ...retirement(n),
      })),
    ),
    ui_workflow_envelope: UI_WORKFLOW_ENVELOPE_SCHEMA,
    ui_workflow_step_envelope: UI_WORKFLOW_STEP_ENVELOPE_SCHEMA,
    // The DASHBOARD vocabulary: every placeable widget off the widget
    // registry, plus the envelopes for the grid schema itself. Two surfaces
    // store that schema — a dashboard menu's config.schema and a detail
    // page's 'custom' tab — and both were catalog-invisible ("Opaque to the
    // backend") until this section, meaning an agent could not author either.
    // default_layout rides along so a generated dashboard starts with each
    // widget's intended tile size rather than arbitrary guesses.
    dashboards: {
      widgets: byType(
        allWidgets().map((w) => ({
          type: w.type,
          label: w.label,
          category: w.category,
          summary: w.description,
          config_schema: w.configSchema,
          default_layout: w.defaultLayout,
          default_chrome: w.defaultChrome,
        })),
      ),
      envelope: DASHBOARD_ENVELOPE_SCHEMA,
      widget_envelope: WIDGET_INSTANCE_ENVELOPE_SCHEMA,
    },
    // The form CANVAS vocabulary: every placeable component (straight off the
    // builder's own palette registry) plus the authoring envelopes for the
    // layout JSON — element, section, root — including per-element Advanced
    // Settings. This is what lets an agent author create_form/update_form's
    // `layout` argument instead of settling for the synthesized single-column
    // default. icon/configPanel are builder-internal and deliberately omitted.
    canvas: {
      components: byType(
        Object.values(COMPONENT_REGISTRY).map((c) => ({
          type: c.type,
          label: c.label,
          category: c.category,
          data_bearing: c.dataBearing,
          ...(c.fieldType ? { field_type: c.fieldType } : {}),
          summary: c.description,
        })),
      ),
      column_layouts: Object.entries(COLUMN_LAYOUTS).map(([value, def]) => ({
        value,
        description: `${def.label}. Column flex ratios: ${def.ratios.join(':')} — a section using this layout needs exactly ${def.ratios.length} column(s) with these ratios in order.`,
      })),
      layout_envelope: FORM_LAYOUT_ROOT_SCHEMA,
      section_envelope: FORM_SECTION_ENVELOPE_SCHEMA,
      element_envelope: FORM_ELEMENT_ENVELOPE_SCHEMA,
      advanced_setting_audiences: Object.entries(ADVANCED_SETTING_AUDIENCE_DESCRIPTIONS).map(
        ([value, description]) => ({ value, description }),
      ),
      advanced_setting_actions: Object.entries(ADVANCED_SETTING_ACTION_DESCRIPTIONS).map(
        ([value, description]) => ({ value, description }),
      ),
      advanced_setting_ops: Object.entries(ADVANCED_SETTING_OP_DESCRIPTIONS).map(
        ([value, description]) => ({ value, description }),
      ),
    },
  }
}

/** The exact bytes written to workflow-engine/api/meta/ui-catalog.json. */
export function buildUiCatalogJson(): string {
  return JSON.stringify(buildUiCatalog(), null, 2) + '\n'
}

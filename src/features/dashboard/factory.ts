import { nanoid } from 'nanoid'
import type { WidgetInstance, WidgetLayout } from './schema'
import { getWidget } from './widget-registry'

// Mirror of features/page-builder/factory.ts's createComponent/duplicateComponent
// — same structuredClone-based duplication with a fresh nanoid id.

/** Finds the first free row for a widget of the given width at the bottom of
 *  the stack (simple bottom-append placement for newly-added widgets — the
 *  canvas's compaction pass, not this factory, handles gap-filling on
 *  drag/resize). x is always 0; widths beyond one row are left to the user
 *  to reposition, keeping this placement logic trivial and predictable. */
function nextPlacement(existing: WidgetInstance[], w: number, h: number): WidgetLayout {
  const maxY = existing.reduce((max, inst) => Math.max(max, inst.layout.y + inst.layout.h), 0)
  return { x: 0, y: maxY, w, h }
}

/** Creates a new WidgetInstance of `type`, placed after any existing
 *  widgets. Throws if `type` isn't registered — callers (the toolbox drag
 *  source) only ever offer registered types, so this indicates a bug rather
 *  than user input to recover from. */
export function createWidget(type: string, existing: WidgetInstance[]): WidgetInstance {
  const def = getWidget(type)
  if (!def) throw new Error(`cannot create widget: type "${type}" is not registered`)
  const { w, h, minW, minH } = def.defaultLayout
  return {
    id: nanoid(),
    type,
    layout: { ...nextPlacement(existing, w, h), minW, minH },
    chrome: def.defaultChrome,
    config: def.createDefaultConfig(),
  }
}

/** Deep-clones a widget with a fresh id, offset one row down so it doesn't
 *  land exactly on top of the original. */
export function duplicateWidget(instance: WidgetInstance): WidgetInstance {
  return {
    ...structuredClone(instance),
    id: nanoid(),
    layout: { ...structuredClone(instance.layout), y: instance.layout.y + instance.layout.h },
  }
}

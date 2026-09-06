// Config shape for the 'connections' detail-tab type — an ERPNext-style
// grid of tiles, one per explicitly-configured relationship, grouped under
// named category headers. Unlike related_form (one relationship per tab
// instance), this type manages a LIST of relationships in one tab.
//
// Each entry's natural, stable identity is `${targetFormId}:${targetFieldName}`
// (the same relationship key related_form's own picker validates against) —
// no synthetic id is added, since this key is exactly what a human or an
// AI-authoring caller already has in hand to add/remove/look up one entry.

export interface ConnectionsEntry {
  /** The OTHER form this tile links to. */
  targetFormId: string
  /** A reference field ON the target form that points back at the owning
   *  form — the same relationship primitive related_form's schema uses. */
  targetFieldName: string
  /** Overrides the target form's name as the tile's title. */
  label?: string
  /** Groups this tile under a named section header. Omit to render the
   *  tile ungrouped (ungrouped tiles render first, with no header). */
  category?: string
  /** A Search-type menu (its config.form_id must equal targetFormId) to
   *  navigate to on click, with the relationship filter applied on top of
   *  that menu's own filter. Omit to fall back to an inline expandable
   *  table for this one connection — a Connections tab works with zero
   *  menu setup and upgrades per-tile once a menu is assigned. */
  targetMenuId?: string
  /** How the tile's "+" button creates a linked record.
   *   - 'dialog' (default when omitted): an inline modal, prefilled with
   *     the link, that never navigates away from the record being viewed.
   *   - 'page': navigates to the target form's full create page. That
   *     route has no prefill support — use this only for a target form too
   *     large/complex for a compact dialog.
   *   - 'off': no "+" button for this tile.
   */
  quickCreate?: 'dialog' | 'page' | 'off'
}

export interface ConnectionsTabConfig {
  connections: ConnectionsEntry[]
  /** Explicit category display order. A category used by some entry above
   *  but absent here is appended after the named ones, in the order it
   *  first appears in `connections`. */
  categoryOrder?: string[]
}

export function emptyConnectionsConfig(): ConnectionsTabConfig {
  return { connections: [] }
}

const QUICK_CREATE_MODES = new Set(['dialog', 'page', 'off'])

// Must never throw (the shared detail-tab contract's requirement) — a
// malformed or stale-shape config heals to its safest empty/skipped form
// rather than crashing the record-detail panel.
export function parseConnectionsConfig(raw: unknown): ConnectionsTabConfig {
  if (!raw || typeof raw !== 'object') return emptyConnectionsConfig()
  const r = raw as Partial<ConnectionsTabConfig>

  const seen = new Set<string>()
  const connections: ConnectionsEntry[] = []
  for (const rawEntry of Array.isArray(r.connections) ? r.connections : []) {
    if (!rawEntry || typeof rawEntry !== 'object') continue
    const e = rawEntry as Partial<ConnectionsEntry>
    if (typeof e.targetFormId !== 'string' || !e.targetFormId) continue
    if (typeof e.targetFieldName !== 'string' || !e.targetFieldName) continue
    const key = `${e.targetFormId}:${e.targetFieldName}`
    if (seen.has(key)) continue
    seen.add(key)
    connections.push({
      targetFormId: e.targetFormId,
      targetFieldName: e.targetFieldName,
      label: typeof e.label === 'string' && e.label ? e.label : undefined,
      category: typeof e.category === 'string' && e.category ? e.category : undefined,
      targetMenuId: typeof e.targetMenuId === 'string' && e.targetMenuId ? e.targetMenuId : undefined,
      quickCreate: typeof e.quickCreate === 'string' && QUICK_CREATE_MODES.has(e.quickCreate)
        ? (e.quickCreate as ConnectionsEntry['quickCreate'])
        : undefined,
    })
  }

  return {
    connections,
    categoryOrder: Array.isArray(r.categoryOrder)
      ? r.categoryOrder.filter((c): c is string => typeof c === 'string')
      : undefined,
  }
}

export function connectionKey(e: Pick<ConnectionsEntry, 'targetFormId' | 'targetFieldName'>): string {
  return `${e.targetFormId}:${e.targetFieldName}`
}

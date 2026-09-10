// Icon resolution for a workflow node, built-in or package — the single
// place that answers "what icon does this node type render with?", used by
// every surface that used to do its own two-step NODE_REGISTRY-then-fallback
// lookup (BaseNode, NodePalette, NodePickerModal, NodeConfigPanel).
//
// A package node has no compiled-in icon component — it isn't part of this
// bundle — so its manifest names one by a short kebab-case hint (e.g.
// "message-square") instead. ICON_HINTS below is a closed whitelist mapping
// that hint to a real lucide-react component, rather than a dynamic
// `lucide-react[hint]` lookup: the dynamic form defeats lucide-react's
// tree-shaking by pulling the entire icon set into the bundle for the sake
// of a handful of package-contributed icons. Extend this list as new
// packages need new icons; a hint absent here (or a node with none at all)
// falls back to Plug, same meaning it always had — "this node's behaviour
// isn't compiled into this bundle."
import { Plug, Hash, MessageSquare, type LucideIcon } from 'lucide-react'
import { NODE_REGISTRY } from './node-registry'
import type { NodeType } from '../types'

const ICON_HINTS: Record<string, LucideIcon> = {
  'hash': Hash,
  'message-square': MessageSquare,
}

/** Resolves the icon for any node type, built-in or package. A built-in
 *  type's own compiled-in icon always wins; a package type falls back to its
 *  manifest's icon_hint, then to Plug when the hint is absent or unknown to
 *  this build. */
export function iconFor(type: string, iconHint?: string): LucideIcon {
  const builtin = NODE_REGISTRY[type as NodeType]
  if (builtin) return builtin.icon
  return (iconHint && ICON_HINTS[iconHint]) || Plug
}

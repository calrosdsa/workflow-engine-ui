import { useMemo, useRef, useState } from 'react'
import { ChevronRight, Folder, FolderOpen, File, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveRecordTitle } from '@/features/forms/runtime/record-title'
import type { FieldDef, FormRecord } from '@/features/forms/types'
import type { TreeLayoutConfig } from '../types'

interface TreeLayoutProps {
  /** The form these records belong to — used only to namespace this tree's
   *  collapse-state persistence (see collapseStorageKey) so two different
   *  forms' trees never collide in sessionStorage. */
  formId: string
  records: FormRecord[]
  fields: FieldDef[]
  config: TreeLayoutConfig
  onOpenRecord: (r: FormRecord) => void
  loading?: boolean
}

interface TreeNode {
  record: FormRecord
  children: TreeNode[]
  /** True when this node's own parentField value is non-empty but doesn't
   *  resolve to a record in the current filtered/paged set. It still
   *  renders as a top-level item (see buildForest) — it isn't hidden — but
   *  it isn't a TRUE root either: a parent exists, it just isn't part of
   *  the current view. Surfaced as a small indicator rather than presented
   *  identically to a genuine root. */
  parentHidden: boolean
}

// Buckets each record under the record its parentField points at, then
// walks only from roots — a record whose parentField is empty, or points at
// an id not present in `records` (outside the current filtered/paged result
// set), is a root rather than hidden, per this layout's own spec. Every
// record lands in exactly one bucket (roots XOR one childrenOf[parentId]
// list, never both, since a record has a single parentField value), so the
// recursive walk below can never revisit the same record twice — a pure
// cycle among non-root records (A's parent is B, B's parent is A) simply
// has no root to be reached from and never renders, rather than needing an
// explicit visited-set guard against infinite recursion.
function buildForest(records: FormRecord[], parentField: string): TreeNode[] {
  const byId = new Map<string, FormRecord>()
  for (const r of records) byId.set(r.id as string, r)

  const childrenOf = new Map<string, FormRecord[]>()
  const roots: FormRecord[] = []
  const rootParentHidden = new Map<string, boolean>()
  for (const r of records) {
    const id = r.id as string
    const parentId = r[parentField] as string | null | undefined
    if (parentId && parentId !== id && byId.has(parentId)) {
      const list = childrenOf.get(parentId)
      if (list) list.push(r)
      else childrenOf.set(parentId, [r])
    } else {
      roots.push(r)
      rootParentHidden.set(id, !!parentId && parentId !== id)
    }
  }

  const build = (record: FormRecord, parentHidden: boolean): TreeNode => ({
    record,
    parentHidden,
    // A non-root's parent is, by construction, present (that's the only
    // reason it isn't a root) — parentHidden only ever applies to roots.
    children: (childrenOf.get(record.id as string) ?? []).map((c) => build(c, false)),
  })
  return roots.map((r) => build(r, rootParentHidden.get(r.id as string) ?? false))
}

/** Flat, depth-first, COLLAPSE-AWARE order of every currently visible node —
 *  the order a sighted user reads top to bottom, and the order ArrowUp/Down
 *  should follow. Recomputed whenever the forest or collapse state changes;
 *  cheap relative to the render it already accompanies. */
interface FlatEntry { id: string; parentId: string | null }
function flattenVisible(forest: TreeNode[], collapsed: Set<string>): FlatEntry[] {
  const out: FlatEntry[] = []
  const walk = (nodes: TreeNode[], parentId: string | null) => {
    for (const n of nodes) {
      const id = n.record.id as string
      out.push({ id, parentId })
      if (n.children.length > 0 && !collapsed.has(id)) walk(n.children, id)
    }
  }
  walk(forest, null)
  return out
}

function collapseStorageKey(formId: string, parentField: string) {
  return `impeccable-tree-collapsed:${formId}:${parentField}`
}

function loadCollapsed(formId: string, parentField: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(collapseStorageKey(formId, parentField))
    if (!raw) return new Set()
    const ids = JSON.parse(raw)
    return Array.isArray(ids) ? new Set(ids.filter((v): v is string => typeof v === 'string')) : new Set()
  } catch {
    // Private browsing, storage disabled, or corrupt JSON — a fresh,
    // fully-expanded tree is always a safe fallback, never a crash.
    return new Set()
  }
}

function saveCollapsed(formId: string, parentField: string, collapsed: Set<string>) {
  try {
    sessionStorage.setItem(collapseStorageKey(formId, parentField), JSON.stringify([...collapsed]))
  } catch {
    // Storage full or disabled — collapse state simply stops persisting,
    // which is a silent, harmless degradation (the tree still works).
  }
}

/** Shared per-render context every TreeRow reads, kept out of individual
 *  props so adding a new cross-cutting concern (a new keyboard command, a
 *  new per-row affordance) touches one object instead of every call site
 *  between here and the leaf rows. */
interface TreeRowContext {
  fields: FieldDef[]
  groupFieldDef?: FieldDef
  collapsed: Set<string>
  onToggle: (id: string) => void
  onOpenRecord: (r: FormRecord) => void
  registerRef: (id: string) => (el: HTMLDivElement | null) => void
  moveFocus: (fromId: string, direction: 'next' | 'prev' | 'parent' | 'firstChild') => void
  /** Records which treeitem last received focus — by a keyboard move
   *  (moveFocus already calls this internally) or by a plain mouse click /
   *  Tab landing directly on a row. Only ever narrows the roving tabindex
   *  to the one row that actually has focus; never moves focus itself. */
  onRowFocus: (id: string) => void
  focusedId: string
  /** Gates the expand/collapse reveal animation — false for the initial,
   *  everything-open render (a fade sweeping the whole tree on first paint
   *  would be page-load choreography, not feedback for an action), true
   *  from the first real toggle onward, since every group mount after that
   *  point is, by construction, a direct result of something the viewer
   *  just did. */
  hasInteracted: boolean
}

// Standard indented tree list: parentField edges determine structure,
// groupField (if set) only picks the icon — see TreeLayoutConfig's own doc
// comment. Consumes the same paginated records array Card/Calendar render
// from (RecordsTable's shared searchRecords query), not a separate
// unbounded fetch of its own, so a very large hierarchy is only ever built
// from whatever page/filter is currently active — consistent with those two
// layouts' existing behavior, not a new limitation this one introduces.
//
// Implements the WAI-ARIA treeview keyboard pattern (role=tree/treeitem/
// group, roving tabindex, Arrow keys) rather than a flat sequence of
// independently-tabbable buttons — see moveFocus/flattenVisible below.
export function TreeLayout({ formId, records, fields, config, onOpenRecord, loading }: TreeLayoutProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed(formId, config.parentField))
  const [hasInteracted, setHasInteracted] = useState(false)
  const [focusedId, setFocusedId] = useState<string | undefined>(undefined)
  const refs = useRef(new Map<string, HTMLDivElement>())

  const groupFieldDef = config.groupField
    ? fields.find((f) => f.name === config.groupField && f.type === 'boolean')
    : undefined

  const forest = useMemo(() => buildForest(records, config.parentField), [records, config.parentField])
  const flatVisible = useMemo(() => flattenVisible(forest, collapsed), [forest, collapsed])
  const allParentIds = useMemo(() => {
    const ids: string[] = []
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) { ids.push(n.record.id as string); walk(n.children) }
      }
    }
    walk(forest)
    return ids
  }, [forest])

  const applyCollapsed = (next: Set<string>) => {
    setCollapsed(next)
    saveCollapsed(formId, config.parentField, next)
  }
  const toggle = (id: string) => {
    setHasInteracted(true)
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    applyCollapsed(next)
  }
  const expandAll = () => { setHasInteracted(true); applyCollapsed(new Set()) }
  const collapseAll = () => { setHasInteracted(true); applyCollapsed(new Set(allParentIds)) }

  const registerRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) refs.current.set(id, el)
    else refs.current.delete(id)
  }
  const moveFocus = (fromId: string, direction: 'next' | 'prev' | 'parent' | 'firstChild') => {
    const idx = flatVisible.findIndex((e) => e.id === fromId)
    if (idx === -1) return
    let targetId: string | undefined
    if (direction === 'next') targetId = flatVisible[idx + 1]?.id
    else if (direction === 'prev') targetId = flatVisible[idx - 1]?.id
    else if (direction === 'parent') targetId = flatVisible[idx].parentId ?? undefined
    else if (direction === 'firstChild') {
      const next = flatVisible[idx + 1]
      targetId = next && next.parentId === fromId ? next.id : undefined
    }
    if (!targetId) return
    setFocusedId(targetId)
    refs.current.get(targetId)?.focus()
  }

  if (loading) {
    return <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading…</div>
  }
  if (records.length === 0) {
    return <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>No records match this view.</div>
  }

  const effectiveFocusedId = focusedId ?? flatVisible[0]?.id ?? ''
  const ctx: TreeRowContext = { fields, groupFieldDef, collapsed, onToggle: toggle, onOpenRecord, registerRef, moveFocus, onRowFocus: setFocusedId, focusedId: effectiveFocusedId, hasInteracted }

  return (
    <div className="flex flex-col gap-1 p-3 text-sm">
      {allParentIds.length > 0 && (
        <div className="mb-1 flex items-center gap-1 px-1.5">
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={expandAll}>Expand all</Button>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={collapseAll}>Collapse all</Button>
        </div>
      )}
      <div role="tree" aria-label="Record hierarchy" className="flex flex-col gap-0.5">
        {forest.map((node, i) => (
          <TreeRow key={node.record.id as string} node={node} depth={0} posinset={i + 1} setsize={forest.length} ctx={ctx} />
        ))}
      </div>
    </div>
  )
}

function TreeRow({ node, depth, posinset, setsize, ctx }: {
  node: TreeNode
  depth: number
  posinset: number
  setsize: number
  ctx: TreeRowContext
}) {
  const { fields, groupFieldDef, collapsed, onToggle, onOpenRecord, registerRef, moveFocus, onRowFocus, focusedId, hasInteracted } = ctx
  const id = node.record.id as string
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsed.has(id)
  const title = resolveRecordTitle(fields, node.record)
  // groupField is purely presentational (see TreeLayoutConfig) — a value of
  // true always earns a folder-family icon, even if this node currently has
  // no children (an intentionally-flagged, momentarily-empty group still
  // reads as a folder, not a contradiction). A STRUCTURAL parent always
  // earns one too, regardless of the flag — hasChildren is ground truth
  // that overrides a stale or never-set flag; the alternative (a node that
  // expands into more nodes wearing a leaf icon) is the worse
  // contradiction. Only when neither signal says "container" does this
  // fall back to a plain leaf.
  const isGroup = hasChildren || (groupFieldDef ? node.record[groupFieldDef.name] === true : false)
  const FolderIcon = isCollapsed ? Folder : FolderOpen
  const isFocused = focusedId === id

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        onOpenRecord(node.record)
        break
      case 'ArrowRight':
        e.preventDefault()
        if (hasChildren) { if (isCollapsed) onToggle(id); else moveFocus(id, 'firstChild') }
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (hasChildren && !isCollapsed) onToggle(id)
        else moveFocus(id, 'parent')
        break
      case 'ArrowDown':
        e.preventDefault()
        moveFocus(id, 'next')
        break
      case 'ArrowUp':
        e.preventDefault()
        moveFocus(id, 'prev')
        break
    }
  }

  return (
    <div>
      <div
        ref={registerRef(id)}
        role="treeitem"
        aria-expanded={hasChildren ? !isCollapsed : undefined}
        aria-level={depth + 1}
        aria-setsize={setsize}
        aria-posinset={posinset}
        tabIndex={isFocused ? 0 : -1}
        onFocus={() => onRowFocus(id)}
        onClick={() => onOpenRecord(node.record)}
        onKeyDown={handleKeyDown}
        className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 outline-none hover:bg-[hsl(var(--accent))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        style={{ paddingLeft: `${depth * 20 + 6}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={(e) => { e.stopPropagation(); onToggle(id) }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-[hsl(var(--muted))]"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            <ChevronRight
              size={12}
              className={`transition-transform duration-150 ease-out motion-reduce:transition-none ${isCollapsed ? '' : 'rotate-90'}`}
            />
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}
        {isGroup
          ? <FolderIcon size={14} className="shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
          : <File size={14} className="shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />}
        <span className="truncate" title={title}>{title}</span>
        {node.parentHidden && (
          <span className="shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} title="This record's parent isn't included in the current view — shown here as a top-level item, not a true root.">
            <Unlink size={11} aria-hidden="true" />
            <span className="sr-only">, parent not shown in this view</span>
          </span>
        )}
      </div>
      {hasChildren && !isCollapsed && (
        <div role="group" className={hasInteracted ? 'animate-in fade-in-0 motion-reduce:animate-none' : undefined}>
          {node.children.map((child, i) => (
            <TreeRow key={child.record.id as string} node={child} depth={depth + 1} posinset={i + 1} setsize={node.children.length} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen, File } from 'lucide-react'
import { resolveRecordTitle } from '@/features/forms/runtime/record-title'
import type { FieldDef, FormRecord } from '@/features/forms/types'
import type { TreeLayoutConfig } from '../types'

interface TreeLayoutProps {
  records: FormRecord[]
  fields: FieldDef[]
  config: TreeLayoutConfig
  onOpenRecord: (r: FormRecord) => void
  loading?: boolean
}

interface TreeNode {
  record: FormRecord
  children: TreeNode[]
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
  for (const r of records) {
    const id = r.id as string
    const parentId = r[parentField] as string | null | undefined
    if (parentId && parentId !== id && byId.has(parentId)) {
      const list = childrenOf.get(parentId)
      if (list) list.push(r)
      else childrenOf.set(parentId, [r])
    } else {
      roots.push(r)
    }
  }

  const build = (record: FormRecord): TreeNode => ({
    record,
    children: (childrenOf.get(record.id as string) ?? []).map(build),
  })
  return roots.map(build)
}

// Standard indented tree list: parentField edges determine structure,
// groupField (if set) only picks the icon — see TreeLayoutConfig's own doc
// comment. Consumes the same paginated records array Card/Calendar render
// from (RecordsTable's shared searchRecords query), not a separate
// unbounded fetch of its own, so a very large hierarchy is only ever built
// from whatever page/filter is currently active — consistent with those two
// layouts' existing behavior, not a new limitation this one introduces.
export function TreeLayout({ records, fields, config, onOpenRecord, loading }: TreeLayoutProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const groupFieldDef = config.groupField
    ? fields.find((f) => f.name === config.groupField && f.type === 'boolean')
    : undefined

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading…</div>
  }
  if (records.length === 0) {
    return <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>No records match this view.</div>
  }

  const forest = buildForest(records, config.parentField)

  return (
    <div className="flex flex-col gap-0.5 p-3 text-sm">
      {forest.map((node) => (
        <TreeRow
          key={node.record.id as string}
          node={node}
          depth={0}
          fields={fields}
          groupFieldDef={groupFieldDef}
          collapsed={collapsed}
          onToggle={toggle}
          onOpenRecord={onOpenRecord}
        />
      ))}
    </div>
  )
}

function TreeRow({ node, depth, fields, groupFieldDef, collapsed, onToggle, onOpenRecord }: {
  node: TreeNode
  depth: number
  fields: FieldDef[]
  groupFieldDef?: FieldDef
  collapsed: Set<string>
  onToggle: (id: string) => void
  onOpenRecord: (r: FormRecord) => void
}) {
  const id = node.record.id as string
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsed.has(id)
  const title = resolveRecordTitle(fields, node.record)
  // groupField is purely presentational (see TreeLayoutConfig) — when set,
  // its own value picks the icon regardless of whether this node actually
  // has children; when unset, the only sensible fallback is the node's real
  // structural shape.
  const isGroup = groupFieldDef ? node.record[groupFieldDef.name] === true : hasChildren
  const Icon = !isGroup ? File : isCollapsed ? Folder : FolderOpen

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-[hsl(var(--accent))]"
        style={{ paddingLeft: `${depth * 20 + 6}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(id)}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-[hsl(var(--muted))]"
            style={{ color: 'hsl(var(--muted-foreground))' }}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        <Icon size={14} className="shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
        <button
          type="button"
          onClick={() => onOpenRecord(node.record)}
          className="truncate text-left hover:underline"
          style={{ color: 'hsl(var(--foreground))' }}
        >
          {title}
        </button>
      </div>
      {hasChildren && !isCollapsed && node.children.map((child) => (
        <TreeRow
          key={child.record.id as string}
          node={child}
          depth={depth + 1}
          fields={fields}
          groupFieldDef={groupFieldDef}
          collapsed={collapsed}
          onToggle={onToggle}
          onOpenRecord={onOpenRecord}
        />
      ))}
    </div>
  )
}

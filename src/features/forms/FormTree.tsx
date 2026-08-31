import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Database, MoreHorizontal, ListTree, Table2, Link2, Unlink } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useCopyForm, useUnlinkForm, useDeleteForm, useUnlinkSharedForm } from './hooks'
import { ShareSettingsDialog } from './ShareSettingsDialog'
import { AddDependentFormDialog } from './AddDependentFormDialog'
import type { FormDefinition } from './types'

interface TreeNode {
  form: FormDefinition
  children: TreeNode[]
}

/** Groups a flat forms[] list into a parent/child tree by parent_form_id.
 *  A form whose parent_form_id points at a missing/deleted form is treated
 *  as a root — never dropped, so nothing silently disappears from the view. */
function buildTree(forms: FormDefinition[]): TreeNode[] {
  const byId = new Map(forms.map((f) => [f.id, f]))
  const childrenOf = new Map<string, FormDefinition[]>()
  const roots: FormDefinition[] = []

  for (const form of forms) {
    if (form.parent_form_id && byId.has(form.parent_form_id)) {
      const list = childrenOf.get(form.parent_form_id) ?? []
      list.push(form)
      childrenOf.set(form.parent_form_id, list)
    } else {
      roots.push(form)
    }
  }

  const toNode = (form: FormDefinition): TreeNode => ({
    form,
    children: (childrenOf.get(form.id) ?? []).map(toNode),
  })

  return roots.map(toNode)
}

interface FormTreeProps {
  appId: string
  appName: string
  forms: FormDefinition[]
  canWrite: boolean
}

// Every row (app box's children and each FormNode's own children) is a fixed
// 45.6px-tall card in a `flex flex-col gap-2` list — see the shared row
// classes below. ROW_HEIGHT/ROW_GAP let the trunk connector compute exactly
// where each row's vertical center falls without needing a DOM measurement
// pass, so the line lands correctly however many rows there are.
const ROW_HEIGHT = 45.6
const ROW_GAP = 8
const ROW_CENTER = ROW_HEIGHT / 2

export function FormTree({ appId, appName, forms, canWrite }: FormTreeProps) {
  const tree = useMemo(() => buildTree(forms), [forms])

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-8">
      <div className="flex shrink-0 items-center">
        <div className="flex h-20 w-40 shrink-0 flex-col items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-center shadow-sm">
          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{appName}</span>
        </div>
      </div>

      {tree.length > 0 && <TreeTrunk count={tree.length} />}

      <div className="flex flex-col gap-2">
        {tree.map((node) => (
          <FormNode key={node.form.id} appId={appId} node={node} canWrite={canWrite} />
        ))}
      </div>
    </div>
  )
}

/** The connector between a parent (app box or a FormNode) and its list of
 *  children: one continuous vertical trunk running from the first child's
 *  center to the last child's center, plus a horizontal tick into each
 *  child. Replaces the old per-row stub, which only ever drew a short
 *  segment centered on its own row — with no continuous vertical line
 *  behind it, the connector visually broke after the first couple of rows
 *  instead of spanning the whole list. */
function TreeTrunk({ count }: { count: number }) {
  const totalHeight = count * ROW_HEIGHT + (count - 1) * ROW_GAP

  return (
    <div className="relative w-6 shrink-0" style={{ height: totalHeight }}>
      {count > 1 && (
        <div
          className="absolute left-0 w-px bg-[hsl(var(--border))]"
          style={{ top: ROW_CENTER, height: totalHeight - ROW_HEIGHT }}
        />
      )}
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 h-px w-6 bg-[hsl(var(--border))]"
          style={{ top: i * (ROW_HEIGHT + ROW_GAP) + ROW_CENTER }}
        />
      ))}
    </div>
  )
}

function FormNode({ appId, node, canWrite }: { appId: string; node: TreeNode; canWrite: boolean }) {
  const { form, children } = node
  const [shareOpen, setShareOpen] = useState(false)
  const [addDependentOpen, setAddDependentOpen] = useState(false)
  const copyMutation = useCopyForm()
  const unlinkMutation = useUnlinkForm()
  const deleteMutation = useDeleteForm()
  const unlinkSharedMutation = useUnlinkSharedForm()

  // A form borrowed from another app (see api/forms/links.go). This app may
  // use its records under the owner's grant, but the DEFINITION belongs to
  // the owner: editing, sharing, deleting and adding dependents are all the
  // owner's business, so this menu offers none of them. (The server would
  // reject most of them anyway — this is so the menu doesn't offer actions
  // that only fail.)
  const isLinked = form.is_linked === true
  const isReadOnlyLink = isLinked && form.visibility === 'read_only'

  return (
    <div className="flex items-start gap-0">
      {/* Height is pinned to ROW_HEIGHT rather than derived from padding so
          the trunk connector's arithmetic is true by construction. A row with
          a second line of text (a description, or a linked form's origin)
          measured 57.6px against the constant's assumed 45.6, which drifted
          every tick below it — latent for described forms, and reliable once
          linked forms began always carrying a second line. */}
      <div
        style={{ height: ROW_HEIGHT }}
        className="group flex w-72 shrink-0 items-center gap-2 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 shadow-sm transition-colors hover:border-[hsl(var(--primary))]/40"
      >
        {isLinked ? (
          <Link2
            size={15}
            className="shrink-0 text-[hsl(var(--muted-foreground))]"
            aria-label="Shared from another app"
          />
        ) : (
          <Database size={15} className="shrink-0 text-[hsl(var(--primary))]" />
        )}
        <Link
          to="/applications/$appId/forms/$formId"
          params={{ appId, formId: form.id }}
          className="min-w-0 flex-1"
        >
          <p className="truncate text-[13px] font-medium text-[hsl(var(--foreground))]">{form.name}</p>
          {isLinked ? (
            <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
              Shared from another app{isReadOnlyLink ? ' · read only' : ''}
            </p>
          ) : form.description ? (
            <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">{form.description}</p>
          ) : null}
        </Link>

        <Link
          to="/applications/$appId/forms/$formId/records"
          params={{ appId, formId: form.id }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
          title="View records"
        >
          <Table2 size={14} />
        </Link>

        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] opacity-0 hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] group-hover:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-[hsl(var(--muted))]"
                title="Form actions"
              >
                <MoreHorizontal size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isLinked ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/applications/$appId/forms/$formId/records" params={{ appId, formId: form.id }} className="flex items-center gap-2">
                      View Records
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    destructive
                    onClick={() => unlinkSharedMutation.mutate(form.id)}
                    disabled={unlinkSharedMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Unlink size={13} /> Remove from This App
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => setAddDependentOpen(true)} className="flex items-center gap-2">
                    <ListTree size={13} /> Add Dependent Form
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/applications/$appId/forms/$formId" params={{ appId, formId: form.id }} className="flex items-center gap-2">
                      Edit This Form
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/applications/$appId/forms/$formId/records" params={{ appId, formId: form.id }} className="flex items-center gap-2">
                      View Records
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copyMutation.mutate(form.id)} disabled={copyMutation.isPending}>
                    Copy Form
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    destructive
                    onClick={() => {
                      if (confirm(`Delete "${form.name}"? This cannot be undone.`)) deleteMutation.mutate(form.id)
                    }}
                  >
                    Delete This Form
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShareOpen(true)}>
                    Share Settings
                  </DropdownMenuItem>
                  {form.parent_form_id && (
                    <DropdownMenuItem
                      onClick={() => unlinkMutation.mutate(form.id)}
                      disabled={unlinkMutation.isPending}
                    >
                      Unlink Dependent Form
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {children.length > 0 && <TreeTrunk count={children.length} />}

      {children.length > 0 && (
        <div className="flex flex-col gap-2">
          {children.map((child) => (
            <FormNode key={child.form.id} appId={appId} node={child} canWrite={canWrite} />
          ))}
        </div>
      )}

      {/* Both are owner-only actions, and neither is reachable from a linked
          form's menu — not mounting them keeps a borrowed row from holding a
          Share Settings dialog whose endpoint would 404 for this app. */}
      {!isLinked && (
        <>
          <ShareSettingsDialog formId={form.id} open={shareOpen} onOpenChange={setShareOpen} />
          <AddDependentFormDialog defaultParentId={form.id} open={addDependentOpen} onOpenChange={setAddDependentOpen} />
        </>
      )}
    </div>
  )
}

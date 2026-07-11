import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Database, MoreHorizontal, ListTree, Table2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useCopyForm, useUnlinkForm, useDeleteForm } from './hooks'
import { ShareFormDialog } from './ShareFormDialog'
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
  appName: string
  forms: FormDefinition[]
  canWrite: boolean
}

export function FormTree({ appName, forms, canWrite }: FormTreeProps) {
  const tree = useMemo(() => buildTree(forms), [forms])

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-8">
      <div className="flex shrink-0 items-center">
        <div className="flex h-20 w-40 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-center shadow-sm">
          <span className="text-sm font-semibold text-slate-800">{appName}</span>
        </div>
        {tree.length > 0 && <div className="h-px w-6 shrink-0 bg-slate-300" />}
      </div>

      <div className="flex flex-col gap-2">
        {tree.map((node) => (
          <FormNode key={node.form.id} node={node} canWrite={canWrite} depth={0} />
        ))}
      </div>
    </div>
  )
}

function FormNode({ node, canWrite, depth }: { node: TreeNode; canWrite: boolean; depth: number }) {
  const { form, children } = node
  const [shareOpen, setShareOpen] = useState(false)
  const copyMutation = useCopyForm()
  const unlinkMutation = useUnlinkForm()
  const deleteMutation = useDeleteForm()

  return (
    <div className="flex items-start gap-0">
      <div className="flex flex-col justify-center self-stretch">
        <div className="h-1/2" />
        {depth > 0 && <div className="h-px w-6 shrink-0 self-center bg-slate-300" />}
      </div>

      <div className="flex flex-col gap-2">
        <div className="group flex w-72 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-indigo-300">
          <Database size={15} className="shrink-0 text-indigo-500" />
          <Link
            to="/forms/$formId"
            params={{ formId: form.id }}
            className="min-w-0 flex-1"
          >
            <p className="truncate text-[13px] font-medium text-slate-800">{form.name}</p>
            {form.description && (
              <p className="truncate text-[11px] text-slate-400">{form.description}</p>
            )}
          </Link>

          <Link
            to="/forms/$formId/records"
            params={{ formId: form.id }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="View records"
          >
            <Table2 size={14} />
          </Link>

          {canWrite && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-slate-100"
                  title="Form actions"
                >
                  <MoreHorizontal size={15} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/forms/new" search={{ parentFormId: form.id }} className="flex items-center gap-2">
                    <ListTree size={13} /> Add Dependent Form
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/forms/$formId" params={{ formId: form.id }} className="flex items-center gap-2">
                    Edit This Form
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/forms/$formId/records" params={{ formId: form.id }} className="flex items-center gap-2">
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
                  Share This Form In Other Apps
                </DropdownMenuItem>
                {form.parent_form_id && (
                  <DropdownMenuItem
                    onClick={() => unlinkMutation.mutate(form.id)}
                    disabled={unlinkMutation.isPending}
                  >
                    Unlink Dependent Form
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {children.length > 0 && (
          <div className="flex flex-col gap-2 pl-0">
            {children.map((child) => (
              <FormNode key={child.form.id} node={child} canWrite={canWrite} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>

      <ShareFormDialog formId={form.id} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  )
}

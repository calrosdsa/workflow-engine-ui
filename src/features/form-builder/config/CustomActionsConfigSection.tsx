// "Custom Actions" section of the Form Builder's Form Settings panel
// (FR-D2-017) — add/reorder/remove/configure the actions RecordDetailToolbar
// renders in its "..." menu for this form's record-detail view. Structurally
// the same "pick a type from a registry, then configure it" flow
// DetailPageConfigSection.tsx already establishes for tabs — order is plain
// array order with up/down controls rather than full drag-and-drop, since
// FR-D2-017 §3 explicitly doesn't require reordering to be the more heavyweight
// dnd-kit flow tabs use (no ordering semantics beyond "menu item order").
import { useState } from 'react'
import { ChevronUp, ChevronDown, Trash2, Plus, Users2, GitBranch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { nanoid } from '@/features/workflows/builder/nanoid'
import { allCustomActions, getCustomAction } from '@/features/forms/runtime/custom-actions/registry'
import '@/features/forms/runtime/custom-actions'
import { TabVisibilitySection, TabRenderIfSection } from '@/features/forms/runtime/detail-tabs/DetailTabConfigForm'
import { cn } from '@/lib/utils'
import type { CustomActionConfig, FormSchema } from '../schema'

interface CustomActionsConfigSectionProps {
  formId: string
  schema: FormSchema
  customActions: CustomActionConfig[] | undefined
  onChange: (next: CustomActionConfig[]) => void
}

export function CustomActionsConfigSection({ formId, schema, customActions, onChange }: CustomActionsConfigSectionProps) {
  const actions = customActions ?? []
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const patchAction = (id: string, patch: Partial<CustomActionConfig>) =>
    onChange(actions.map((a) => (a.id === id ? { ...a, ...patch } : a)))

  const removeAction = (id: string) => {
    onChange(actions.filter((a) => a.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= actions.length) return
    const next = [...actions]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const addAction = (type: string) => {
    const def = getCustomAction(type)
    if (!def) return
    const newAction: CustomActionConfig = { id: nanoid(), type, label: def.label, config: def.createDefaultConfig() }
    onChange([...actions, newAction])
    setExpandedId(newAction.id)
  }

  return (
    <div className="space-y-3">
      {actions.length === 0 ? (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No custom actions configured yet.</p>
      ) : (
        <Accordion
          type="single"
          collapsible
          value={expandedId ?? ''}
          onValueChange={(v) => setExpandedId(v || null)}
          className="flex flex-col gap-2"
        >
          {actions.map((a, i) => (
            <CustomActionRow
              key={a.id}
              formId={formId}
              schema={schema}
              action={a}
              index={i}
              count={actions.length}
              onMove={(dir) => move(i, dir)}
              onRemove={() => removeAction(a.id)}
              onPatch={(patch) => patchAction(a.id, patch)}
            />
          ))}
        </Accordion>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[hsl(var(--border))] py-2 text-[12px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
          >
            <Plus size={13} /> Add Action
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-72">
          {allCustomActions().map((def) => (
            <DropdownMenuItem key={def.type} onClick={() => addAction(def.type)} className="items-start gap-2.5 py-2">
              <def.icon size={15} className="mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium text-[hsl(var(--foreground))]">{def.label}</span>
                <span className="block truncate text-[11px] text-[hsl(var(--muted-foreground))]">{def.description}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function CustomActionRow({ formId, schema, action, index, count, onMove, onRemove, onPatch }: {
  formId: string
  schema: FormSchema
  action: CustomActionConfig
  index: number
  count: number
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onPatch: (patch: Partial<CustomActionConfig>) => void
}) {
  const def = getCustomAction(action.type)
  const isConditional = action.renderIf?.mode === 'expression'
  const hasCustomVisibility = (action.visibility?.mode ?? 'everyone') !== 'everyone'

  return (
    <AccordionItem
      value={action.id}
      className="overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
    >
      <div className="flex items-center gap-1.5 pl-1 pr-2">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title="Move up"
            className="rounded p-0.5 text-[hsl(var(--muted-foreground))]/60 hover:text-[hsl(var(--muted-foreground))] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            title="Move down"
            className="rounded p-0.5 text-[hsl(var(--muted-foreground))]/60 hover:text-[hsl(var(--muted-foreground))] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronDown size={12} />
          </button>
        </div>

        <AccordionTrigger className="min-w-0 flex-1 gap-2 py-2.5 text-left normal-case tracking-normal text-[hsl(var(--foreground))] hover:text-[hsl(var(--foreground))]">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {def && <def.icon size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />}
            <span className={cn('truncate text-[13px] font-medium')}>{action.label || def?.label || action.type}</span>
            <span className="flex shrink-0 items-center gap-1">
              {hasCustomVisibility && (
                <Badge variant="outline" className="h-5 gap-0.5 px-1.5 py-0 text-[9.5px] font-medium normal-case tracking-normal text-[hsl(var(--muted-foreground))]">
                  <Users2 size={9} /> Restricted
                </Badge>
              )}
              {isConditional && (
                <Badge variant="outline" className="h-5 gap-0.5 px-1.5 py-0 text-[9.5px] font-medium normal-case tracking-normal text-[hsl(var(--muted-foreground))]">
                  <GitBranch size={9} /> Conditional
                </Badge>
              )}
            </span>
          </span>
        </AccordionTrigger>

        <button
          type="button"
          onClick={onRemove}
          title="Remove action"
          className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <AccordionContent className="border-t border-[hsl(var(--border))] px-3 pb-0 pt-3.5">
        {def && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Label</Label>
              <Input
                value={action.label}
                onChange={(e) => onPatch({ label: e.target.value })}
                placeholder={def.label}
                className="h-8 text-sm"
              />
            </div>

            <def.ConfigPanel
              config={def.parseConfig(action.config)}
              onChange={(config) => onPatch({ config })}
              formId={formId}
              schema={schema}
            />

            <TabVisibilitySection
              visibility={action.visibility}
              onChange={(visibility) => onPatch({ visibility })}
              itemLabel="action"
            />

            <TabRenderIfSection
              renderIf={action.renderIf}
              onChange={(renderIf) => onPatch({ renderIf })}
              itemLabel="action"
            />
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

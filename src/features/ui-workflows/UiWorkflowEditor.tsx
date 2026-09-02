// ---------------------------------------------------------------------------
// The UI workflow step editor
// ---------------------------------------------------------------------------
//
// A LINEAR STEP LIST, not a DAG canvas — the shape the stored graph already
// has. The workflow builder's canvas carries a minimap, wave semantics, edge
// routing and variable declarations, none of which apply to a sequence that
// runs one step at a time; most UI logic is four steps long and reads top to
// bottom, so a list is both cheaper and a better fit.
//
// THIS IS THE ONLY COMPONENT THAT RECURSES. A branching node's child lists are
// rendered from the registry's childStepLabels/setChildStepList rather than by
// the node's own panel, so a new branching type becomes editable without
// touching this file, and no node file has to import the editor that imports
// it.
//
// Reordering is up/down buttons, matching CustomActionsConfigSection and the
// detail-tab list rather than introducing drag-and-drop for a list that is
// usually shorter than five items and can nest.
import { useState } from 'react'
import { ChevronDown, ChevronUp, Code2, GripVertical, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
// Side-effecting: registers every node type. See interpreter.ts's note — this
// is the authoring half of the same requirement.
import './nodes'
import { getUiWorkflowNode, selectableUiWorkflowNodes, graphPlatforms } from './node-registry'
import { validateUiWorkflow } from './parse'
import { UiWorkflowJsonEditor } from './UiWorkflowJsonEditor'
import { UI_WORKFLOW_VERSION, type UiWorkflow, type UiWorkflowStep } from './types'
import type { FieldDef } from '@/features/forms/types'

export interface UiWorkflowEditorProps {
  value: UiWorkflow
  onChange: (next: UiWorkflow) => void
  /** Fields of the form this workflow hangs off, for condition builders and
   *  field pickers. */
  fields?: FieldDef[]
  /** One line about WHEN these steps run — differs per trigger, and is
   *  exactly what an author guesses wrong. */
  help?: string
}

export function UiWorkflowEditor({ value, onChange, fields = [], help }: UiWorkflowEditorProps) {
  // JSON stays reachable rather than being replaced by the step list. It is
  // the only way to edit a step type this build doesn't have a panel for, the
  // fastest way to paste a graph an agent produced, and the honest answer when
  // the list UI can't express something yet.
  const [asJson, setAsJson] = useState(false)
  const problems = validateUiWorkflow(value)
  const platforms = graphPlatforms(value.steps)

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        {help ? <p className="text-[12px] text-[hsl(var(--muted-foreground))]">{help}</p> : <span />}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAsJson((j) => !j)}
          className="h-6 shrink-0 gap-1 text-[11px]"
        >
          <Code2 size={11} />{asJson ? 'Steps' : 'JSON'}
        </Button>
      </div>

      {asJson ? (
        <UiWorkflowJsonEditor value={value} onChange={onChange} label="Steps (JSON)" />
      ) : (
        <StepList
          steps={value.steps}
          fields={fields}
          onChange={(steps) => onChange({ version: value.version || UI_WORKFLOW_VERSION, steps })}
        />
      )}

      {/* Only problems that aren't already obvious on screen. "This workflow
          has no steps" is redundant next to an empty list saying so. */}
      {problems.filter((p) => p.code !== 'empty').map((p, i) => (
        <p key={i} className="flex items-start gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          {p.message}
        </p>
      ))}

      {value.steps.length > 0 && (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
          {/* A graph is only as portable as its least portable step, so this is
              the intersection rather than a per-step list. */}
          Runs on: {platforms.length > 0 ? platforms.join(', ') : 'nothing — one of these steps runs nowhere'}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

interface StepListProps {
  steps: UiWorkflowStep[]
  fields: FieldDef[]
  onChange: (steps: UiWorkflowStep[]) => void
  /** Nesting level, used only to keep deep branches from marching off the
   *  right edge — the indent stops growing past a couple of levels. */
  depth?: number
}

function StepList({ steps, fields, onChange, depth = 0 }: StepListProps) {
  const add = (type: string) => {
    const def = getUiWorkflowNode(type)
    if (!def) return
    onChange([...steps, { id: nanoid(), type, config: def.createDefaultConfig() }])
  }

  const update = (id: string, config: unknown) =>
    onChange(steps.map((s) => (s.id === id ? { ...s, config } : s)))

  const remove = (id: string) => onChange(steps.filter((s) => s.id !== id))

  const move = (index: number, dir: -1 | 1) => {
    const next = [...steps]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {steps.length === 0 && (
        <p className="rounded-lg border border-dashed border-[hsl(var(--border))] px-3 py-4 text-center text-[12px] text-[hsl(var(--muted-foreground))]">
          No steps yet — add one below.
        </p>
      )}

      {steps.map((step, i) => (
        <StepCard
          key={step.id}
          step={step}
          fields={fields}
          depth={depth}
          isFirst={i === 0}
          isLast={i === steps.length - 1}
          onConfigChange={(config) => update(step.id, config)}
          onMove={(dir) => move(i, dir)}
          onRemove={() => remove(step.id)}
        />
      ))}

      <AddStepButton onAdd={add} />
    </div>
  )
}

function AddStepButton({ onAdd }: { onAdd: (type: string) => void }) {
  const nodes = selectableUiWorkflowNodes()
  // Grouped by what the step is allowed to touch, which is the distinction an
  // author actually reasons about — and the one the security boundary follows.
  const groups: { label: string; category: string }[] = [
    { label: 'Interface', category: 'interface' },
    { label: 'Data', category: 'data' },
    { label: 'Flow', category: 'flow' },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-[12px]">
          <Plus size={13} /> Add step
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {groups.map(({ label, category }) => {
          const inGroup = nodes.filter((n) => n.category === category)
          if (inGroup.length === 0) return null
          return (
            <div key={category}>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                {label}
              </p>
              {inGroup.map((n) => (
                <DropdownMenuItem key={n.type} onClick={() => onAdd(n.type)} className="flex-col items-start gap-0.5">
                  <span className="flex items-center gap-1.5 text-[12px]">
                    <n.icon size={12} />{n.label}
                  </span>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{n.description}</span>
                </DropdownMenuItem>
              ))}
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface StepCardProps {
  step: UiWorkflowStep
  fields: FieldDef[]
  depth: number
  isFirst: boolean
  isLast: boolean
  onConfigChange: (config: unknown) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}

function StepCard({ step, fields, depth, isFirst, isLast, onConfigChange, onMove, onRemove }: StepCardProps) {
  const [open, setOpen] = useState(true)
  const def = getUiWorkflowNode(step.type)

  // A step this build doesn't know: shown, not hidden, and NOT editable. Its
  // config is preserved verbatim on save (see parse.ts), so the worst outcome
  // is that someone on an older client can see the step exists without being
  // able to change it — much better than it vanishing from their copy.
  if (!def) {
    return (
      <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-3">
        <p className="flex items-center gap-1.5 text-[12px] font-medium">
          <TriangleAlert size={13} className="text-[hsl(var(--muted-foreground))]" />
          Unknown step “{step.type}”
        </p>
        <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
          This app doesn’t know this step type, so it can’t be edited here and will be skipped when the workflow runs.
          It is kept as-is when you save.
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="mt-1.5 h-6 gap-1 text-[11px]">
          <Trash2 size={11} /> Remove
        </Button>
      </div>
    )
  }

  const Icon = def.icon
  const Panel = def.ConfigPanel
  const childLists = def.childStepLists?.(step.config) ?? []
  const labels = def.childStepLabels ?? []

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <GripVertical size={12} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12px] font-medium"
        >
          <Icon size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          <span className="truncate">{def.label}</span>
          {def.deprecated && (
            <span className="shrink-0 rounded bg-[hsl(var(--muted))] px-1 text-[10px] text-[hsl(var(--muted-foreground))]">
              retired
            </span>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={isFirst} onClick={() => onMove(-1)} aria-label="Move up">
            <ChevronUp size={12} />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={isLast} onClick={() => onMove(1)} aria-label="Move down">
            <ChevronDown size={12} />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRemove} aria-label="Remove step">
            <Trash2 size={12} />
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-[hsl(var(--border))] px-2.5 py-2.5">
          {Panel ? (
            <Panel config={step.config as never} onChange={onConfigChange} fields={fields} />
          ) : (
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">This step has no settings.</p>
          )}

          {/* Nested branches, driven entirely by the registry — this block
              knows nothing about `condition` specifically. */}
          {childLists.map((list, index) => (
            <div key={index} className={depth < 2 ? 'border-l-2 border-[hsl(var(--border))] pl-2.5' : ''}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                {labels[index] ?? `Branch ${index + 1}`}
              </p>
              <StepList
                steps={list}
                fields={fields}
                depth={depth + 1}
                onChange={(steps) => {
                  if (!def.setChildStepList) return
                  onConfigChange(def.setChildStepList(step.config, index, steps))
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

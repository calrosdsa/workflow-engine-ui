// Authoring for run_ui_workflow, as a JSON editor.
//
// The step editor is the NEXT phase of this feature; this is what makes the
// interpreter reachable before that exists. It is not a placeholder in the
// sense of being throwaway — the catalog publishes the node types and both
// envelope schemas precisely so a graph can be written as JSON, by hand or by
// an agent, and this panel is that path with live validation attached. When
// the step editor lands, this stays useful as its escape hatch, the same way
// the form builder kept its JSON import.
import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { parseUiWorkflow, validateUiWorkflow } from '@/features/ui-workflows/parse'
import { graphPlatforms, selectableUiWorkflowNodes } from '@/features/ui-workflows/node-registry'
import type { CustomActionConfigPanelProps } from '../contract'
import type { RunUiWorkflowActionConfig } from './schema'

export function RunUiWorkflowConfigPanel({
  config,
  onChange,
}: CustomActionConfigPanelProps<RunUiWorkflowActionConfig>) {
  const [text, setText] = useState(() => JSON.stringify(config.workflow, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Re-seeds when the panel is pointed at a different action, but NOT on every
  // config change: rewriting the textarea from parsed config while someone is
  // typing would fight them mid-keystroke.
  useEffect(() => {
    setText(JSON.stringify(config.workflow, null, 2))
    setJsonError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const problems = validateUiWorkflow(config.workflow)
  const platforms = graphPlatforms(config.workflow.steps)

  const apply = (next: string) => {
    setText(next)
    try {
      // parseUiWorkflow is total, so the only thing that can fail here is
      // JSON.parse itself — which is worth reporting separately, since a
      // syntax error is a different problem from a valid-but-wrong graph.
      onChange({ workflow: parseUiWorkflow(JSON.parse(next)) })
      setJsonError(null)
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'That is not valid JSON.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[13px] font-medium">Steps (JSON)</Label>
        <Textarea
          value={text}
          onChange={(e) => apply(e.target.value)}
          rows={14}
          spellCheck={false}
          className="font-mono text-[12px]"
        />
      </div>

      {jsonError && <p className="text-[12px] text-[hsl(var(--destructive))]">{jsonError}</p>}

      {problems.map((p, i) => (
        <p key={i} className="text-[12px] text-[hsl(var(--muted-foreground))]">
          {p.message}
        </p>
      ))}

      {config.workflow.steps.length > 0 && (
        <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
          {/* A graph is only as portable as its least portable step, so this
              reports the intersection rather than a per-step list. */}
          Runs on: {platforms.length > 0 ? platforms.join(', ') : 'nothing — one of these steps runs nowhere'}
        </p>
      )}

      <details className="text-[12px] text-[hsl(var(--muted-foreground))]">
        <summary className="cursor-pointer">Available step types</summary>
        <ul className="mt-1.5 space-y-1">
          {selectableUiWorkflowNodes().map((n) => (
            <li key={n.type}>
              <code className="text-[11px]">{n.type}</code> — {n.description}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

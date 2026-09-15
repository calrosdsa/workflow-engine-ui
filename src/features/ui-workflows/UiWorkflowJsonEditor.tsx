// Shared JSON authoring for a UI workflow, with live validation.
//
// The step editor is the next phase; this is what makes the interpreter
// reachable before it exists, and it stays useful afterwards as the escape
// hatch — the same way the form builder kept its JSON import. Shared between
// the run_ui_workflow record action and a form's after-submit workflow so the
// two authoring surfaces cannot drift in what they accept or report.
import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { parseUiWorkflow, validateUiWorkflow } from './parse'
import { graphPlatforms, selectableUiWorkflowNodes } from './node-registry'
import type { UiWorkflow } from './types'
import { useTranslation } from '@/features/i18n/I18nProvider'

export interface UiWorkflowJsonEditorProps {
  value: UiWorkflow
  onChange: (next: UiWorkflow) => void
  label?: string
  rows?: number
  /** Shown above the editor when the surface needs to say something about
   *  WHEN these steps run — which differs per trigger and is exactly the sort
   *  of thing an author guesses wrong. */
  help?: string
}

export function UiWorkflowJsonEditor({
  value,
  onChange,
  label,
  rows = 14,
  help,
}: UiWorkflowJsonEditorProps) {
  const t = useTranslation()
  const [text, setText] = useState(() => JSON.stringify(value, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Seeds once. Re-serialising from parsed config on every change would
  // rewrite the textarea under someone mid-keystroke.
  useEffect(() => {
    setText(JSON.stringify(value, null, 2))
    setJsonError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const problems = validateUiWorkflow(value)
  const platforms = graphPlatforms(value.steps)

  const apply = (next: string) => {
    setText(next)
    try {
      // parseUiWorkflow is total, so the only thing that can fail is
      // JSON.parse — worth reporting separately, since a syntax error is a
      // different problem from a valid-but-wrong graph.
      onChange(parseUiWorkflow(JSON.parse(next)))
      setJsonError(null)
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : t('ui_workflows.invalid_json'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[13px] font-medium">{label ?? t('ui_workflows.steps_json')}</Label>
        {help && <p className="text-[12px] text-[hsl(var(--muted-foreground))]">{help}</p>}
        <Textarea
          value={text}
          onChange={(e) => apply(e.target.value)}
          rows={rows}
          spellCheck={false}
          className="font-mono text-[12px]"
        />
      </div>

      {jsonError && <p className="text-[12px] text-[hsl(var(--destructive))]">{jsonError}</p>}

      {problems.map((p, i) => (
        <p key={i} className="text-[12px] text-[hsl(var(--muted-foreground))]">{p.message}</p>
      ))}

      {value.steps.length > 0 && (
        <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
          {/* A graph is only as portable as its least portable step, so this
              is the intersection rather than a per-step list. */}
          {t('ui_workflows.runs_on')}: {platforms.length > 0 ? platforms.join(', ') : t('ui_workflows.runs_nowhere')}
        </p>
      )}

      <details className="text-[12px] text-[hsl(var(--muted-foreground))]">
        <summary className="cursor-pointer">{t('ui_workflows.available_step_types')}</summary>
        <ul className="mt-1.5 space-y-1">
          {selectableUiWorkflowNodes().map((n) => (
            <li key={n.type}>
              <code className="text-[11px]">{n.type}</code> — {t(`ui_workflows.node.${n.type}.description`)}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

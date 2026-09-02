import { Workflow } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useWorkflows } from '@/features/workflows/hooks'
import { registerUiWorkflowNode, type UiWorkflowNodeConfigPanelProps } from '../node-registry'
import { Field } from './panel-kit'
import { resolveValue } from '../values'
import { ALL_PLATFORMS } from '../types'

/** THE PRESSURE VALVE.
 *
 *  Everything a client must not do — hold a secret, reach a connector, run an
 *  agent, retry durably, take longer than a screen is open — is reachable from
 *  here by handing off to a real server workflow (Temporal, with history and
 *  retries). This single node is what stops the UI vocabulary from ever
 *  needing to grow an http_request or a connector node of its own, which would
 *  put credentials in the browser.
 *
 *  The server still applies its own authorization to the run; starting a
 *  workflow from here is not an escalation, it is the same request the runtime
 *  already makes when a Trigger Workflow record action is clicked. */
export interface RunWorkflowStepConfig {
  workflow_definition_id: string
  /** Run variables passed in as the workflow's input. Values only — no way to
   *  name a credential or a connector, deliberately. */
  inputs: { name: string; source: 'static' | 'variable'; value?: unknown; variable?: string }[]
  /** When true the step waits for the run to finish before the next step;
   *  otherwise it starts it and moves on. Waiting is a real cost (a durable
   *  workflow can take minutes) so the default is not to. */
  wait_for_result: boolean
  /** Run variable the result is stored in, when waiting. */
  output_variable?: string
}

export function emptyRunWorkflowConfig(): RunWorkflowStepConfig {
  return { workflow_definition_id: '', inputs: [], wait_for_result: false }
}

export function parseRunWorkflowConfig(raw: unknown): RunWorkflowStepConfig {
  const empty = emptyRunWorkflowConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  const inputs: RunWorkflowStepConfig['inputs'] = []
  if (Array.isArray(r.inputs)) {
    for (const entry of r.inputs) {
      if (!entry || typeof entry !== 'object') continue
      const e = entry as Record<string, unknown>
      if (typeof e.name !== 'string' || !e.name) continue
      inputs.push({
        name: e.name,
        source: e.source === 'variable' ? 'variable' : 'static',
        value: 'value' in e ? e.value : undefined,
        variable: typeof e.variable === 'string' ? e.variable : undefined,
      })
    }
  }
  return {
    workflow_definition_id:
      typeof r.workflow_definition_id === 'string'
        ? r.workflow_definition_id
        : empty.workflow_definition_id,
    inputs,
    wait_for_result: r.wait_for_result === true,
    output_variable: typeof r.output_variable === 'string' ? r.output_variable : undefined,
  }
}

function RunWorkflowPanel({ config, onChange }: UiWorkflowNodeConfigPanelProps<RunWorkflowStepConfig>) {
  const { data: workflows } = useWorkflows()
  return (
    <div className="space-y-2">
      <Field
        label="Workflow"
        hint="Runs on the server, so this is where anything needing a credential, a connector or durability belongs."
      >
        <SelectMenu
          value={config.workflow_definition_id}
          onValueChange={(workflow_definition_id) => onChange({ ...config, workflow_definition_id })}
        >
          <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Pick a workflow…" /></SelectTrigger>
          <SelectContent>
            {(workflows ?? []).map((w) => (
              <SelectItem key={w.id} value={w.id} className="text-[12px]">{w.name}</SelectItem>
            ))}
          </SelectContent>
        </SelectMenu>
      </Field>
      <label className="flex items-start gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
        <Checkbox
          checked={config.wait_for_result}
          onCheckedChange={(v) => onChange({ ...config, wait_for_result: v === true })}
          className="mt-0.5"
        />
        <span>
          Wait for it to finish before the next step.
          {' '}Off by default — a server workflow can take longer than the viewer stays on this screen.
        </span>
      </label>
      {config.wait_for_result && (
        <Field label="Store result in">
          <Input
            value={config.output_variable ?? ''}
            onChange={(e) => onChange({ ...config, output_variable: e.target.value })}
            className="h-8 font-mono text-[11px]"
          />
        </Field>
      )}
    </div>
  )
}

registerUiWorkflowNode({
  ConfigPanel: RunWorkflowPanel,
  type: 'run_workflow',
  label: 'Run Workflow',
  icon: Workflow,
  description:
    'Hands off to a server workflow — for anything needing durability, secrets, connectors, or long-running work.',
  category: 'data',
  platforms: ALL_PLATFORMS,
  configSchema: {
    type: 'object',
    description:
      'Starts a server (Temporal) workflow. This is the escape hatch for work a client must not do itself: anything requiring a credential, a connector, an agent, or durability belongs behind this node rather than in a new client node type.',
    required: ['workflow_definition_id'],
    properties: {
      workflow_definition_id: {
        type: 'string',
        description: 'The workflow definition to start.',
      },
      inputs: {
        type: 'array',
        description: 'Values passed as the run’s input: {name, source: static|variable, value, variable}.',
      },
      wait_for_result: {
        type: 'boolean',
        description:
          'Whether to wait for the run to finish before continuing. Defaults to false — a durable workflow can outlive the screen.',
      },
      output_variable: {
        type: 'string',
        description: 'Run variable the result is stored in, when waiting.',
      },
    },
  },
  execute: async ({ config, ctx, host }) => {
    if (!config.workflow_definition_id) throw new Error('This step has no workflow configured.')
    // The dispatch endpoint is record-scoped, so a server workflow can only be
    // started from a context that HAS a record. That is a real limitation of
    // the existing trigger path, not a rule of this node — named plainly here
    // rather than left to surface as a confusing 404.
    if (!ctx.formId || !ctx.recordId) {
      throw new Error('Running a workflow needs a record in context.')
    }

    const inputs: Record<string, unknown> = {}
    for (const input of config.inputs ?? []) {
      const value = resolveValue(
        { source: input.source === 'variable' ? 'variable' : 'static', value: input.value, variable: input.variable },
        ctx,
      )
      if (value !== undefined) inputs[input.name] = value
    }

    const result = await host.runServerWorkflow({
      formId: ctx.formId,
      recordId: ctx.recordId,
      workflowDefinitionId: config.workflow_definition_id,
      inputs,
      wait: config.wait_for_result,
    })
    if (config.wait_for_result && config.output_variable) {
      ctx.variables[config.output_variable] = result
    }
    return { kind: 'next' }
  },
  parseConfig: parseRunWorkflowConfig,
  createDefaultConfig: emptyRunWorkflowConfig,
})

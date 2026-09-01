import { Workflow } from 'lucide-react'
import { registerUiWorkflowNode } from '../node-registry'
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

registerUiWorkflowNode({
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
  parseConfig: parseRunWorkflowConfig,
  createDefaultConfig: emptyRunWorkflowConfig,
})

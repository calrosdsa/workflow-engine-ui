import { Zap } from 'lucide-react'
import { registerCustomAction } from '../registry'
import { UI_WORKFLOW_ENVELOPE_SCHEMA } from '@/features/ui-workflows/envelope'
import { emptyRunUiWorkflowActionConfig, parseRunUiWorkflowActionConfig } from './schema'
import { RunUiWorkflowConfigPanel } from './ConfigPanel'
import { RunUiWorkflowMenuItem } from './MenuItem'

registerCustomAction({
  type: 'run_ui_workflow',
  label: 'Run Steps',
  icon: Zap,
  description:
    'Runs a sequence of steps in the browser when clicked — show a message, branch on a condition, read or write records, or hand off to a server workflow.',
  configSchema: {
    type: 'object',
    description:
      "A UI workflow stored inline. Unlike trigger_workflow, these steps run in the viewer's own browser rather than on the server: immediate, but with no durability — closing the tab abandons the rest of the run. Step types and their configs are published as `ui_workflows` in this catalog.",
    required: ['workflow'],
    properties: {
      workflow: UI_WORKFLOW_ENVELOPE_SCHEMA,
    },
  },
  parseConfig: parseRunUiWorkflowActionConfig,
  createDefaultConfig: emptyRunUiWorkflowActionConfig,
  ConfigPanel: RunUiWorkflowConfigPanel,
  MenuItem: RunUiWorkflowMenuItem,
})

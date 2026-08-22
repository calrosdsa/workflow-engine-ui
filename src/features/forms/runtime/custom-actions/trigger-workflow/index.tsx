import { Workflow } from 'lucide-react'
import { registerCustomAction } from '../registry'
import { emptyTriggerWorkflowActionConfig, parseTriggerWorkflowActionConfig } from './schema'
import { TriggerWorkflowConfigPanel } from './ConfigPanel'
import { TriggerWorkflowMenuItem } from './MenuItem'

registerCustomAction({
  type: 'trigger_workflow',
  label: 'Trigger Workflow',
  icon: Workflow,
  description: 'Start a workflow against this record when clicked (FR-B3-007 on_demand_data_driven).',
  parseConfig: parseTriggerWorkflowActionConfig,
  createDefaultConfig: emptyTriggerWorkflowActionConfig,
  ConfigPanel: TriggerWorkflowConfigPanel,
  MenuItem: TriggerWorkflowMenuItem,
})

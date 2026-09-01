// JSON Schema descriptions of the WRAPPER objects a UI workflow is stored as.
//
// These live beside the interfaces they describe (types.ts is one file away)
// for the same reason the form-builder's envelopes sit under theirs:
// same-folder locality is the only drift defense TypeScript interfaces allow,
// so a shape change and its description are one diff apart.
//
// The node registry describes each STEP's own config; these describe the
// container those steps sit in — which is what an agent authoring a workflow
// through the MCP server needs in order to write the outer JSON at all.
import type { ConfigSchema } from '@/lib/config-schema'
import { UI_WORKFLOW_VERSION } from './types'

export const UI_WORKFLOW_STEP_ENVELOPE_SCHEMA: ConfigSchema = {
  type: 'object',
  description:
    "One step in a UI workflow. `type` names a ui_workflow_node from this catalog and that node's config_schema governs `config` — this envelope never interprets it.",
  required: ['id', 'type'],
  properties: {
    id: {
      type: 'string',
      description: 'Stable identifier for this step, unique within the workflow.',
    },
    type: {
      type: 'string',
      description: "Registry key of the node, e.g. 'show_message'. An unknown type is preserved on save but skipped when the workflow runs.",
    },
    config: {
      type: 'object',
      description: "The node type's own config payload; see that node's config_schema.",
    },
  },
}

export const UI_WORKFLOW_ENVELOPE_SCHEMA: ConfigSchema = {
  type: 'object',
  description:
    'A UI workflow: authored logic that runs in the end user’s client rather than on the server, started by an interaction. An ORDERED LIST, not a graph — UI steps are sequential by nature (show a dialog, wait, branch on the answer), so branching nests child step lists inside a branching node’s own config instead of using edges. Stored inside the config of whatever triggers it.',
  required: ['version', 'steps'],
  properties: {
    version: {
      type: 'integer',
      description: `Schema version; current is ${UI_WORKFLOW_VERSION}. Absent reads as ${UI_WORKFLOW_VERSION}.`,
    },
    steps: {
      type: 'array',
      description: 'Steps in execution order.',
      items: UI_WORKFLOW_STEP_ENVELOPE_SCHEMA,
    },
  },
}

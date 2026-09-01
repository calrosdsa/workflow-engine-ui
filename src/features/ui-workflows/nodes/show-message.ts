import { MessageSquare } from 'lucide-react'
import { registerUiWorkflowNode } from '../node-registry'
import { ALL_PLATFORMS } from '../types'

/** Kept name- and shape-compatible with the SERVER's show_message node
 *  (graph.ShowMessageConfig): same type string, same `message`/`message_type`
 *  keys. An author who has used one should not have to learn the other, and
 *  the generated catalog stays coherent when both appear in it. */
export interface ShowMessageStepConfig {
  message: string
  message_type: 'info' | 'success' | 'warning' | 'error'
}

export function emptyShowMessageConfig(): ShowMessageStepConfig {
  return { message: '', message_type: 'info' }
}

const MESSAGE_TYPES = new Set(['info', 'success', 'warning', 'error'])

export function parseShowMessageConfig(raw: unknown): ShowMessageStepConfig {
  const empty = emptyShowMessageConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  return {
    message: typeof r.message === 'string' ? r.message : empty.message,
    message_type:
      typeof r.message_type === 'string' && MESSAGE_TYPES.has(r.message_type)
        ? (r.message_type as ShowMessageStepConfig['message_type'])
        : empty.message_type,
  }
}

registerUiWorkflowNode({
  type: 'show_message',
  label: 'Show Message',
  icon: MessageSquare,
  description: 'Shows a short message to the person using the app.',
  category: 'interface',
  // A toast on the web, a snackbar on mobile — the concept survives the
  // platform change intact, unlike anything that assumes a DOM.
  platforms: ALL_PLATFORMS,
  configSchema: {
    type: 'object',
    description:
      "Displays a transient message. Mirrors the server workflow node of the same name, including its `message_type` values.",
    required: ['message', 'message_type'],
    properties: {
      message: { type: 'string', description: 'Text shown to the viewer.' },
      message_type: {
        type: 'string',
        enum: ['info', 'success', 'warning', 'error'],
        description: 'Controls the message’s styling and icon.',
      },
    },
  },
  execute: ({ config, host }) => {
    // An empty message shows nothing rather than an empty toast. Unlike the
    // SERVER's show_message — which halts its run when it fires — this does
    // not stop the workflow: on the client a message is ordinary feedback
    // mid-flow ("saved", then navigate), not a terminal state.
    if (config.message) host.showMessage(config.message, config.message_type)
    return { kind: 'next' }
  },
  parseConfig: parseShowMessageConfig,
  createDefaultConfig: emptyShowMessageConfig,
})

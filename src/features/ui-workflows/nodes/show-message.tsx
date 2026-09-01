import { MessageSquare } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { registerUiWorkflowNode, type UiWorkflowNodeConfigPanelProps } from '../node-registry'
import { Field } from './panel-kit'
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

function ShowMessagePanel({ config, onChange }: UiWorkflowNodeConfigPanelProps<ShowMessageStepConfig>) {
  return (
    <div className="space-y-2">
      <Field label="Message">
        <Textarea
          value={config.message}
          onChange={(e) => onChange({ ...config, message: e.target.value })}
          rows={2}
          placeholder="Saved."
          className="text-[12px]"
        />
      </Field>
      <Field label="Style">
        <SelectMenu
          value={config.message_type}
          onValueChange={(v) => onChange({ ...config, message_type: v as ShowMessageStepConfig['message_type'] })}
        >
          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(['info', 'success', 'warning', 'error'] as const).map((t) => (
              <SelectItem key={t} value={t} className="text-[12px]">{t}</SelectItem>
            ))}
          </SelectContent>
        </SelectMenu>
      </Field>
    </div>
  )
}

registerUiWorkflowNode({
  ConfigPanel: ShowMessagePanel,
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

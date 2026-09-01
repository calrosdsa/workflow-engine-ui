import { PenLine } from 'lucide-react'
import { registerDetailTab } from '../registry'
import { parseFieldRefConfig, emptyFieldRefConfig } from './schema'
import { FieldRefRenderer } from './Renderer'
import { FieldRefConfigPanel } from './ConfigPanel'

registerDetailTab({
  type: 'field_ref',
  label: 'Field',
  icon: PenLine,
  description: 'A read-only mirror of one of this form\'s own fields.',
  configSchema: {
    type: 'object',
    required: ['fieldKey'],
    properties: {
      fieldKey: { type: 'string', description: 'Key of the field on THIS form to mirror.' },
    },
  },
  parseConfig: parseFieldRefConfig,
  createDefaultConfig: emptyFieldRefConfig,
  Renderer: FieldRefRenderer,
  ConfigPanel: FieldRefConfigPanel,
})

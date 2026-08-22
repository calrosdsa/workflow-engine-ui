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
  parseConfig: parseFieldRefConfig,
  createDefaultConfig: emptyFieldRefConfig,
  Renderer: FieldRefRenderer,
  ConfigPanel: FieldRefConfigPanel,
})

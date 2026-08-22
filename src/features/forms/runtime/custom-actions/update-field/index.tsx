import { PencilLine } from 'lucide-react'
import { registerCustomAction } from '../registry'
import { emptyUpdateFieldActionConfig, parseUpdateFieldActionConfig } from './schema'
import { UpdateFieldConfigPanel } from './ConfigPanel'
import { UpdateFieldMenuItem } from './MenuItem'

registerCustomAction({
  type: 'update_field',
  label: 'Update Field',
  icon: PencilLine,
  description: 'Set a field on this record to a static or computed value when clicked.',
  parseConfig: parseUpdateFieldActionConfig,
  createDefaultConfig: emptyUpdateFieldActionConfig,
  ConfigPanel: UpdateFieldConfigPanel,
  MenuItem: UpdateFieldMenuItem,
})

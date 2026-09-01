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
  configSchema: {
    type: 'object',
    required: ['fieldKey', 'valueMode'],
    properties: {
      fieldKey: { type: 'string', description: "Key of the field on THIS form to write." },
      valueMode: { type: 'string', enum: ['static', 'expression'], description: 'Where the new value comes from.' },
      staticValue: { description: "The literal value written when valueMode is 'static'." },
      expressionValue: { type: 'string', description: "Expr expression producing the value when valueMode is 'expression'. Vars[\"fieldKey\"] addresses the record's own fields." },
    },
  },
  parseConfig: parseUpdateFieldActionConfig,
  createDefaultConfig: emptyUpdateFieldActionConfig,
  ConfigPanel: UpdateFieldConfigPanel,
  MenuItem: UpdateFieldMenuItem,
})

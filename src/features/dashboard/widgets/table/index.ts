import { Table2 } from 'lucide-react'
import { registerWidget } from '../../widget-registry'
import { parseTableConfig, createDefaultTableConfig , TABLE_CONFIG_SCHEMA } from './schema'
import { TableRenderer } from './Renderer'
import { TableConfigPanel } from './ConfigPanel'

registerWidget({
  type: 'table',
  label: 'Table',
  icon: Table2,
  category: 'Data',
  description: 'A live, filterable table of records for a form',
  configSchema: TABLE_CONFIG_SCHEMA,
  parseConfig: parseTableConfig,
  createDefaultConfig: createDefaultTableConfig,
  defaultLayout: { w: 6, h: 6, minW: 3, minH: 3 },
  defaultChrome: 'card',
  Renderer: TableRenderer,
  ConfigPanel: TableConfigPanel,
  // Reads parameterFilter in its Renderer, so it declares itself
  // bindable — see widget-contract.ts for why those two must stay in step.
  bindable: { formId: (c) => c.formId || undefined },
})

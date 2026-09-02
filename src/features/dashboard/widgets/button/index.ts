import { Link2 } from 'lucide-react'
import { registerWidget } from '../../widget-registry'
import { parseButtonConfig, createDefaultButtonConfig , BUTTON_CONFIG_SCHEMA } from './schema'
import { ButtonRenderer } from './Renderer'
import { ButtonConfigPanel } from './ConfigPanel'

registerWidget({
  type: 'button',
  label: 'Button/Link',
  icon: Link2,
  category: 'Content',
  description: 'A button that navigates somewhere',
  configSchema: BUTTON_CONFIG_SCHEMA,
  parseConfig: parseButtonConfig,
  createDefaultConfig: createDefaultButtonConfig,
  defaultLayout: { w: 3, h: 2, minW: 2, minH: 1 },
  defaultChrome: 'plain',
  Renderer: ButtonRenderer,
  ConfigPanel: ButtonConfigPanel,
})

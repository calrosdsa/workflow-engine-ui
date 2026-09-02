import { StretchVertical } from 'lucide-react'
import { registerWidget } from '../../widget-registry'
import { parseSpacerConfig, createDefaultSpacerConfig , SPACER_CONFIG_SCHEMA } from './schema'
import { SpacerRenderer } from './Renderer'
import { SpacerConfigPanel } from './ConfigPanel'

registerWidget({
  type: 'spacer',
  label: 'Spacer',
  icon: StretchVertical,
  category: 'Content',
  description: 'Vertical space',
  configSchema: SPACER_CONFIG_SCHEMA,
  parseConfig: parseSpacerConfig,
  createDefaultConfig: createDefaultSpacerConfig,
  defaultLayout: { w: 6, h: 1, minW: 1, minH: 1 },
  defaultChrome: 'plain',
  Renderer: SpacerRenderer,
  ConfigPanel: SpacerConfigPanel,
})
